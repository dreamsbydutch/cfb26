import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { replayElo } from './lib/power-elo.mjs'
import { fitResultCalibration } from './lib/result-calibration.mjs'
import { replayEfficiency } from './lib/power-efficiency.mjs'
import {
  alignComponents,
  evaluateLearnedEnsemble,
} from './lib/power-ensemble.mjs'
import { evaluatePowerPolicies } from '../convex/powerResearch.ts'
import { rosterContexts } from '../convex/powerRoster.ts'
import { offensiveReturningShare } from '../convex/powerHistory.ts'
import {
  fitPowerCalibration,
  calibrateForecast,
} from '../convex/powerCalibration.ts'
import { evaluateForecasts } from '../convex/ratingBacktest.ts'
import {
  chooseEarlyPowerChampion,
  marketMargins,
  compareMarketMargins,
} from '../convex/powerBenchmarks.ts'

const [
  dataPath,
  incumbentPath,
  marketDirectory,
  outputPath,
  programContextPath,
] = process.argv.slice(2)
const resultOption = process.argv.find((arg) => arg.startsWith('--win-loss-k='))
const resultK = resultOption ? Number(resultOption.split('=')[1]) : undefined
if (resultOption && (!programContextPath || ![12, 24, 48].includes(resultK)))
  throw new Error(
    'Win/loss testing requires Program context and K of 12, 24, or 48.',
  )
if (!outputPath)
  throw new Error(
    'Usage: node scripts/evaluate-power-ensemble.mjs <enriched-data.json> <incumbent-evaluation.json> <market-directory> <new-output.json> [prepared-program-context.json] [--retain-forecasts] [--win-loss-k=12|24|48]',
  )
const buffer = await readFile(dataPath),
  data = JSON.parse(buffer)
const sourceSha256 = createHash('sha256').update(buffer).digest('hex')
const baselineFile = JSON.parse(await readFile(incumbentPath, 'utf8'))
if (sourceSha256 !== baselineFile.sourceSha256)
  throw new Error('Incumbent and challenger inputs must match.')
const baseline = baselineFile.reports[0],
  incumbent = baseline.calibrated
