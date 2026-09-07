import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { planMichiganMigration } from '../convex/migrationV2.ts'

function usage() {
  console.error(
    'Usage: npm run migration:plan -- <legacy-export.json> [--write <plan.json>]',
  )
  process.exitCode = 1
}

const [input, flag, output] = process.argv.slice(2)
if (!input || (flag && flag !== '--write') || (flag === '--write' && !output)) {
  usage()
} else {
  const inputPath = resolve(input)
  const source = await readFile(inputPath, 'utf8')
  const parsed = JSON.parse(source)
  const required = [
    'players',
    'rosterStints',
    'draftOutcomes',
    'seasonalPlayerStats',
  ]
  for (const key of required) {
    if (!Array.isArray(parsed[key])) throw new Error(`${key} must be an array.`)
  }
  const plan = planMichiganMigration(parsed)
  const serialized = JSON.stringify(
    {
      ...plan,
      metadata: {
        generatedAt: new Date().toISOString(),
        inputFingerprint: createHash('sha256').update(source).digest('hex'),
        schemaVersion: '2',
      },
    },
    null,
    2,
  )
  console.log(
    JSON.stringify(
      { ...plan.audit, unresolved: plan.unresolved.length },
      null,
      2,
    ),
  )
  if (flag === '--write' && output) {
    const outputPath = resolve(output)
    await writeFile(outputPath, `${serialized}\n`, { flag: 'wx' })
    console.log(`Wrote migration plan to ${outputPath}`)
  } else {
    console.log(
      'Dry run only. Pass --write <plan.json> to create a non-overwriting plan file.',
    )
  }
}
