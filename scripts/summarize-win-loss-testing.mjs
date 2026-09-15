import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { evaluateForecasts } from '../convex/ratingBacktest.ts'
import {
  chooseEarlyPowerChampion,
  marketMargins,
} from '../convex/powerBenchmarks.ts'

const [
  dataPath,
  incumbentPath,
  marketDirectory,
  outputPath,
  ...candidatePaths
] = process.argv.slice(2)
if (!outputPath || !candidatePaths.length)
  throw new Error(
    'Usage: node scripts/summarize-win-loss-testing.mjs <enriched.json> <released-ensemble.json> <market-directory> <new-report.json> <candidate.json> [...]',
  )
const buffer = await readFile(dataPath),
  data = JSON.parse(buffer)
const sourceSha256 = createHash('sha256').update(buffer).digest('hex')
const artifacts = await Promise.all(
  [incumbentPath, ...candidatePaths].map(async (path) =>
    JSON.parse(await readFile(path, 'utf8')),
  ),
)
for (const artifact of artifacts) {
  if (
    artifact.sourceSha256 !== sourceSha256 ||
    !artifact.forecasts?.length ||
    createHash('sha256')
      .update(JSON.stringify(artifact.forecasts))
      .digest('hex') !== artifact.forecastSha256
  )
    throw new Error('Mismatched source or forecast fingerprint.')
}
const report = (artifact, modelVersion) => {
  const evaluation = evaluateForecasts(artifact.forecasts)
  return {
    modelVersion,
    forecasts: artifact.forecasts,
    evaluation,
    folds: Object.entries(evaluation.bySeason).map(([season, metrics]) => ({
      season: Number(season),
      ...metrics,
    })),
  }
}
const baseline = report(artifacts[0], 'released-power-v6')
const candidates = artifacts.slice(1).map((a) => report(a, a.candidateName))
const marketRows = (
  await Promise.all(
    (await readdir(marketDirectory))
      .filter((name) => /^market-\d{4}\.json$/.test(name))
      .map(
        async (name) =>
          JSON.parse(await readFile(`${marketDirectory}/${name}`, 'utf8')).rows,
      ),
  )
).flat()
const selection = chooseEarlyPowerChampion(
  baseline,
  candidates,
  marketMargins(marketRows, 'opening'),
)
const games = new Map(data.games.map((g) => [String(g.sourceGameId), g]))
const completed = data.games
  .filter(
    (g) =>
      g.completed &&
      Number.isFinite(g.homePoints) &&
      Number.isFinite(g.awayPoints),
  )
  .sort((a, b) => b.startTime - a.startTime)
const histories = new Map()
for (const game of completed)
  for (const id of [game.homeProgramId, game.awayProgramId]) {
    const key = `${game.season}:${id}`
    if (!histories.has(key)) histories.set(key, [])
    histories.get(key).push(game)
  }
const previousWinMargin = (row) => {
  const game = games.get(row.gameId)
  if (!game) throw new Error('Missing forecast game.')
  return [game.homeProgramId, game.awayProgramId].map((id) => {
    const previous = (histories.get(`${row.season}:${id}`) ?? []).find(
      (g) =>
        g.season === row.season &&
        g.startTime + 6 * 3600000 < row.featureCutoffAt &&
        [g.homeProgramId, g.awayProgramId].includes(id),
    )
    if (!previous || row.kickoffAt - previous.startTime > 21 * 86400000)
      return undefined
    return previous.homeProgramId === id
      ? previous.homePoints - previous.awayPoints
      : previous.awayPoints - previous.homePoints
  })
}
const narrowIds = new Set(
  baseline.forecasts
    .filter((row) => previousWinMargin(row).some((m) => m > 0 && m <= 3))
    .map((row) => row.gameId),
)
const onePointIds = new Set(
  baseline.forecasts
    .filter((row) => previousWinMargin(row).some((m) => m === 1))
    .map((row) => row.gameId),
)
const compact = (r, artifact) => ({
  modelVersion: r.modelVersion,
  overall: r.evaluation.overall,
  early: r.evaluation.byWeekRange.weeks_1_4,
  afterNarrowWin: evaluateForecasts(
    r.forecasts.filter((row) => narrowIds.has(row.gameId)),
  ).overall,
  afterOnePointWin: evaluateForecasts(
    r.forecasts.filter((row) => onePointIds.has(row.gameId)),
  ).overall,
  folds: r.folds,
  forecastSha256: artifact.forecastSha256,
  finalFit: artifact.finalFit,
  annualFits: artifact.fits,
  winLossPolicy: artifact.winLossPolicy,
})
const output = {
  sourceSha256,
  reconstruction: true,
  testSeasons: artifacts[0].testSeasons,
  champion: selection.champion.modelVersion,
  decisions: selection.decisions,
  cohortDefinition:
    'Either team won its most recent completed same-season game by 1–3 points (or exactly one), within 21 days; the previous game must finish at least six hours before the forecast cutoff. Each upcoming game counts once.',
  policy:
    'Three prespecified Elo update rates (12, 24, 48), with retention 0.8 and home field 55. No margin multiplier. Earlier seasons fit component calibration, nonnegative ensemble weights, and cross-fitted combined probabilities. FCS point forecasts retain the released fallback.',
  limitation:
    'Reused development folds and reconstructed data availability, not untouched prospective validation. This tests this family of result-only signals, not every possible use of wins. Close-win cohorts are diagnostic, not promotion targets.',
  reports: [baseline, ...candidates].map((r, i) => compact(r, artifacts[i])),
}
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', {
  flag: 'wx',
})
console.log(
  JSON.stringify(
    {
      champion: output.champion,
      decisions: output.decisions,
      metrics: output.reports.map((r) => ({
        model: r.modelVersion,
        mae: r.overall.marginMae,
        brier: r.overall.brier,
        earlyMae: r.early.marginMae,
        earlyBrier: r.early.brier,
        narrowMae: r.afterNarrowWin.marginMae,
        narrowBrier: r.afterNarrowWin.brier,
        onePointMae: r.afterOnePointWin.marginMae,
        onePointBrier: r.afterOnePointWin.brier,
        weights: r.finalFit.weights.weights,
      })),
    },
    null,
    2,
  ),
)
