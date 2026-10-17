import { createHash } from 'node:crypto'
import { readFile, realpath, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  assertSnapshotCanReplace,
  normalizeParticipationName,
  sameParticipationCounts,
  validateParticipationImport,
} from '../convex/participationModel.ts'

// Read-only by default. Credentials are read from the environment, never arguments.
const [inputPath, deploymentUrl, ...flags] = process.argv.slice(2)
if (!inputPath || !deploymentUrl || flags.some((flag) => flag !== '--apply')) {
  throw new Error(
    'Usage: node --experimental-strip-types scripts/import-participation.mjs <input.json> <https://deployment.convex.cloud> [--apply]',
  )
}
const url = new URL(deploymentUrl)
if (
  url.protocol !== 'https:' ||
  !url.hostname.endsWith('.convex.cloud') ||
  url.username ||
  url.password
)
  throw new Error('Use an explicit HTTPS Convex deployment URL.')
const input = JSON.parse(await readFile(inputPath, 'utf8'))
validateParticipationImport(input)
const client = new ConvexHttpClient(url.origin)
const query = (name, args) => client.query(makeFunctionReference(name), args)
const mutate = (name, args) =>
  client.mutation(makeFunctionReference(name), args)
const roster = await query('rosters:getSeasonDashboard', {
  season: input.season,
})
if (!roster) throw new Error('Michigan roster not found.')
let unresolved = false
for (const row of input.rows) {
  const matches = roster.entries.filter(
    ({ player, season }) =>
      player &&
      (row.playerId
        ? player._id === row.playerId
        : season.jerseyNumber === row.jerseyNumber &&
          [player.displayName, player.canonicalName].some(
            (name) =>
              normalizeParticipationName(name) ===
              normalizeParticipationName(row.name),
          )),
  )
  if (matches.length !== 1) {
    unresolved = true
    console.log(
      JSON.stringify({
        review: row.name,
        candidates: roster.entries
          .filter(
            ({ player, season }) =>
              player &&
              (season.jerseyNumber === row.jerseyNumber ||
                player.displayName.split(' ')[0] === row.name.split(' ')[0]),
          )
          .map(({ player, season }) => ({
            playerId: player._id,
            name: player.displayName,
            jersey: season.jerseyNumber,
            position: season.listedPosition,
          })),
      }),
    )
  }
  if (matches.length === 1)
    assertSnapshotCanReplace(
      { ...row, throughTeamGames: input.throughTeamGames },
      matches[0].season.participationTotals?.[input.phase],
    )
  console.log(
    JSON.stringify({
      name: row.name,
      jersey: row.jerseyNumber,
      games: row.gamesPlayed,
      snaps: row.snaps,
      matches: matches.map(({ player, season }) => ({
        playerId: player._id,
        name: player.displayName,
        previous: season.participationTotals?.[input.phase] ?? null,
      })),
    }),
  )
}
console.log(
  JSON.stringify({
    target: url.origin,
    season: input.season,
    phase: input.phase,
    throughTeamGames: input.throughTeamGames,
    players: input.rows.length,
    playerSnaps: input.rows.reduce((sum, row) => sum + row.snaps, 0),
    unresolved,
  }),
)
if (unresolved)
  throw new Error(
    'Resolve unmatched/ambiguous identities in the input using reviewed playerIds; no data was written.',
  )
if (flags.includes('--apply')) {
  const sessionToken = process.env.CFB26_OWNER_SESSION
  const backupDirectory = process.env.CFB26_BACKUP_DIRECTORY
  if (!sessionToken || !backupDirectory)
    throw new Error(
      'Apply requires CFB26_OWNER_SESSION and an existing CFB26_BACKUP_DIRECTORY outside the repository.',
    )
  const backupRoot = await realpath(backupDirectory)
  const repoRoot = await realpath(resolve(import.meta.dirname, '..'))
  if (
    backupRoot.toLowerCase() === repoRoot.toLowerCase() ||
    backupRoot.toLowerCase().startsWith(`${repoRoot.toLowerCase()}/`) ||
    backupRoot.toLowerCase().startsWith(`${repoRoot.toLowerCase()}\\`)
  )
    throw new Error('Backups must be outside the repository.')
  const plan = await query('rosterAdmin:previewParticipationImport', {
    ...input,
    sessionToken,
  })
  if (plan.errors.length) throw new Error(plan.errors.join('\n'))
  const datasets = {}
  for (const dataset of [
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
  ]) {
    const rows = []
    let cursor = null
    do {
      const page = await query('rosterAdmin:exportMichiganPage', {
        cursor,
        dataset,
        numItems: 100,
        sessionToken,
      })
      rows.push(...page.page)
      cursor = page.isDone ? null : page.continueCursor
    } while (cursor)
    datasets[dataset] = rows
  }
  const core = { dataRevision: plan.dataRevision, datasets, schemaVersion: '3' }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(core))
    .digest('hex')
  const backupPath = resolve(
    backupRoot,
    `michigan-${url.hostname}-${Date.now()}.json`,
  )
  await writeFile(
    backupPath,
    JSON.stringify(
      { ...core, exportedAt: new Date().toISOString(), fingerprint },
      null,
      2,
    ),
    { flag: 'wx' },
  )
  const backupManifestId = await mutate('rosterAdmin:createBackupManifest', {
    counts: Object.entries(datasets).map(([dataset, rows]) => ({
      dataset,
      count: rows.length,
    })),
    dataRevision: plan.dataRevision,
    fingerprint,
    reason: 'Before screenshot season participation import',
    schemaVersion: '3',
    sessionToken,
  })
  const result = await mutate('rosterAdmin:applyParticipationImport', {
    ...input,
    sessionToken,
    backupManifestId,
    expectedRevision: plan.dataRevision,
  })
  const after = await query('rosterAdmin:previewParticipationImport', {
    ...input,
    sessionToken,
  })
  if (
    after.errors.length ||
    after.rows.length !== input.rows.length ||
    after.rows.some(
      (row) =>
        !row.before ||
        row.before.sourceImageSha256 !== input.sourceImageSha256 ||
        row.before.sourceLabel !== input.sourceLabel ||
        row.before.throughTeamGames !== input.throughTeamGames ||
        !sameParticipationCounts(row.before, row.after),
    )
  )
    throw new Error(
      'Import returned, but read-back verification failed. Inspect the backup and deployment.',
    )
  console.log(
    JSON.stringify({
      ...result,
      backupPath,
      verifiedPlayers: after.rows.length,
    }),
  )
}
