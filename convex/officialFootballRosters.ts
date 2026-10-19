import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  advanceMichiganDataRevision,
  getMichiganDataRevision,
  requireCurrentBackup,
  requireOwnerSession,
} from './rosterAdmin'
import { derivePositionRoom } from './playerDomain'
import { listedClass } from './footballRosterFields'
import type { Infer } from 'convex/values'
import type { Doc } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

const rowValidator = v.object({
  identityKey: v.string(),
  playerId: v.optional(v.id('players')),
  name: v.string(),
  firstObservedSeason: v.number(),
  lastObservedSeason: v.number(),
  listedPosition: v.string(),
  listedClass,
  jerseyNumber: v.union(v.number(), v.null()),
  heightInches: v.union(v.number(), v.null()),
  weightPounds: v.union(v.number(), v.null()),
  hometown: v.string(),
  highSchool: v.union(v.string(), v.null()),
  profileUrl: v.string(),
})
const input = {
  season: v.number(),
  sourceSha256: v.string(),
  rows: v.array(rowValidator),
  sessionToken: v.string(),
}
type Input = {
  season: number
  sourceSha256: string
  rows: Array<Infer<typeof rowValidator>>
}
async function fingerprint(args: Input) {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      season: args.season,
      sourceSha256: args.sourceSha256,
      rows: args.rows,
    }),
  )
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}
const resultRow = v.object({
  identityKey: v.string(),
  playerId: v.union(v.id('players'), v.null()),
  playerSeasonId: v.union(v.id('playerSeasons'), v.null()),
  action: v.union(
    v.literal('create_person'),
    v.literal('create_season'),
    v.literal('update_season'),
  ),
})

function integer(value: number, min: number, max: number, label: string) {
  if (!Number.isInteger(value) || value < min || value > max)
    throw new Error(`${label} must be an integer from ${min} to ${max}.`)
}
function validate(args: Input) {
  integer(args.season, 2005, 2026, 'Season')
  if (!/^[a-f0-9]{64}$/.test(args.sourceSha256))
    throw new Error('Source SHA-256 is required.')
  if (!args.rows.length || args.rows.length > 160)
    throw new Error('Import between 1 and 160 rows.')
  const keys = new Set<string>()
  const players = new Set<string>()
  for (const row of args.rows) {
    if (
      !/^[a-z0-9-]{1,120}$/.test(row.identityKey) ||
      keys.has(row.identityKey)
    )
      throw new Error('Identity keys must be valid and unique.')
    keys.add(row.identityKey)
    if (row.playerId && players.has(row.playerId))
      throw new Error('Duplicate canonical player.')
    if (row.playerId) players.add(row.playerId)
    if (
      !row.name.trim() ||
      row.name.length > 100 ||
      row.name !== row.name.trim()
    )
      throw new Error('Invalid player name.')
    if (!row.listedPosition.trim() || row.listedPosition.length > 16)
      throw new Error('Invalid position.')
    if (row.hometown.length > 80 || (row.highSchool?.length ?? 0) > 120)
      throw new Error('Profile field is too long.')
    integer(row.firstObservedSeason, 2005, args.season, 'First observed season')
    integer(row.lastObservedSeason, args.season, 2026, 'Last observed season')
    if (row.jerseyNumber !== null) integer(row.jerseyNumber, 0, 99, 'Jersey')
    if (row.heightInches !== null) integer(row.heightInches, 48, 96, 'Height')
    if (row.weightPounds !== null) integer(row.weightPounds, 100, 500, 'Weight')
    const url = new URL(row.profileUrl)
    if (
      url.origin !== 'https://mgoblue.com' ||
      !/^\/sports\/football\/roster\/[^/]+\/\d+$/.test(url.pathname) ||
      url.search ||
      url.hash
    )
      throw new Error('Use an official Michigan football player profile URL.')
  }
}

