import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

const NAME_ALIASES = new Map([
  ['James Hudson III', 'James Hudson'],
  ['Randy Keumogne', 'Randy Keumonge'],
])

function option(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  if (index !== -1) return process.argv[index + 1]
  const assignment = process.argv.find((value) =>
    value.startsWith(`--${name}=`),
  )
  return assignment ? assignment.slice(name.length + 3) : fallback
}

function requiredOption(name, positionalIndex) {
  const positional = process.argv
    .slice(2)
    .filter((value) => !value.startsWith('--'))
  const value = option(name, positional[positionalIndex])
  if (!value) throw new Error(`Missing required --${name} path.`)
  return resolve(value)
}

function numberField(row, field) {
  const value = Number(row[field])
  if (!Number.isFinite(value)) {
    throw new Error(`${row.Player} ${row.Year} has an invalid ${field}.`)
  }
  return value
}

function sourceKey(row) {
  const player = row.Player.toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return `pff:${row.Year}:${player}`
}

const sourcePath = resolve(option('source', 'SnapCounts.json'))
const playersPath = requiredOption('players', 0)
const programsPath = requiredOption('programs', 1)
const outputPath = resolve(option('output', '.tmp/seasonal-player-stats.json'))

const [sourceRows, players, programs] = await Promise.all(
  [sourcePath, playersPath, programsPath].map(async (path) =>
    JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, '')),
  ),
)

if (!Array.isArray(sourceRows) || !Array.isArray(players)) {
  throw new Error('The source and player exports must be JSON arrays.')
}

const michigan = programs.find((program) => program.key === 'michigan')
if (!michigan) throw new Error('The program export has no michigan record.')

const playersByName = new Map(
  players.map((player) => [player.displayName, player]),
)
const keys = new Set()
const linkedNames = new Set()
const unlinkedNames = new Set()

const documents = sourceRows.map((row) => {
  const key = sourceKey(row)
  if (keys.has(key)) throw new Error(`Duplicate source key: ${key}`)
  keys.add(key)

  const canonicalName = NAME_ALIASES.get(row.Player) ?? row.Player
  const player = playersByName.get(canonicalName)
  if (player) linkedNames.add(row.Player)
  else unlinkedNames.add(row.Player)

  const phase = row.Phase === 'O' ? 'offense' : 'defense'
  if (row.Phase !== 'O' && row.Phase !== 'D') {
    throw new Error(`${row.Player} ${row.Year} has an invalid phase.`)
  }

  return {
    compositeRating: numberField(row, 'CmpRtg'),
    gamesPlayed: numberField(row, 'GP'),
    phase,
    ...(player ? { playerId: player._id } : {}),
    pffRating: numberField(row, 'Rtg'),
    position: row.Pos,
    programId: michigan._id,
    recruitingSeason: numberField(row, 'RYr'),
    recruitingType: row.RType,
    season: numberField(row, 'Year'),
    snaps: numberField(row, 'Snaps'),
    sourceKey: key,
    sourceNumber: row.Number,
    sourcePlayerName: row.Player,
  }
})

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(documents, null, 2)}\n`)

console.log(`Prepared ${documents.length} seasonal stat rows.`)
console.log(
  `Linked ${linkedNames.size} source names; preserved ${unlinkedNames.size} as source-only names.`,
)
console.log(`Wrote ${outputPath}`)
