import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { prepareMichiganMigration } from '../convex/migrationV2.ts'

const [input, output, seasonArg] = process.argv.slice(2)
if (!input || !output) {
  console.error(
    'Usage: npm run migration:prepare -- <legacy-export.json> <new-output-directory> [current-season]',
  )
  process.exitCode = 1
} else {
  const inputPath = resolve(input)
  const outputPath = resolve(output)
  const source = await readFile(inputPath, 'utf8')
  const parsed = JSON.parse(source)
  for (const key of [
    'players',
    'rosterStints',
    'draftOutcomes',
    'seasonalPlayerStats',
  ]) {
    if (!Array.isArray(parsed[key])) throw new Error(`${key} must be an array.`)
  }
  const currentSeason = Number(seasonArg ?? new Date().getUTCFullYear())
  if (
    !Number.isInteger(currentSeason) ||
    currentSeason < 2015 ||
    currentSeason > 2100
  ) {
    throw new Error(
      'Current season must be a whole year from 2015 through 2100.',
    )
  }
  const migration = prepareMichiganMigration(parsed, currentSeason)
  await mkdir(outputPath, { recursive: false })
  for (const [dataset, rows] of Object.entries(migration.datasets)) {
    const jsonLines = rows.map((row) => JSON.stringify(row)).join('\n')
    await writeFile(
      resolve(outputPath, `${dataset}.jsonl`),
      jsonLines ? `${jsonLines}\n` : '',
      { flag: 'wx' },
    )
  }
  await writeFile(
    resolve(outputPath, 'migration-report.json'),
    `${JSON.stringify(
      {
        audit: migration.audit,
        inputFingerprint: createHash('sha256').update(source).digest('hex'),
        schemaVersion: '2',
        unresolved: migration.unresolved,
      },
      null,
      2,
    )}\n`,
    { flag: 'wx' },
  )
  console.log(
    JSON.stringify(
      { ...migration.audit, unresolved: migration.unresolved.length },
      null,
      2,
    ),
  )
}