async function plan(ctx: QueryCtx | MutationCtx, args: Input) {
  validate(args)
  const program = await ctx.db
    .query('programs')
    .withIndex('by_key', (q) => q.eq('key', 'michigan'))
    .unique()
  if (!program) throw new Error('Michigan program is missing.')
  const rows = []
  const seen = new Set<string>()
  for (const row of args.rows) {
    const legacyKey = `mgoblue-football:${row.identityKey}`
    const linked = await ctx.db
      .query('players')
      .withIndex('by_legacyKey', (q) => q.eq('legacyKey', legacyKey))
      .unique()
    const player = row.playerId
      ? await ctx.db.get('players', row.playerId)
      : linked
    if (row.playerId && !player)
      throw new Error(`Player ${row.name} is missing.`)
    if (
      player &&
      (player.entrySeason > row.lastObservedSeason + 1 ||
        player.entrySeason < row.firstObservedSeason - 8)
    )
      throw new Error(
        `Review the era of the selected identity for ${row.name}.`,
      )
    if (linked && row.playerId && linked._id !== row.playerId)
      throw new Error('Identity link conflicts with selected player.')
    if (player && seen.has(player._id))
      throw new Error('Duplicate canonical player.')
    if (player) seen.add(player._id)
    const annual = player
      ? await ctx.db
          .query('playerSeasons')
          .withIndex('by_playerId_and_season', (q) =>
            q.eq('playerId', player._id).eq('season', args.season),
          )
          .unique()
      : null
    if (annual && annual.programId !== program._id)
      throw new Error('Player Season belongs to another program.')
    rows.push({ row, player, annual, legacyKey })
  }
  return { program, rows }
}

export const preview = query({
  args: input,
  returns: v.object({
    dataRevision: v.number(),
    fingerprint: v.string(),
    rows: v.array(resultRow),
  }),
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const planned = await plan(ctx, args)
    return {
      dataRevision: await getMichiganDataRevision(ctx),
      fingerprint: await fingerprint(args),
      rows: planned.rows.map(({ row, player, annual }) => ({
        identityKey: row.identityKey,
        playerId: player?._id ?? null,
        playerSeasonId: annual?._id ?? null,
        action: !player
          ? ('create_person' as const)
          : !annual
            ? ('create_season' as const)
            : ('update_season' as const),
      })),
    }
  },
})

