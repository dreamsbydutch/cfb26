import { v } from 'convex/values'
import { query } from './_generated/server'

export const listBySeason = query({
  args: {
    programKey: v.optional(v.string()),
    season: v.number(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', args.programKey ?? 'michigan'))
      .unique()

    if (!program) return []

    const [stats, candidateStints] = await Promise.all([
      ctx.db
        .query('seasonalPlayerStats')
        .withIndex('by_programId_and_season_and_snaps', (q) =>
          q.eq('programId', program._id).eq('season', args.season),
        )
        .take(200),
      ctx.db
        .query('rosterStints')
        .withIndex('by_programId_and_startSeason', (q) =>
          q.eq('programId', program._id),
        )
        .take(500),
    ])

    const stints = candidateStints.filter(
      (stint) =>
        stint.startSeason <= args.season &&
        (stint.endSeason === undefined || stint.endSeason >= args.season),
    )
    const statsByPlayerId = new Map(
      stats.flatMap((stat) =>
        stat.playerId ? [[stat.playerId, stat] as const] : [],
      ),
    )
    const representedStatIds = new Set<string>()

    const rosterEntries = await Promise.all(
      stints.map(async (stint) => {
        const stat = statsByPlayerId.get(stint.playerId) ?? null
        if (stat) representedStatIds.add(stat._id)
        return {
          player: await ctx.db.get('players', stint.playerId),
          stat,
          stint,
        }
      }),
    )

    const statOnlyEntries = await Promise.all(
      stats
        .filter((stat) => !representedStatIds.has(stat._id))
        .map(async (stat) => ({
          player: stat.playerId
            ? await ctx.db.get('players', stat.playerId)
            : null,
          stat,
          stint: null,
        })),
    )

    return [...rosterEntries, ...statOnlyEntries]
  },
})
