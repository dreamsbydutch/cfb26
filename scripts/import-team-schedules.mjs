import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  validateTeamScheduleGames,
  teamScheduleUrl,
} from '../convex/teamScheduleFields.ts'

const [inputPath, target, ...rawFlags] = process.argv.slice(2)
const sportFlag = rawFlags.find((flag) => flag.startsWith('--sport='))
const sport = sportFlag?.slice('--sport='.length) ?? 'hockey'
assert.ok(
  ['hockey', 'basketball'].includes(sport),
  'Choose hockey or basketball explicitly.',
)
assert.ok(
  rawFlags.filter((flag) => flag.startsWith('--sport=')).length <= 1,
  'Provide one sport flag.',
)
const flags = rawFlags.filter((flag) => !flag.startsWith('--sport='))
const apiModule = sport === 'hockey' ? 'hockeySchedules' : 'basketballSchedules'
const otherModule =
  sport === 'hockey' ? 'basketballSchedules' : 'hockeySchedules'
if (!inputPath || !target || flags.some((flag) => flag !== '--apply'))
  throw Error(
    'Usage: node --experimental-strip-types scripts/import-team-schedules.mjs <reviewed-import.json> <https://deployment.convex.cloud> [--sport=hockey|basketball] [--apply]',
  )
const url = new URL(target)
assert.ok(
  url.protocol === 'https:' &&
    url.hostname.endsWith('.convex.cloud') &&
    url.pathname === '/' &&
    !url.username &&
    !url.password,
)
const sessionToken = process.env.CFB26_OWNER_SESSION
assert.ok(sessionToken, 'Set CFB26_OWNER_SESSION through the environment.')
const input = JSON.parse(await readFile(inputPath, 'utf8'))
assert.ok(Array.isArray(input.seasons) && input.seasons.length)
assert.equal(
  new Set(input.seasons.map((s) => s.season)).size,
  input.seasons.length,
)
const client = new ConvexHttpClient(url.origin)
const query = (name, args) => client.query(makeFunctionReference(name), args)
const mutate = (name, args) =>
  client.mutation(makeFunctionReference(name), args)
const before = []
for (const season of input.seasons) {
  validateTeamScheduleGames(sport, season.season, season.games)
  assert.equal(
    season.sourceUrl,
    teamScheduleUrl(sport, season.season),
    'Input source must match the selected sport and season.',
  )
  assert.equal(
    createHash('sha256')
      .update(
        await readFile(resolve(dirname(inputPath), `${season.season}.html`)),
      )
      .digest('hex'),
    season.sourceSha256,
  )
  assert.equal(
    new Set(season.games.map((g) => g.sourceGameId)).size,
    season.games.length,
  )
  before.push(await query(`${apiModule}:list`, { season: season.season }))
}
console.log(
  JSON.stringify({
    target: url.origin,
    seasons: input.seasons.map((s, i) => ({
      season: s.season,
      games: s.games.length,
      revision: before[i].revision,
    })),
    total: input.seasons.reduce((n, s) => n + s.games.length, 0),
  }),
)
if (!flags.includes('--apply')) process.exit(0)
const backupDirectory = process.env.CFB26_BACKUP_DIRECTORY
assert.ok(backupDirectory, 'Set CFB26_BACKUP_DIRECTORY outside the repository.')
const backupRoot = resolve(backupDirectory)
const workspace = resolve('.')
assert.ok(
  backupRoot !== workspace &&
    !backupRoot.startsWith(workspace + '\\') &&
    !backupRoot.startsWith(workspace + '/'),
  'Backups must be outside the repository.',
)
const scopes = ['hockey', 'basketball'].flatMap((sport) =>
  Array.from({ length: 22 }, (_, i) => ({ sport, season: 2005 + i })),
)
const rosters = await Promise.all(
  scopes.map((scope) => query('teamRosters:list', scope)),
)
const otherSeasons = Array.from({ length: 22 }, (_, i) => ({
  season: 2005 + i,
}))
const otherSchedules = await Promise.all(
  otherSeasons.map((scope) => query(`${otherModule}:list`, scope)),
)
const footballRevision = (
  await query('rosterAdmin:getDataHealth', { sessionToken })
).revision
const stamp = Date.now()
const file = (suffix) =>
  resolve(backupRoot, `${sport}-schedules-${suffix}-${stamp}.json`)
await writeFile(
  file('before'),
  JSON.stringify(
    {
      target: url.origin,
      before,
      scopes,
      rosters,
      otherSchedules,
      footballRevision,
    },
    null,
    2,
  ),
  { flag: 'wx' },
)
const receipt = { target: url.origin, sport, seasons: [] }
for (const [i, source] of input.seasons.entries()) {
  assert.deepEqual(
    await query(`${apiModule}:list`, { season: source.season }),
    before[i],
    'Schedule changed after preview',
  )
  const { season, games, sourceSha256 } = source
  const result = await mutate(`${apiModule}:importSeason`, {
    season,
    games,
    sourceSha256,
    sessionToken,
    expectedRevision: before[i].revision,
  })
  const after = await query(`${apiModule}:list`, { season })
  assert.equal(after.revision, result.revision)
  assert.equal(after.games.length, games.length)
  for (const row of games) {
    const saved = after.games.find(
      (game) => game.sourceGameId === row.sourceGameId,
    )
    assert.ok(saved)
    for (const [key, value] of Object.entries(row))
      assert.deepEqual(
        saved[key],
        value,
        `${season}:${row.sourceGameId}:${key}`,
      )
  }
  await writeFile(
    file(`after-${season}`),
    JSON.stringify({ target: url.origin, season, ...after }, null, 2),
    { flag: 'wx' },
  )
  receipt.seasons.push({
    season,
    ...result,
    verified: games.length,
    sourceSha256,
    sourceUrl: source.sourceUrl,
  })
  await writeFile(file('receipt'), JSON.stringify(receipt, null, 2))
  console.log(JSON.stringify(receipt.seasons.at(-1)))
}
assert.deepEqual(
  await Promise.all(scopes.map((scope) => query('teamRosters:list', scope))),
  rosters,
  'Roster data changed during import',
)
assert.equal(
  (await query('rosterAdmin:getDataHealth', { sessionToken })).revision,
  footballRevision,
)
assert.deepEqual(
  await Promise.all(
    otherSeasons.map((scope) => query(`${otherModule}:list`, scope)),
  ),
  otherSchedules,
  'Other sport schedule changed during import',
)
receipt.otherSportSchedulesUnchanged = true
receipt.rostersUnchanged = true
receipt.footballRevisionUnchanged = footballRevision
await writeFile(file('receipt'), JSON.stringify(receipt, null, 2))
console.log(
  JSON.stringify({
    verifiedSeasons: receipt.seasons.length,
    verifiedGames: receipt.seasons.reduce((n, s) => n + s.verified, 0),
    rostersUnchanged: true,
    footballRevisionUnchanged: footballRevision,
  }),
)
