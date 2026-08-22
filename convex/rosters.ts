import { v } from 'convex/values'
import { query } from './_generated/server'

const rosterStatus = v.union(
  v.literal('active'),
  v.literal('committed'),
  v.literal('departed'),
)

const movementKind = v.union(
  v.literal('recruited'),
  v.literal('walk_on'),
  v.literal('transfer_in'),
  v.literal('transfer_out'),
  v.literal('graduated'),
  v.literal('retired'),
  v.literal('dismissed'),
)

const boundedLimit = (limit: number | undefined, fallback: number) =>
  Math.min(Math.max(Math.floor(limit ?? fallback), 1), 200)

export const list = query({
  args: {
    programKey: v.optional(v.string()),
    status: v.optional(rosterStatus),
    position: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const programKey = args.programKey ?? 'michigan'
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', programKey))
      .unique()

    if (!program) return []

    let stints
    if (args.status && args.position) {
      const status = args.status
      const position = args.position
      stints = await ctx.db
        .query('rosterStints')
        .withIndex('by_programId_and_status_and_position', (q) =>
          q
            .eq('programId', program._id)
            .eq('status', status)
            .eq('position', position),
        )
        .take(boundedLimit(args.limit, 200))
    } else if (args.status) {
      const status = args.status
      stints = await ctx.db
        .query('rosterStints')
        .withIndex('by_programId_and_status_and_position', (q) =>
          q.eq('programId', program._id).eq('status', status),
        )
        .take(boundedLimit(args.limit, 200))
    } else {
      stints = await ctx.db
        .query('rosterStints')
        .withIndex('by_programId_and_startSeason', (q) =>
          q.eq('programId', program._id),
        )
        .take(boundedLimit(args.limit, 500))
      if (args.position) {
        stints = stints.filter((stint) => stint.position === args.position)
      }
    }

    const entries = await Promise.all(
      stints.map(async (stint) => ({
        player: await ctx.db.get('players', stint.playerId),
        stint,
      })),
    )

    return entries.flatMap((entry) =>
      entry.player ? [{ player: entry.player, stint: entry.stint }] : [],
    )
  },
})

export const listMovements = query({
  args: {
    programKey: v.optional(v.string()),
    season: v.number(),
    kind: v.optional(movementKind),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const programKey = args.programKey ?? 'michigan'
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', programKey))
      .unique()
    if (!program) return []

    const events = args.kind
      ? await ctx.db
          .query('movementEvents')
          .withIndex('by_programId_and_season_and_kind', (q) =>
            q
              .eq('programId', program._id)
              .eq('season', args.season)
              .eq('kind', args.kind!),
          )
          .take(boundedLimit(args.limit, 200))
      : await ctx.db
          .query('movementEvents')
          .withIndex('by_programId_and_season_and_kind', (q) =>
            q.eq('programId', program._id).eq('season', args.season),
          )
          .take(boundedLimit(args.limit, 200))

    return Promise.all(
      events.map(async (event) => ({
        event,
        player: await ctx.db.get('players', event.playerId),
      })),
    )
  },
})
