import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {
  FACTOR_POLICIES,
  replaySurprise,
  replayUnitFactor,
  auditFactorCoverage,
} from './lib/power-factor-replay.mjs'
import {
  enrichExtraFactors,
  replayExtraCorrection,
} from './lib/power-extra-factors.mjs'
import {
  alignComponents,
  evaluateLearnedEnsemble,
} from './lib/power-ensemble.mjs'
import { fitResultCalibration } from './lib/result-calibration.mjs'
import { calibrateForecast } from '../convex/powerCalibration.ts'
import { evaluateForecasts } from '../convex/ratingBacktest.ts'
import {
  chooseEarlyPowerChampion,
  marketMargins,
  compareMarketMargins,
} from '../convex/powerBenchmarks.ts'

const [
  dataPath,
  componentPath,
  incumbentPath,
  marketDirectory,
  outputDirectory,
  extraDirectory,
] = process.argv.slice(2)
const only = process.argv
  .find((arg) => arg.startsWith('--only='))
  ?.slice('--only='.length)
if (!outputDirectory)
  throw new Error(
    'Usage: node scripts/evaluate-power-factors.mjs <enriched.json> <saved-components.json> <released-with-forecasts.json> <market-directory> <new-output-directory>',
  )
const buffers = await Promise.all(
  [dataPath, componentPath, incumbentPath].map((p) => readFile(p)),
)
const [data, prepared, incumbent] = buffers.map((b) => JSON.parse(b))
const hash = (v) => createHash('sha256').update(v).digest('hex')
if (
  hash(buffers[0]) !== prepared.sourceSha256 ||
  prepared.sourceSha256 !== incumbent.sourceSha256 ||
  prepared.foundationSha256 !== incumbent.incumbentSha256 ||
  prepared.programContextSha256 !== incumbent.programContextSha256 ||
  hash(JSON.stringify(incumbent.forecasts)) !== incumbent.forecastSha256 ||
  prepared.components.length !== 2
)
  throw new Error(
    'Frozen source, foundation, Program context, or forecast fingerprint mismatch.',
  )
const testSeasons = prepared.testSeasons
const rerun = evaluateLearnedEnsemble(
  alignComponents(prepared.components),
  testSeasons,
)
alignComponents([rerun.forecasts, incumbent.forecasts])
const frozen = new Map(incumbent.forecasts.map((r) => [r.gameId, r]))
if (
  rerun.forecasts.some(
    (r) =>
      r.predictedMargin !== frozen.get(r.gameId).predictedMargin ||
      r.homeWinProbability !== frozen.get(r.gameId).homeWinProbability,
  )
)
  throw new Error(
    'Prepared components do not exactly reproduce released Power forecasts.',
  )
await mkdir(outputDirectory)
const extraFiles = extraDirectory
  ? (await readdir(extraDirectory))
      .filter((n) => /^(returning|advanced|drives)-\d{4}\.json$/.test(n))
      .sort()
  : []
const extraBuffers = await Promise.all(
  extraFiles.map((n) => readFile(`${extraDirectory}/${n}`)),
)
const extra = enrichExtraFactors(
  data,
  extraBuffers.map((b, i) => ({
    ...JSON.parse(b),
    kind: extraFiles[i].split('-')[0],
  })),
)
const games = extra.games.map((g) => ({
  ...g,
  id: String(g.sourceGameId),
  homeTeamId: g.homeProgramId,
  awayTeamId: g.awayProgramId,
  kickoffAt: g.startTime,
  overtimePeriods: Math.max(
    0,
    (g.homeLineScores?.length ?? 4) - 4,
    (g.awayLineScores?.length ?? 4) - 4,
  ),
}))
const foundation = new Map(prepared.components[0].map((r) => [r.gameId, r]))
const requests = prepared.requests.map((r) => ({
  ...r,
  predictedMargin:
    foundation.get(r.gameId)?.predictedMargin ?? r.predictedMargin,
}))
const marketFiles = (await readdir(marketDirectory))
  .filter((n) => /^market-\d{4}\.json$/.test(n))
  .sort()
const marketBuffers = await Promise.all(
  marketFiles.map((n) => readFile(`${marketDirectory}/${n}`)),
)
const market = marketMargins(
  marketBuffers.flatMap((b) => JSON.parse(b).rows),
  'opening',
)
const report = (forecasts, modelVersion) => {
  const evaluation = evaluateForecasts(forecasts)
  return {
    modelVersion,
    forecasts,
    evaluation,
    folds: Object.entries(evaluation.bySeason).map(([season, metrics]) => ({
      season: Number(season),
      ...metrics,
    })),
  }
}
const compact = (r) => ({
  modelVersion: r.modelVersion,
  overall: r.evaluation.overall,
  early: r.evaluation.byWeekRange.weeks_1_4,
  folds: r.folds,
  opening: compareMarketMargins(r.forecasts, market),
})
const baseline = report(incumbent.forecasts, 'released-power-v6')
const reports = [],
  artifacts = [],
  calibrated = new Map()
