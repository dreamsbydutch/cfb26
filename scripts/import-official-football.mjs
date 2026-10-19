import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, realpath, writeFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { isDeepStrictEqual } from 'node:util'
import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import { derivePositionRoom } from '../convex/playerDomain.ts'

const [inputPath, deploymentUrl, ...flags] = process.argv.slice(2)
if (!inputPath || !deploymentUrl || flags.some((flag) => flag !== '--apply'))
  throw new Error(
    'Usage: node --experimental-strip-types scripts/import-official-football.mjs <reviewed-import.json> <https://deployment.convex.cloud> [--apply]',
  )
const url = new URL(deploymentUrl)
if (
  url.protocol !== 'https:' ||
  !url.hostname.endsWith('.convex.cloud') ||
  url.username ||
  url.password ||
  url.pathname !== '/'
)
  throw new Error('Use an explicit HTTPS Convex deployment URL.')
const sessionToken = process.env.CFB26_OWNER_SESSION
if (!sessionToken)
  throw new Error('Set CFB26_OWNER_SESSION through the environment.')
const input = JSON.parse(await readFile(inputPath, 'utf8'))
if (
  !Array.isArray(input.seasons) ||
  !input.seasons.length ||
  new Set(input.seasons.map((s) => s.season)).size !== input.seasons.length
)
  throw new Error('Provide unique reviewed seasons.')
const client = new ConvexHttpClient(url.origin)
const query = (name, args) => client.query(makeFunctionReference(name), args)
const mutate = (name, args) =>
  client.mutation(makeFunctionReference(name), args)
