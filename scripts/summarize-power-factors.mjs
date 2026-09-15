import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { evaluateForecasts } from '../convex/ratingBacktest.ts'
import {
  chooseEarlyPowerChampion,
  marketMargins,
  compareMarketMargins,
} from '../convex/powerBenchmarks.ts'

const [incumbentPath, marketDirectory, outputPath, ...directories] =
  process.argv.slice(2)
if (!outputPath || !directories.length)
  throw new Error(
    'Usage: node scripts/summarize-power-factors.mjs <incumbent.json> <market-directory> <new-output.json> <result-directory> ...',
  )
const hash = (x) => createHash('sha256').update(x).digest('hex')
const incumbent = JSON.parse(await readFile(incumbentPath))
if (hash(JSON.stringify(incumbent.forecasts)) !== incumbent.forecastSha256)
  throw new Error('Invalid incumbent fingerprint.')
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
const benchmarkSha256 = Object.fromEntries(
  marketFiles.map((n, i) => [n, hash(marketBuffers[i])]),
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
const metrics = ({
  count,
  marginMae,
  brier,
  winnerAccuracy,
  expectedCalibrationError,
}) => ({ count, marginMae, brier, winnerAccuracy, expectedCalibrationError })
const compact = (r) => ({
  modelVersion: r.modelVersion,
  overall: metrics(r.evaluation.overall),
  early: metrics(r.evaluation.byWeekRange.weeks_1_4),
  folds: r.folds.map((f) => ({ season: f.season, ...metrics(f) })),
  opening: compareMarketMargins(r.forecasts, market),
})
const baseline = report(incumbent.forecasts, 'released-power-v6')
const candidates = [],
  reports = [],
  campaigns = []
const seen = new Set()
for (const directory of directories) {
  const buffer = await readFile(`${directory}/summary.json`),
    summary = JSON.parse(buffer)
  if (
    !summary.baselineReproducedExactly ||
    summary.sourceSha256 !== incumbent.sourceSha256 ||
    summary.incumbentForecastSha256 !== incumbent.forecastSha256 ||
    JSON.stringify(summary.benchmarkSha256) !== JSON.stringify(benchmarkSha256)
  )
    throw new Error('Campaign source or benchmark mismatch.')
  campaigns.push({
    summarySha256: hash(buffer),
    componentSha256: summary.componentSha256,
    coverage: summary.coverage,
    supplementaryCoverage: summary.supplementaryCoverage,
    supplementarySha256: summary.supplementarySha256,
    unavailable: summary.unavailable,
  })
  for (const candidate of summary.candidates) {
    if (
      !/^[a-z0-9-]+$/.test(candidate.candidateName) ||
      seen.has(candidate.candidateName)
    )
      throw new Error('Invalid or duplicate candidate identity.')
    seen.add(candidate.candidateName)
    const artifact = JSON.parse(
      await readFile(`${directory}/${candidate.candidateName}.json`),
    )
    if (
      artifact.sourceSha256 !== incumbent.sourceSha256 ||
      artifact.forecastSha256 !== candidate.forecastSha256 ||
      hash(JSON.stringify(artifact.forecasts)) !== artifact.forecastSha256
    )
      throw new Error('Candidate forecast fingerprint mismatch.')
    const r = report(artifact.forecasts, candidate.candidateName)
    reports.push(r)
    const fit = candidate.finalFit.weights
    candidates.push({
      name: candidate.candidateName,
      policy: candidate.policy,
      componentNames: candidate.componentNames,
      forecastSha256: candidate.forecastSha256,
      report: compact(r),
      finalWeights: fit,
      folds: candidate.fits.map((f) => ({
        season: f.season,
        weights: f.weights,
        calibration: f.calibration,
      })),
      residualFits: candidate.residualFits,
      pointFits: candidate.pointFits?.map(({ season, fit: f }) => ({
        season,
        scale: f.scale,
        homeOffset: f.homeOffset,
        trainingSeasons: f.trainingSeasons,
      })),
    })
  }
}
const selection = chooseEarlyPowerChampion(baseline, reports, market)
const output = {
  sourceSha256: incumbent.sourceSha256,
  incumbentForecastSha256: incumbent.forecastSha256,
  benchmarkSha256,
  testSeasons: incumbent.testSeasons,
  campaigns,
  baseline: compact(baseline),
  candidates,
  champion: selection.champion.modelVersion,
  decisions: selection.decisions,
  limitation:
    'Exploratory reused development folds with historical source reconstruction. Six families were screened through explicit proxies, not exhaustive implementations. No injuries, starter changes, recovery luck, complete special-teams EPA, or finishing-drive opportunities were tested. No external ratings are model inputs. Learned contributions and probabilities exclude their forecast season. A no-factor recalibration control separates additional calibration flexibility from feature evidence. No production model was changed.',
}
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', {
  flag: 'wx',
})
console.log(
  JSON.stringify(
    {
      champion: output.champion,
      candidates: candidates.map((c) => ({
        name: c.name,
        mae: c.report.overall.marginMae,
        brier: c.report.overall.brier,
        earlyMae: c.report.early.marginMae,
        earlyBrier: c.report.early.brier,
        accepted: selection.decisions[c.name].accepted,
      })),
    },
    null,
    2,
  ),
)