async function score(name, components, metadata) {
  const result = evaluateLearnedEnsemble(
    alignComponents(components),
    testSeasons,
  )
  const candidate = report(result.forecasts, name)
  reports.push(candidate)
  const artifact = {
    candidateName: name,
    sourceSha256: prepared.sourceSha256,
    forecastSha256: hash(JSON.stringify(result.forecasts)),
    ...metadata,
    ...result,
  }
  await writeFile(
    `${outputDirectory}/${name}.json`,
    JSON.stringify(artifact) + '\n',
    { flag: 'wx' },
  )
  const { forecasts: _forecasts, ...evidence } = artifact
  artifacts.push({ ...evidence, report: compact(candidate) })
  console.log(
    JSON.stringify({
      name,
      mae: candidate.evaluation.overall.marginMae,
      brier: candidate.evaluation.overall.brier,
      early: candidate.evaluation.byWeekRange.weeks_1_4,
      finalWeights: result.finalFit.weights.weights,
    }),
  )
}
const policies = [
  ...FACTOR_POLICIES,
  ...(extraDirectory
    ? [
        {
          name: 'adjusted-explosiveness',
          kind: 'efficiency',
          metric: 'explosiveness',
        },
        { name: 'quarterback-continuity', kind: 'extra' },
        { name: 'turnover-volatility', kind: 'extra' },
        { name: 'return-score-volatility', kind: 'extra' },
        { name: 'combined-volatility', kind: 'extra' },
      ]
    : []),
]
for (const policy of policies) {
  if (only && !only.split(',').includes(policy.name)) continue
  console.log('Replaying', policy.name)
  const residual =
    policy.kind === 'extra'
      ? replayExtraCorrection(games, requests, extra.returning, policy)
      : undefined
  const raw =
    policy.kind === 'control'
      ? requests
      : (residual?.forecasts ??
        (policy.kind === 'surprise' ? replaySurprise : replayUnitFactor)(
          games,
          requests,
          policy,
        ))
  const component = [],
    pointFits = []
  for (const season of [
    ...new Set(prepared.components[0].map((r) => r.season)),
  ].sort((a, b) => a - b)) {
    const fit = fitResultCalibration(
      raw.filter(
        (r) =>
          r.season < season &&
          r.homeClassification === 'fbs' &&
          r.awayClassification === 'fbs',
      ),
      season,
      { allowNegativeScale: policy.metric === 'explosiveness' },
    )
    pointFits.push({ season, fit })
    component.push(
      ...raw
        .filter((r) => r.season === season)
        .map((r) =>
          r.homeClassification === 'fbs' && r.awayClassification === 'fbs'
            ? calibrateForecast(r, fit)
            : foundation.get(r.gameId),
        ),
    )
  }
  calibrated.set(policy.name, component)
  await score(policy.name, [...prepared.components, component], {
    policy,
    pointFits,
    residualFits: residual?.fits,
  })
}
// Prespecified joint test: six distinct signals fit together with the two released components.
const joint = [
  'repeated-surprise-2',
  'ppa-faster-offense',
  'ppa-faster-defense',
  'adjusted-success-rate',
  'adjusted-points-per-drive',
  'ppa-opponent-uncertainty',
]
if (!only)
  await score(
    'joint-factors',
    [...prepared.components, ...joint.map((n) => calibrated.get(n))],
    { componentNames: ['foundation', 'Program v4', ...joint] },
  )
const selection = chooseEarlyPowerChampion(baseline, reports, market)
if (!reports.length) throw new Error('No matching factor policy.')
const output = {
  sourceSha256: prepared.sourceSha256,
  componentSha256: hash(buffers[1]),
  incumbentForecastSha256: incumbent.forecastSha256,
  benchmarkSha256: Object.fromEntries(
    marketFiles.map((n, i) => [n, hash(marketBuffers[i])]),
  ),
  baselineReproducedExactly: true,
  testSeasons,
  coverage: auditFactorCoverage(data, testSeasons),
  supplementaryCoverage: extra.coverage,
  supplementarySha256: Object.fromEntries(
    extraFiles.map((n, i) => [n, hash(extraBuffers[i])]),
  ),
  unavailable: {
    quarterback: extraDirectory
      ? 'Historical returning passing usage/PPA tested as a continuity proxy. Player identity, starter changes, and dated injuries/availability remain untested.'
      : 'No QB-specific inputs in the frozen archive.',
    turnoverSpecialTeams: extraDirectory
      ? 'Drive-ending interceptions/fumbles and recognized return-score margins tested. Total fumble opportunities, recovery luck, and full special-teams EPA remain unavailable. Ambiguous FUMBLE TD labels are excluded.'
      : 'No turnover or return-score inputs in the frozen archive.',
    richerEfficiency: extraDirectory
      ? 'Success rate, explosiveness, and competitive points per drive tested. Actual finishing-drive/red-zone opportunity counts remain untested.'
      : 'Success rate and competitive points per drive tested; explosiveness and finishing opportunities unavailable.',
  },
  policies,
  champion: selection.champion.modelVersion,
  decisions: selection.decisions,
  baseline: compact(baseline),
  candidates: artifacts,
  limitation:
    'Exploratory screens on reused 2018–2025 development folds with reconstructed evidence availability, not untouched or prospective validation. Repeated surprises test a forecast correction, not direct prior-confidence replacement. Opponent experience is a precision proxy, not fitted posterior variance. Internal policy settings are prespecified research choices; component point scales, blend weights, and probabilities use earlier seasons. Opening lines are archived without quote timestamps; SP+/FPI are not inputs. No runtime model is changed by this script.',
}
await writeFile(
  `${outputDirectory}/summary.json`,
  JSON.stringify(output, null, 2) + '\n',
  { flag: 'wx' },
)
console.log(
  JSON.stringify({ champion: output.champion, decisions: output.decisions }),
)
