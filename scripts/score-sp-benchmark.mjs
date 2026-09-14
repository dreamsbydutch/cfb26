import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {
  compareMarketMargins,
  scoreExternalForecasts,
} from '../convex/powerBenchmarks.ts'

const [snapshotPath, reportPath, outputPath] = process.argv.slice(2)
if (!snapshotPath || !reportPath || !outputPath)
  throw new Error(
    'Usage: node scripts/score-sp-benchmark.mjs <frozen-SP-forecasts.json> <model-evaluation.json> <new-output.json>',
  )
const buffer = await readFile(snapshotPath),
  snapshot = JSON.parse(buffer),
  report = JSON.parse(await readFile(reportPath, 'utf8'))
if (snapshot.publisherEdition?.status !== 'verified')
  throw new Error(
    'Cannot score this as a current SP+ benchmark: publisher edition is unverified. Preserve the archive, but obtain a verified edition.',
  )
const frozen = new Map()
for (const row of snapshot.forecasts) {
  if (
    frozen.has(row.gameId) ||
    !Number.isFinite(row.predictedMargin) ||
    !Number.isFinite(row.observedAt) ||
    !Number.isFinite(row.kickoffAt) ||
    row.observedAt >= row.kickoffAt
  )
    throw new Error('Invalid frozen benchmark.')
  frozen.set(row.gameId, row)
}
const models = report.reports.map((r) => {
  const model = r.calibrated ?? r
  const rows = model.forecasts.filter((f) => {
    const reference = frozen.get(f.gameId)
    return (
      reference &&
      f.season === reference.season &&
      f.neutralSite === reference.neutralSite &&
      f.kickoffAt === reference.kickoffAt &&
      f.kickoffAt < Date.now() &&
      reference.observedAt <= f.featureCutoffAt
    )
  })
  // The SP+ snapshot must have been available by the model forecast cutoff.
  scoreExternalForecasts(
    rows.map((f) => ({ ...f, observedAt: frozen.get(f.gameId).observedAt })),
  )
  const scored = compareMarketMargins(
    rows,
    new Map([...frozen].map(([id, f]) => [id, f.predictedMargin])),
  )
  return {
    modelVersion: model.modelVersion,
    observedForecasts: frozen.size,
    matchedOutcomes: rows.length,
    pendingOrUnmatched: frozen.size - rows.length,
    marginComparison: scored,
    maximumObservationTimeDifferenceHours: rows.length
      ? Math.max(
          ...rows.map(
            (f) =>
              Math.abs(f.featureCutoffAt - frozen.get(f.gameId).observedAt) /
              3600000,
          ),
        )
      : null,
  }
})
const result = {
  source: snapshot.source,
  sourceSha256: createHash('sha256').update(buffer).digest('hex'),
  venueAssumption: snapshot.venueAssumption,
  interpretation:
    'The market fields contain SP+-derived margins. No SP+ win probabilities are invented. Observation times may differ; compare the reported timing gap.',
  models,
}
await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
})
console.log(JSON.stringify(result))