const testSeasons = [
  ...new Set(incumbent.forecasts.map((row) => row.season)),
].sort((a, b) => a - b)
const first = testSeasons[0]
const seedSeasons = [first - 3, first - 2, first - 1]
const games = data.games
  .filter(
    (g) =>
      g.completed &&
      Number.isFinite(g.homePoints) &&
      Number.isFinite(g.awayPoints),
  )
  .map((g) => ({
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
const classification = new Map()
for (const game of data.games) {
  classification.set(game.homeProgramId, game.homeClassification)
  classification.set(game.awayProgramId, game.awayClassification)
}
const teams = data.programs
  .filter((p) => classification.has(p._id))
  .map((p) => ({
    id: p._id,
    name: p.name,
    classification: classification.get(p._id) === 'fbs' ? 'fbs' : 'fcs',
  }))
const personnel = (data.profiles ?? []).flatMap((p) => {
  const returningShare = offensiveReturningShare(p)
  return returningShare !== null &&
    Number.isFinite(returningShare) &&
    returningShare >= 0 &&
    returningShare <= 1
    ? [
        {
          teamId: p.programId,
          season: p.season,
          returningShare,
          observedAt: Date.UTC(p.season, 7, 1),
          effectiveAt: Date.UTC(p.season, 7, 1),
          expiresAt: Date.UTC(p.season + 1, 2, 1),
          source: 'cfbd-offensive-usage-reconstruction',
        },
      ]
    : []
})
const contexts = new Map()
for (const season of [...new Set(games.map((game) => game.season))]) {
  const field = new Set(
    games
      .filter((g) => g.season === season)
      .flatMap((g) => [
        ...(g.homeClassification === 'fbs' ? [g.homeTeamId] : []),
        ...(g.awayClassification === 'fbs' ? [g.awayTeamId] : []),
      ]),
  )
  for (const [id, context] of rosterContexts(
    data.profiles
      .filter((p) => p.season === season)
      .map((p) => ({ ...p, teamId: p.programId })),
    field,
  ))
    contexts.set(`${season}:${id}`, context)
}
console.log(
  'Replaying earlier Power forecasts for nested training:',
  seedSeasons,
)
const seed = evaluatePowerPolicies({
  teams,
  games,
  testSeasons: seedSeasons,
  personnel,
  rosterFits: new Map(
    Object.entries(baselineFile.rosterFits).map(([year, fit]) => [
      Number(year),
      fit,
    ]),
  ),
  rosterContexts: contexts,
  reconstructEvidence: true,
  policies: [baseline.policy],
}).reports[0].forecasts
const byId = new Map(games.map((game) => [game.id, game]))
const rawPower = [...seed, ...baseline.raw.forecasts]
const requests = rawPower.map((row) => ({ ...byId.get(row.gameId), ...row }))
console.log('Replaying independent component forecasts.')
const programContext = programContextPath
  ? JSON.parse(await readFile(programContextPath, 'utf8'))
  : undefined
if (programContext && programContext.sourceSha256 !== sourceSha256)
  throw new Error('Program context source does not match the evaluation.')
const programScores = new Map(
  (programContext?.scores ?? []).map((row) => [
    `${row.season}:${row.teamId}`,
    row.power,
  ]),
)
const componentNames = programContext
  ? ['Power v5', 'prior-season Program forecast']
  : ['Power v5', 'results-only Elo', 'opponent-adjusted PPA']
const rawComponents = programContext
  ? [
      rawPower,
      requests.map((row) => {
        const home = programScores.get(`${row.season}:${row.homeTeamId}`),
          away = programScores.get(`${row.season}:${row.awayTeamId}`)
        if (home === undefined || away === undefined) {
          // The Program model covers FBS, so FCS games keep the incumbent forecast.
          if (
            row.homeClassification === 'fbs' &&
            row.awayClassification === 'fbs'
          )
            throw new Error('Missing FBS Program forecast.')
          return { ...row }
        }
        return {
          ...row,
          predictedMargin: home - away + (row.neutralSite ? 0 : 2.5),
        }
      }),
    ]
  : [rawPower, replayElo(games, requests), replayEfficiency(games, requests)]
const componentFits = []
if (resultK !== undefined) {
  componentNames.push(`win/loss-only Elo K=${resultK}`)
  rawComponents.push(replayElo(games, requests, { k: resultK }))
}
const components = rawComponents.map((raw, index) => {
  const calibrated = []
  for (const season of [...seedSeasons.slice(1), ...testSeasons]) {
    // Preserve the incumbent's exact published research forecast on every outer fold.
    if (index === 0 && testSeasons.includes(season)) {
      componentFits.push({
        component: index,
        season,
        fit: baseline.fits.find((fit) => fit.season === season),
      })
      calibrated.push(
        ...incumbent.forecasts.filter((row) => row.season === season),
      )
    } else {
      const fit = (
        resultK !== undefined && index === 2
          ? fitResultCalibration
          : fitPowerCalibration
      )(
        raw.filter(
          (row) =>
            row.season < season &&
            (!programContext ||
              index === 0 ||
              (row.homeClassification === 'fbs' &&
                row.awayClassification === 'fbs')),
        ),
        season,
      )
      componentFits.push({ component: index, season, fit })
      calibrated.push(
        ...raw
          .filter((row) => row.season === season)
          .map((row) => calibrateForecast(row, fit)),
      )
    }
  }
  return calibrated
})
if (programContext) {
  const fallback = new Map(components[0].map((row) => [row.gameId, row]))
  for (let index = 1; index < components.length; index++)
    components[index] = components[index].map((row) =>
      row.homeClassification === 'fbs' && row.awayClassification === 'fbs'
        ? row
        : fallback.get(row.gameId),
    )
}
const { forecasts, fits, finalFit } = evaluateLearnedEnsemble(
  alignComponents(components),
  testSeasons,
)
const componentOutput = process.argv
  .find((arg) => arg.startsWith('--save-components='))
  ?.slice('--save-components='.length)
if (componentOutput) {
  if (!programContext || resultK !== undefined)
    throw new Error('Component export requires the unchanged Program ensemble.')
  await writeFile(
    componentOutput,
    JSON.stringify({
      sourceSha256,
      foundationSha256: createHash('sha256')
        .update(await readFile(incumbentPath))
        .digest('hex'),
      programContextSha256: createHash('sha256')
        .update(await readFile(programContextPath))
        .digest('hex'),
      testSeasons,
      requests,
      components,
    }) + '\n',
    { flag: 'wx' },
  )
}
finalFit.components = rawComponents.map((raw, index) =>
  index === 0
    ? baseline.finalCalibration
    : (resultK !== undefined && index === 2
        ? fitResultCalibration
        : fitPowerCalibration)(
        raw.filter(
          (row) =>
            !programContext ||
            (row.homeClassification === 'fbs' &&
              row.awayClassification === 'fbs'),
        ),
        finalFit.season,
      ),
)
const evaluation = evaluateForecasts(forecasts)
const challenger = {
  modelVersion:
    resultK !== undefined
      ? `power-win-loss-k${resultK}`
      : programContext
        ? 'power-v5-program-context'
        : 'power-v5-learned-ensemble',
  forecasts,
  evaluation,
  folds: Object.entries(evaluation.bySeason).map(([season, metrics]) => ({
    season: Number(season),
    ...metrics,
  })),
}
const marketRows = []
for (const name of (await readdir(marketDirectory)).filter((name) =>
  /^market-\d{4}\.json$/.test(name),
))
  marketRows.push(
    ...JSON.parse(await readFile(`${marketDirectory}/${name}`, 'utf8')).rows,
  )
const market = marketMargins(marketRows, 'opening')
const selection = chooseEarlyPowerChampion(incumbent, [challenger], market)
const compact = (report) => ({
  modelVersion: report.modelVersion,
  overall: report.evaluation.overall,
  early: report.evaluation.byWeekRange.weeks_1_4,
  folds: report.folds.map(
    ({ season, marginMae, brier, expectedCalibrationError }) => ({
      season,
      marginMae,
      brier,
      expectedCalibrationError,
    }),
  ),
  opening: compareMarketMargins(report.forecasts, market).early,
})
const output = {
  candidateName: challenger.modelVersion,
  winLossPolicy:
    resultK === undefined
      ? undefined
      : { k: resultK, retention: 0.8, homeField: 55, usesScoreMargin: false },
  sourceSha256,
  incumbentSha256: createHash('sha256')
    .update(await readFile(incumbentPath))
    .digest('hex'),
  components: componentNames,
  programContextSha256: programContextPath
    ? createHash('sha256')
        .update(await readFile(programContextPath))
        .digest('hex')
    : undefined,
  policy:
    'Nonnegative sum-to-one least-squares weights on earlier out-of-season component margins. Symmetric logistic calibration on earlier ensemble predictions whose weights excluded their season. No weighted probability averaging; no external ratings.',
  reconstruction: true,
  seedSeasons,
  testSeasons,
  limitation:
    'Reused development folds and reconstructed historical evidence, not an untouched holdout or proof of performance against SP+/FPI. Component internal settings remain fixed research policies.',
  champion: selection.champion.modelVersion,
  decisions: selection.decisions,
  reports: [incumbent, challenger].map(compact),
  fits,
  componentFits,
  finalFit,
  forecastSha256: createHash('sha256')
    .update(JSON.stringify(forecasts))
    .digest('hex'),
  forecasts: process.argv.includes('--retain-forecasts')
    ? forecasts
    : undefined,
}
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', {
  flag: 'wx',
})
const { forecasts: _retainedForecasts, ...summary } = output
console.log(JSON.stringify(summary, null, 2))
