import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import process from 'node:process'

const RESTORE_ORDER = [
  'players',
  'commitments',
  'rosterStints',
  'playerSeasons',
  'evaluations',
  'movementEvents',
  'draftOutcomes',
  'playerGames',
  'nflIdentities',
  'nflWeeklyRosters',
  'nflPlayerGames',
  'nflSeasonSummaries',
  'providerIdentities',
  'seasonRules',
  'unresolvedMatches',
]

function fail(message) {
  console.error(message)
  console.error(
    'Usage: npm run restore:prepare -- <backup.json> <new-output-directory>',
  )
  process.exitCode = 1
}

const [input, output] = process.argv.slice(2)
if (!input || !output) {
  fail('A backup file and output directory are required.')
} else {
  const inputPath = resolve(input)
  const outputPath = resolve(output)
  const parsed = JSON.parse(await readFile(inputPath, 'utf8'))
  if (parsed.schemaVersion !== '2' || typeof parsed.datasets !== 'object') {
    throw new Error('Only CFB26 Michigan backup schema version 2 is supported.')
  }
  if (typeof parsed.fingerprint !== 'string') {
    throw new Error('The backup does not contain a SHA-256 fingerprint.')
  }

  const canonical = JSON.stringify({
    schemaVersion: parsed.schemaVersion,
    datasets: parsed.datasets,
  })
  const actual = createHash('sha256').update(canonical).digest('hex')
  if (actual !== parsed.fingerprint) {
    throw new Error('Backup fingerprint mismatch; restore preparation stopped.')
  }

  for (const dataset of RESTORE_ORDER) {
    if (!Array.isArray(parsed.datasets[dataset])) {
      throw new Error(`Backup dataset ${dataset} is missing or invalid.`)
    }
  }
  const unexpected = Object.keys(parsed.datasets).filter(
    (dataset) => !RESTORE_ORDER.includes(dataset),
  )
  if (unexpected.length > 0) {
    throw new Error(`Unexpected backup datasets: ${unexpected.join(', ')}`)
  }

  await mkdir(outputPath, { recursive: false })
  for (const dataset of RESTORE_ORDER) {
    const rows = parsed.datasets[dataset]
    const jsonLines = rows.map((row) => JSON.stringify(row)).join('\n')
    await writeFile(
      resolve(outputPath, `${dataset}.jsonl`),
      jsonLines.length > 0 ? `${jsonLines}\n` : '',
      { flag: 'wx' },
    )
  }
  await writeFile(
    resolve(outputPath, 'restore-manifest.json'),
    `${JSON.stringify(
      {
        fingerprint: actual,
        input: basename(inputPath),
        restoreOrder: RESTORE_ORDER,
        schemaVersion: parsed.schemaVersion,
        verifiedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  )
  console.log(
    JSON.stringify(
      {
        datasets: RESTORE_ORDER.length,
        fingerprint: actual,
        outputDirectory: outputPath,
        rows: RESTORE_ORDER.reduce(
          (total, dataset) => total + parsed.datasets[dataset].length,
          0,
        ),
      },
      null,
      2,
    ),
  )
}
