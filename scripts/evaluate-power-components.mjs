import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { replayElo } from './lib/power-elo.mjs'
import { replayEfficiency } from './lib/power-efficiency.mjs'
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
  component = 'elo',
] = process.argv.slice(2)
if (!outputPath)
  throw new Error(
    'Usage: node scripts/evaluate-power-components.mjs <enriched-data.json> <incumbent-evaluation.json> <market-directory> <new-output.json> [elo|efficiency]',
  )
const buffer = await readFile(dataPath),
  sourceSha256 = createHash('sha256').update(buffer).digest('hex'),
  data = JSON.parse(buffer)
const baselineFile = JSON.parse(await readFile(incumbentPath, 'utf8'))
if (baselineFile.sourceSha256 !== sourceSha256)
  throw new Error('Incumbent and challenger inputs must match.')
const incumbent = baselineFile.reports[0].calibrated
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
  }))
const byId = new Map(games.map((g) => [g.id, g]))
// Earlier forecasts calibrate the Elo scale; the incumbent keeps its original weekly cutoffs.
const slateCutoffs = new Map()
for (const game of games.filter(
  (g) => g.homeClassification === 'fbs' || g.awayClassification === 'fbs',
)) {
  const key = `${game.season}:${game.seasonType}:${game.week}`
  slateCutoffs.set(
    key,
    Math.min(slateCutoffs.get(key) ?? Infinity, game.kickoffAt - 1),
  )
}
const training = games
  .filter(
    (g) =>
      g.season >= 2013 &&
      g.season < Math.min(...incumbent.forecasts.map((f) => f.season)) &&
      (g.homeClassification === 'fbs' || g.awayClassification === 'fbs'),
  )
  .map((g) => ({
    ...g,
    gameId: g.id,
    featureCutoffAt: slateCutoffs.get(`${g.season}:${g.seasonType}:${g.week}`),
    actualMargin: g.homePoints - g.awayPoints,
  }))
const requests = [
  ...training,
  ...incumbent.forecasts.map((f) => ({ ...byId.get(f.gameId), ...f })),
]
if (!['elo', 'efficiency'].includes(component))
  throw new Error('Unknown component')
const eloRaw =
  component === 'elo'
    ? replayElo(games, requests)
    : replayEfficiency(games, requests)
const rows = [],
  fits = []
for (const season of [
  ...new Set(incumbent.forecasts.map((f) => f.season)),
].sort((a, b) => a - b)) {
  const fit = fitPowerCalibration(
    eloRaw.filter((f) => f.season < season),
    season,
  )
  fits.push({ season, ...fit })
  rows.push(
    ...eloRaw
      .filter((f) => f.season === season)
      .map((f) => calibrateForecast(f, fit)),
  )
}
const reference = new Map(rows.map((f) => [f.gameId, f]))
const report = (modelVersion, forecasts) => {
  const evaluation = evaluateForecasts(forecasts)
  return {
    modelVersion,
    forecasts,
    evaluation,
    folds: Object.entries(evaluation.bySeason).map(([season, m]) => ({
      season: Number(season),
      ...m,
    })),
  }
}
const challengers = [
  report(`${component}-independent`, rows),
  ...[0.1, 0.2, 0.3].map((weight) =>
    report(
      `power-v5-${component}-${weight}`,
      incumbent.forecasts.map((f) => {
        const other = reference.get(f.gameId)
        if (!other || f.featureCutoffAt !== other.featureCutoffAt)
          throw new Error('Unmatched forecast cutoff')
        return {
          ...f,
          predictedMargin:
            (1 - weight) * f.predictedMargin + weight * other.predictedMargin,
          homeWinProbability:
            (1 - weight) * f.homeWinProbability +
            weight * other.homeWinProbability,
        }
      }),
    ),
  ),
]
const marketRows = []
for (const name of (await readdir(marketDirectory)).filter((f) =>
  /^market-\d{4}\.json$/.test(f),
))
  marketRows.push(
    ...JSON.parse(await readFile(`${marketDirectory}/${name}`, 'utf8')).rows,
  )
const market = marketMargins(marketRows, 'opening'),
  selection = chooseEarlyPowerChampion(incumbent, challengers, market)
const compact = (r) => ({
  modelVersion: r.modelVersion,
  overall: r.evaluation.overall,
  early: r.evaluation.byWeekRange.weeks_1_4,
  folds: r.folds.map(
    ({ season, marginMae, brier, expectedCalibrationError }) => ({
      season,
      marginMae,
      brier,
      expectedCalibrationError,
    }),
  ),
  opening: compareMarketMargins(r.forecasts, market).early,
})
const output = {
  sourceSha256,
  policy:
    component === 'elo'
      ? { k: 24, retention: 0.8, homeFieldElo: 55, marginConversion: 25 }
      : {
          historySeasons: 3,
          annualWeight: 0.5,
          shrinkagePlays: 150,
          maximumGamePlays: 80,
          iterations: 35,
          ppaToPoints: 65,
          homeFieldPoints: 2.5,
        },
  training:
    'Earlier seasons only; six-hour completion buffer. Fixed 10/20/30% blend candidates; reused historical folds, not prospective proof.',
  champion: selection.champion.modelVersion,
  decisions: selection.decisions,
  reports: [incumbent, ...challengers].map(compact),
  fits,
}
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', {
  flag: 'wx',
})
console.log(
  JSON.stringify({
    champion: output.champion,
    decisions: output.decisions,
    metrics: output.reports.map((r) => ({
      version: r.modelVersion,
      mae: r.overall.marginMae,
      earlyMae: r.early.marginMae,
      brier: r.overall.brier,
    })),
  }),
)
