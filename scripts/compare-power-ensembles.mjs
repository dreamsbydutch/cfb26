import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { evaluateForecasts } from '../convex/ratingBacktest.ts'
import {
  chooseEarlyPowerChampion,
  marketMargins,
} from '../convex/powerBenchmarks.ts'

const [incumbentPath, challengerPath, marketDirectory, outputPath] =
  process.argv.slice(2)
if (!outputPath)
  throw new Error(
    'Usage: node scripts/compare-power-ensembles.mjs <incumbent-with-forecasts.json> <challenger-with-forecasts.json> <market-directory> <new-output.json>',
  )
const sources = await Promise.all(
  [incumbentPath, challengerPath].map((path) => readFile(path)),
)
const [incumbent, challenger] = sources.map((buffer) => JSON.parse(buffer))
if (
  incumbent.sourceSha256 !== challenger.sourceSha256 ||
  !incumbent.forecasts?.length ||
  !challenger.forecasts?.length
)
  throw new Error(
    'Comparison requires matching source data and retained forecasts.',
  )
for (const artifact of [incumbent, challenger])
  if (
    createHash('sha256')
      .update(JSON.stringify(artifact.forecasts))
      .digest('hex') !== artifact.forecastSha256
  )
    throw new Error('Forecast fingerprint mismatch.')
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
const selected = chooseEarlyPowerChampion(
  report(incumbent, 'released-program-context'),
  [report(challenger, 'sustained-program-context')],
  marketMargins(marketRows, 'opening'),
)
const { forecasts: _forecasts, ...candidateEvidence } = challenger
const output = {
  sourceSha256: incumbent.sourceSha256,
  incumbentForecastSha256: incumbent.forecastSha256,
  challengerForecastSha256: challenger.forecastSha256,
  champion: selected.champion.modelVersion,
  decisions: selected.decisions,
  incumbent: incumbent.reports.at(-1),
  challenger: candidateEvidence,
  limitation:
    'Reused historical development folds and reconstructed source availability, not untouched prospective validation. Promotion is assessed against the currently released ensemble, not merely its older foundation.',
}
await writeFile(outputPath, JSON.stringify(output, null, 2) + '\n', {
  flag: 'wx',
})
console.log(
  JSON.stringify({ champion: output.champion, decisions: output.decisions }),
)
