import { v } from 'convex/values'
import { query } from './_generated/server'

const boundedLimit = (limit: number | undefined, fallback: number) =>
  Math.min(Math.max(Math.floor(limit ?? fallback), 1), 500)

export const search = query({
  args: {
    searchText: v.string(),
    homeState: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchText = args.searchText.trim()
    if (!searchText) return []

    return ctx.db
      .query('players')
      .withSearchIndex('search_displayName', (searchQuery) => {
        const results = searchQuery.search('displayName', searchText)
        return args.homeState
          ? results.eq('homeState', args.homeState)
          : results
      })
      .take(boundedLimit(args.limit, 25))
  },
})

export const getProfile = query({
  args: { playerId: v.id('players') },
  handler: async (ctx, args) => {
    const player = await ctx.db.get('players', args.playerId)
    if (!player) return null

    const [recruiting, stints, summaries, movements, draft] = await Promise.all(
      [
        ctx.db
          .query('recruitingProfiles')
          .withIndex('by_playerId', (q) => q.eq('playerId', args.playerId))
          .unique(),
        ctx.db
          .query('rosterStints')
          .withIndex('by_playerId_and_startSeason', (q) =>
            q.eq('playerId', args.playerId),
          )
          .take(20),
        ctx.db
          .query('programCareerSummaries')
          .withIndex('by_playerId_and_programId', (q) =>
            q.eq('playerId', args.playerId),
          )
          .take(20),
        ctx.db
          .query('movementEvents')
          .withIndex('by_playerId_and_season', (q) =>
            q.eq('playerId', args.playerId),
          )
          .take(20),
        ctx.db
          .query('draftOutcomes')
          .withIndex('by_playerId', (q) => q.eq('playerId', args.playerId))
          .unique(),
      ],
    )

    return { player, recruiting, stints, summaries, movements, draft }
  },
})