export const apply = mutation({
  args: {
    ...input,
    expectedRevision: v.number(),
    expectedFingerprint: v.string(),
    backupManifestId: v.id('backupManifests'),
  },
  returns: v.object({
    dataRevision: v.number(),
    createdPeople: v.number(),
    createdSeasons: v.number(),
    updatedSeasons: v.number(),
  }),
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    if ((await getMichiganDataRevision(ctx)) !== args.expectedRevision)
      throw new Error('Roster changed since preview.')
    await requireCurrentBackup(ctx, args.backupManifestId)
    if ((await fingerprint(args)) !== args.expectedFingerprint)
      throw new Error('Import rows differ from the reviewed preview.')
    const planned = await plan(ctx, args)
    let createdPeople = 0,
      createdSeasons = 0,
      updatedSeasons = 0
    const rosterUrl = `https://mgoblue.com/sports/football/roster/${args.season}`
    const rosterSource = {
      label: `Michigan Athletics roster SHA-256 ${args.sourceSha256}`,
      url: rosterUrl,
    }
    for (const {
      row,
      player: existingPlayer,
      annual,
      legacyKey,
    } of planned.rows) {
      let player = existingPlayer
      if (!player) {
        const slug = `${row.name
          .normalize('NFKD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')}-${row.firstObservedSeason}`
        const duplicate = await ctx.db
          .query('players')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .unique()
        if (duplicate)
          throw new Error(`Resolve the existing identity for ${row.name}.`)
        const id = await ctx.db.insert('players', {
          canonicalName: row.name,
          displayName: row.name,
          slug,
          legacyKey,
          dataQuality: 'needs_review',
          entryMethod: 'legacy',
          entrySeason: row.firstObservedSeason,
          state: row.lastObservedSeason === 2026 ? 'enrolled' : 'alumni',
          ...(row.hometown ? { hometown: row.hometown } : {}),
          ...(row.highSchool ? { highSchool: row.highSchool } : {}),
          sourceLinks: [
            { label: 'Michigan Athletics player profile', url: row.profileUrl },
          ],
          sourceUpdatedAt: Date.now(),
        })
        player = await ctx.db.get('players', id)
        createdPeople++
      }
      if (!player) throw new Error('Player creation failed.')
      // Profile facts are shared across seasons. Existing nonblank owner facts stay intact.
      const profilePatch: Partial<Doc<'players'>> = {}
      if (!player.hometown && row.hometown) profilePatch.hometown = row.hometown
      if (!player.highSchool && row.highSchool)
        profilePatch.highSchool = row.highSchool
      if (Object.keys(profilePatch).length)
        await ctx.db.patch('players', player._id, profilePatch)
      const sourceLinks = [
        ...(annual?.sourceLinks ?? []).filter((s) => s.url !== rosterUrl),
        rosterSource,
      ]
      if (annual) {
        const patch: Partial<Doc<'playerSeasons'>> = { sourceLinks }
        if (!annual.listedClass || annual.dataQuality !== 'owner_verified')
          patch.listedClass = row.listedClass
        if (
          annual.dataQuality !== 'owner_verified' ||
          annual.jerseyNumber === null
        ) {
          if (row.jerseyNumber !== null) patch.jerseyNumber = row.jerseyNumber
        }
        if (
          annual.dataQuality !== 'owner_verified' ||
          annual.heightInches === null
        ) {
          if (row.heightInches !== null) patch.heightInches = row.heightInches
        }
        if (
          annual.dataQuality !== 'owner_verified' ||
          annual.weightPounds === null
        ) {
          if (row.weightPounds !== null) patch.weightPounds = row.weightPounds
        }
        const broad = ['OL', 'DL', 'DB', 'LB'].includes(row.listedPosition)
        const precise =
          row.listedPosition !== annual.listedPosition &&
          broad &&
          derivePositionRoom(row.listedPosition) ===
            derivePositionRoom(annual.listedPosition)
        if (annual.dataQuality !== 'owner_verified' && !precise) {
          patch.listedPosition = row.listedPosition
          patch.positionRoom = derivePositionRoom(row.listedPosition)
        }
        await ctx.db.patch('playerSeasons', annual._id, patch)
        updatedSeasons++
        continue
      }
      const stints = await ctx.db
        .query('rosterStints')
        .withIndex('by_playerId_and_startSeason', (q) =>
          q.eq('playerId', player._id),
        )
        .take(26)
      if (stints.length > 25)
        throw new Error('Review this player’s unusually large stint history.')
      const matching = stints.filter(
        (s) =>
          s.programId === planned.program._id &&
          s.startSeason <= args.season &&
          (s.endSeason === undefined || s.endSeason >= args.season),
      )
      if (matching.length > 1)
        throw new Error('Overlapping Michigan stints require review.')
      let stintId = matching[0]?._id
      if (!stintId) {
        // A retrospective roster observation does not assert a transfer or arrival event.
        const first = stints.length ? args.season : row.firstObservedSeason
        const last = stints.length ? args.season : row.lastObservedSeason
        stintId = await ctx.db.insert('rosterStints', {
          dataQuality: 'needs_review',
          entryMethod: 'legacy',
          playerId: player._id,
          programId: planned.program._id,
          startSeason: first,
          eligibilityStartSeason: first,
          endSeason: last,
          status: last === 2026 ? 'active' : 'departed',
          sourceLinks: [rosterSource],
        })
      }
      await ctx.db.insert('playerSeasons', {
        playerId: player._id,
        programId: planned.program._id,
        stintId,
        season: args.season,
        dataQuality: 'source_verified',
        rosterStatus: 'active',
        listedPosition: row.listedPosition,
        positionRoom: derivePositionRoom(row.listedPosition),
        listedClass: row.listedClass,
        rosterOnly: true,
        jerseyNumber: row.jerseyNumber,
        heightInches: row.heightInches,
        weightPounds: row.weightPounds,
        captain: false,
        depthStatus: 'unknown',
        role: 'unassigned',
        roomOrder: null,
        scholarshipStatus: 'unknown',
        gamesPlayed: 0,
        starts: 0,
        honors: [],
        eligibleThroughSeasonOverride: null,
        eligibilityEvidence: {
          enrollmentSeason: null,
          competitionSeasons: [],
          legacyRedshirtSeason: null,
          medicalHardshipSeasons: 0,
          otherExtensionSeasons: 0,
          ageBasedExceptionSeasons: 0,
        },
        sourceLinks: [rosterSource],
      })
      createdSeasons++
    }
    const dataRevision = await advanceMichiganDataRevision(ctx, {
      action: 'import_official_football_roster',
      sessionId: session._id,
      backupManifestId: args.backupManifestId,
      target: `Michigan ${args.season}: ${args.rows.length} official roster rows; SHA-256 ${args.sourceSha256}`,
    })
    return { dataRevision, createdPeople, createdSeasons, updatedSeasons }
  },
})
