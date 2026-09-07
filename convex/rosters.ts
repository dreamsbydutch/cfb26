import { v } from 'convex/values'
import { query } from './_generated/server'
import { resolvePlayerSeasonEligibility } from './eligibility'
import { comparePositionRooms, derivePositionRoom } from './playerDomain'

const boundedLimit = (limit: number | undefined, fallback: number) =>
  Math.min(Math.max(Math.floor(limit ?? fallback), 1), 500)

const movementKind = v.union(
  v.literal('recruited'),
  v.literal('walk_on'),
  v.literal('transfer_in'),
  v.literal('transfer_out'),
  v.literal('graduated'),
  v.literal('retired'),
  v.literal('dismissed'),
  v.literal('decommitted'),
  v.literal('enrolled'),
  v.literal('returned'),
)

export const getSeasonDashboard = query({
  args: {
    programKey: v.optional(v.string()),
    season: v.number(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', args.programKey ?? 'michigan'))
      .unique()
    if (!program) return null

    const [seasons, rule, commitments, nextSeasons] = await Promise.all([
      ctx.db
        .query('playerSeasons')
        .withIndex('by_programId_and_season_and_room', (q) =>
          q.eq('programId', program._id).eq('season', args.season),
        )
        .take(500),
      ctx.db
        .query('seasonRules')
        .withIndex('by_season', (q) => q.eq('season', args.season))
        .unique(),
      ctx.db
        .query('commitments')
        .withIndex('by_programId_and_season_and_status', (q) =>
          q.eq('programId', program._id).eq('season', args.season),
        )
        .take(200),
      ctx.db
        .query('playerSeasons')
        .withIndex('by_programId_and_season_and_room', (q) =>
          q.eq('programId', program._id).eq('season', args.season + 1),
        )
        .take(500),
    ])
    const players = new Map(
      (
        await Promise.all(
          [
            ...new Set([...seasons, ...nextSeasons].map((row) => row.playerId)),
          ].map(
            async (playerId) =>
              [playerId, await ctx.db.get('players', playerId)] as const,
          ),
        )
      ).filter((entry) => entry[1] !== null),
    )
    const entries = seasons
      .map((storedSeason) => ({
        eligibility: resolvePlayerSeasonEligibility(storedSeason, rule),
        player: players.get(storedSeason.playerId) ?? null,
        season: {
          ...storedSeason,
          positionRoom: derivePositionRoom(storedSeason.listedPosition),
        },
      }))
      .filter((entry) => entry.player !== null)
      .sort(
        (a, b) =>
          comparePositionRooms(a.season.positionRoom, b.season.positionRoom) ||
          (a.season.roomOrder ?? 999) - (b.season.roomOrder ?? 999) ||
          (a.player?.displayName ?? '').localeCompare(
            b.player?.displayName ?? '',
          ),
      )

    const scholarship = entries.reduce(
      (counts, entry) => {
        if (entry.season.scholarshipStatus === 'scholarship')
          counts.counted += 1
        else if (entry.season.scholarshipStatus === 'exempt') counts.exempt += 1
        else if (entry.season.scholarshipStatus === 'unknown')
          counts.unknown += 1
        return counts
      },
      { counted: 0, exempt: 0, unknown: 0 },
    )
    const rosterLimit = rule?.rosterLimit ?? null
    const warnings = [
      ...(rosterLimit !== null && scholarship.counted > rosterLimit
        ? [
            `Counted scholarships exceed the ${rosterLimit}-player season limit.`,
          ]
        : []),
      ...(scholarship.unknown > 0
        ? [`${scholarship.unknown} players have unknown scholarship status.`]
        : []),
      ...entries.flatMap((entry) => entry.eligibility.warnings),
    ]
    const nextPlayerIds = new Set(nextSeasons.map((season) => season.playerId))

    return {
      commitments: await Promise.all(
        commitments.map(async (commitment) => ({
          commitment,
          player: await ctx.db.get('players', commitment.playerId),
        })),
      ),
      entries,
      program,
      returningProduction: {
        players: seasons.filter((season) => nextPlayerIds.has(season.playerId))
          .length,
        rate:
          seasons.length === 0
            ? null
            : nextPlayerIds.size / Math.max(seasons.length, 1),
      },
      rosterLimit,
      scholarship,
      season: args.season,
      warnings: [...new Set(warnings)],
    }
  },
})

export const list = query({
  args: {
    limit: v.optional(v.number()),
    programKey: v.optional(v.string()),
    season: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', args.programKey ?? 'michigan'))
      .unique()
    if (!program) return []
    const season = args.season ?? new Date().getUTCFullYear()
    const rows = await ctx.db
      .query('playerSeasons')
      .withIndex('by_programId_and_season_and_room', (q) =>
        q.eq('programId', program._id).eq('season', season),
      )
      .take(boundedLimit(args.limit, 200))
    return Promise.all(
      rows.map(async (playerSeason) => ({
        player: await ctx.db.get('players', playerSeason.playerId),
        season: {
          ...playerSeason,
          positionRoom: derivePositionRoom(playerSeason.listedPosition),
        },
      })),
    ).then((entries) =>
      entries
        .filter((entry) => entry.player !== null)
        .sort((left, right) =>
          comparePositionRooms(
            left.season.positionRoom,
            right.season.positionRoom,
          ),
        ),
    )
  },
})

export const listMovements = query({
  args: {
    kind: v.optional(movementKind),
    limit: v.optional(v.number()),
    programKey: v.optional(v.string()),
    season: v.number(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', args.programKey ?? 'michigan'))
      .unique()
    if (!program) return []
    const events = await ctx.db
      .query('movementEvents')
      .withIndex('by_programId_and_season_and_kind', (q) => {
        const range = q.eq('programId', program._id).eq('season', args.season)
        return args.kind ? range.eq('kind', args.kind) : range
      })
      .take(boundedLimit(args.limit, 200))
    return Promise.all(
      events.map(async (event) => ({
        event,
        player: await ctx.db.get('players', event.playerId),
      })),
    )
  },
})
