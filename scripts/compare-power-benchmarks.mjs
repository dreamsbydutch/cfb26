import { readFile, writeFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {
  marketMargins,
  compareMarketMargins,
} from '../convex/powerBenchmarks.ts'

const [reportPath, directory, outputPath] = process.argv.slice(2)
if (!reportPath || !directory || !outputPath)
  throw new Error(
    'Usage: node scripts/compare-power-benchmarks.mjs <evaluation.json> <benchmark-directory> <new-report.json>',
  )
const report = JSON.parse(await readFile(reportPath, 'utf8')),
  files = (await readdir(directory))
    .filter((f) => /^market-\d{4}\.json$/.test(f))
    .sort(),
  rows = [],
  sources = []
for (const file of files) {
  const buffer = await readFile(`${directory}/${file}`),
    data = JSON.parse(buffer)
  rows.push(...data.rows)
  sources.push({
    file,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    observedAt: data.observedAt,
  })
}
const models = report.reports.map((r) => r.calibrated ?? r)
const opening = marketMargins(rows, 'opening'),
  archived = marketMargins(rows, 'archived')
const result = {
  source: 'CFBD historical market quotes',
  timing:
    'Opening and archived spreads have no exact quote timestamps. Model forecasts freeze before the weekly slate; archived market quotes can have later information. This is a retrospective matched-game benchmark, not an equal-information betting test.',
  sources,
  models: models.map((r) => ({
    modelVersion: r.modelVersion,
    opening: compareMarketMargins(r.forecasts, opening),
    archived: compareMarketMargins(r.forecasts, archived),
  })),
}
await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n', {
  flag: 'wx',
})
console.log(
  JSON.stringify(
    result.models.map((m) => ({
      model: m.modelVersion,
      opening: m.opening.early,
      archived: m.archived.early,
    })),
  ),
)