const datasets = [
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
async function exportMichigan() {
  const revision = (await query('rosterAdmin:getDataHealth', { sessionToken }))
    .revision
  const entries = await Promise.all(
    datasets.map(async (dataset) => {
      const rows = []
      let cursor = null
      do {
        const page = await query('rosterAdmin:exportMichiganPage', {
          dataset,
          cursor,
          numItems: 100,
          sessionToken,
        })
        rows.push(...page.page)
        cursor = page.isDone ? null : page.continueCursor
      } while (cursor)
      return [dataset, rows]
    }),
  )
  if (
    (await query('rosterAdmin:getDataHealth', { sessionToken })).revision !==
    revision
  )
    throw new Error(
      'Michigan changed during export. Retry with a fresh preview.',
    )
  const core = {
    dataRevision: revision,
    datasets: Object.fromEntries(entries),
    schemaVersion: '3',
  }
  const fingerprint = createHash('sha256')
    .update(JSON.stringify(core))
    .digest('hex')
  return { ...core, exportedAt: new Date().toISOString(), fingerprint }
}
const scopedInput = (season) => ({
  season: season.season,
  sourceSha256: season.sourceSha256,
  rows: season.rows,
  sessionToken,
})
// Preview every season before the first write. Later previews rebind to each new revision.
for (const season of input.seasons) {
  const plan = await query(
    'officialFootballRosters:preview',
    scopedInput(season),
  )
  console.log(
    JSON.stringify({
      target: url.origin,
      season: season.season,
      dataRevision: plan.dataRevision,
      actions: plan.rows.reduce(
        (counts, r) => ({ ...counts, [r.action]: (counts[r.action] ?? 0) + 1 }),
        {},
      ),
    }),
  )
}
if (!flags.includes('--apply')) process.exit(0)
if (!process.env.CFB26_BACKUP_DIRECTORY)
  throw new Error(
    'Apply requires CFB26_BACKUP_DIRECTORY outside the repository.',
  )
const backupRoot = await realpath(process.env.CFB26_BACKUP_DIRECTORY)
const repoRoot = await realpath(resolve(import.meta.dirname, '..'))
if (
  backupRoot.toLowerCase() === repoRoot.toLowerCase() ||
  backupRoot.toLowerCase().startsWith(repoRoot.toLowerCase() + sep)
)
  throw new Error('Keep backups outside the repository.')
const teamScopes = Array.from({ length: 22 }, (_, i) => ({
  sport: 'basketball',
  season: 2005 + i,
})).concat(
  Array.from({ length: 22 }, (_, i) => ({ sport: 'hockey', season: 2005 + i })),
)
const teamsBefore = await Promise.all(
  teamScopes.map((scope) => query('teamRosters:list', scope)),
)
const stamp = Date.now()
const receipt = { target: url.origin, seasons: [] }
let before = await exportMichigan()
await writeFile(
  resolve(backupRoot, `michigan-official-football-before-${stamp}.json`),
  JSON.stringify(before, null, 2),
  { flag: 'wx' },
)
const keyed = (rows) => new Map(rows.map((row) => [row._id, row]))
const compareProtected = (previous, after, editedAnnualIds) => {
  for (const dataset of datasets) {
    const actual = keyed(after.datasets[dataset])
    for (const original of previous.datasets[dataset]) {
      const saved = actual.get(original._id)
      assert.ok(saved, `${dataset}: existing document removed`)
      const ignored =
        dataset === 'players'
          ? ['hometown', 'highSchool']
          : dataset === 'playerSeasons' && editedAnnualIds.has(original._id)
            ? [
                'sourceLinks',
                'listedClass',
                'jerseyNumber',
                'heightInches',
                'weightPounds',
                'listedPosition',
                'positionRoom',
              ]
            : []
      const omit = (value) =>
        Object.fromEntries(
          Object.entries(value).filter(([key]) => !ignored.includes(key)),
        )
      assert.deepEqual(
        omit(saved),
        omit(original),
        `${dataset}: protected fields changed`,
      )
      if (dataset === 'players')
        for (const key of ['hometown', 'highSchool'])
          if (original[key]) assert.equal(saved[key], original[key])
    }
    if (!['players', 'rosterStints', 'playerSeasons'].includes(dataset))
      assert.equal(
        actual.size,
        previous.datasets[dataset].length,
        `${dataset}: unexpected insert`,
      )
  }
}
for (const season of input.seasons) {
  const args = scopedInput(season)
  const plan = await query('officialFootballRosters:preview', args)
  assert.equal(
    plan.dataRevision,
    before.dataRevision,
    'Roster changed before save',
  )
  // This exact revision is already materialized on disk before its manifest is created.
  const backupManifestId = await mutate('rosterAdmin:createBackupManifest', {
    sessionToken,
    dataRevision: before.dataRevision,
    schemaVersion: '3',
    fingerprint: before.fingerprint,
    reason: `Before official Michigan ${season.season} football roster reconciliation`,
    counts: datasets.map((dataset) => ({
      dataset,
      count: before.datasets[dataset].length,
    })),
  })
  const result = await mutate('officialFootballRosters:apply', {
    ...args,
    backupManifestId,
    expectedRevision: plan.dataRevision,
    expectedFingerprint: plan.fingerprint,
  })
  const after = await exportMichigan()
  assert.equal(after.dataRevision, result.dataRevision)
  const savedPlan = await query('officialFootballRosters:preview', args)
  const annuals = keyed(after.datasets.playerSeasons)
  const oldAnnuals = keyed(before.datasets.playerSeasons)
  const editedIds = new Set(
    plan.rows.map((row) => row.playerSeasonId).filter(Boolean),
  )
  for (let i = 0; i < season.rows.length; i++) {
    const source = season.rows[i]
    const annual = annuals.get(savedPlan.rows[i].playerSeasonId)
    assert.ok(annual, 'Imported Player Season missing')
    const original = oldAnnuals.get(annual._id)
    for (const [field, sourceField] of [
      ['jerseyNumber', 'jerseyNumber'],
      ['heightInches', 'heightInches'],
      ['weightPounds', 'weightPounds'],
    ]) {
      const expected =
        original?.dataQuality === 'owner_verified' && original[field] !== null
          ? original[field]
          : (source[sourceField] ?? original?.[field] ?? null)
      assert.equal(
        annual[field],
        expected,
        `${season.season} ${source.name}: ${field}`,
      )
    }
    const precise =
      original &&
      ['OL', 'DL', 'DB', 'LB'].includes(source.listedPosition) &&
      source.listedPosition !== original.listedPosition &&
      derivePositionRoom(source.listedPosition) ===
        derivePositionRoom(original.listedPosition)
    assert.equal(
      annual.listedPosition,
      original && (original.dataQuality === 'owner_verified' || precise)
        ? original.listedPosition
        : source.listedPosition,
    )
    assert.equal(
      annual.listedClass,
      original?.listedClass && original.dataQuality === 'owner_verified'
        ? original.listedClass
        : source.listedClass,
    )
    assert.ok(
      annual.sourceLinks.some(
        (link) =>
          link.url ===
            `https://mgoblue.com/sports/football/roster/${season.season}` &&
          link.label.includes(season.sourceSha256),
      ),
    )
  }
  compareProtected(before, after, editedIds)
  const file = `michigan-official-football-after-${season.season}-${stamp}.json`
  await writeFile(resolve(backupRoot, file), JSON.stringify(after, null, 2), {
    flag: 'wx',
  })
  receipt.seasons.push({
    season: season.season,
    verified: season.rows.length,
    ...result,
    backup: file,
    sourceSha256: season.sourceSha256,
  })
  await writeFile(
    resolve(backupRoot, `official-football-receipt-${stamp}.json`),
    JSON.stringify(receipt, null, 2),
  )
  console.log(JSON.stringify(receipt.seasons.at(-1)))
  before = after
}
const teamsAfter = await Promise.all(
  teamScopes.map((scope) => query('teamRosters:list', scope)),
)
assert.ok(
  isDeepStrictEqual(teamsBefore, teamsAfter),
  'Basketball/hockey changed during import',
)
console.log(
  JSON.stringify({
    verifiedSeasons: receipt.seasons.length,
    verifiedPlayerSeasons: receipt.seasons.reduce(
      (sum, s) => sum + s.verified,
      0,
    ),
    basketballAndHockeyUnchanged: true,
  }),
)
