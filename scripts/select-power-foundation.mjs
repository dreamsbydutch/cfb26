import { readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import {
  chooseEarlyPowerChampion,
  marketMargins,
} from '../convex/powerBenchmarks.ts'

const [directory, outputPath, ...paths] = process.argv.slice(2)
if (!directory || !outputPath || paths.length < 2)
  throw new Error(
    'Usage: node scripts/select-power-foundation.mjs <benchmark-directory> <new-output.json> <incumbent-report.json> <challenger-report.json> [...]',
  )
const inputs = await Promise.all(
  paths.map(async (path) => {
    const buffer = await readFile(path)
    return {
      path,
      sha256: createHash('sha256').update(buffer).digest('hex'),
      data: JSON.parse(buffer),
    }
  }),
)
if (new Set(inputs.map((i) => i.data.sourceSha256)).size !== 1)
  throw new Error('All evaluations must use the same source data.')
const reports = inputs.flatMap((i) => i.data.reports.map((r) => r.calibrated))
if (new Set(reports.map((r) => r.modelVersion)).size !== reports.length)
  throw new Error('Duplicate model version.')
const files = (await readdir(directory))
    .filter((f) => /^market-\d{4}\.json$/.test(f))
    .sort(),
  rows = [],
  sources = []
for (const file of files) {
  const buffer = await readFile(`${directory}/${file}`)
  rows.push(...JSON.parse(buffer).rows)
  sources.push({
    file,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  })
}
const selection = chooseEarlyPowerChampion(
  reports[0],
  reports.slice(1),
  marketMargins(rows, 'opening'),
)
const summary = {
  champion: selection.champion.modelVersion,
  decisions: selection.decisions,
  inputs: inputs.map(({ path, sha256 }) => ({ path, sha256 })),
  sources,
  sourceSha256: inputs[0].data.sourceSha256,
  reconstruction: true,
  benchmark:
    'Opening spreads, common early-season games. Quotes lack timestamps; this is not an equal-information betting test.',
}
await writeFile(outputPath, JSON.stringify(summary, null, 2) + '\n', {
  flag: 'wx',
})
console.log(JSON.stringify(summary))
