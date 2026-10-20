import { v } from 'convex/values'
import type { Infer } from 'convex/values'

const metric = v.union(v.number(), v.null())
export const nhlStats = v.object({
  gamesPlayed: metric,
  goals: metric,
  assists: metric,
  points: metric,
  plusMinus: metric,
  pim: metric,
  wins: metric,
  losses: metric,
  otLosses: metric,
  savePctg: metric,
  goalsAgainstAvg: metric,
  shutouts: metric,
})
export const nhlHistory = v.object({
  status: v.union(v.literal('matched'), v.literal('unmatched')),
  playerId: v.union(v.number(), v.null()),
  playerName: v.string(),
  goalie: v.boolean(),
  fetchedAt: v.number(),
  regularSeason: v.union(nhlStats, v.null()),
  playoffs: v.union(nhlStats, v.null()),
  seasons: v.array(
    v.object({
      season: v.number(),
      gameType: v.union(v.literal(2), v.literal(3)),
      team: v.string(),
      stats: nhlStats,
    }),
  ),
})
export type NhlStats = Infer<typeof nhlStats>
export type NhlHistory = Infer<typeof nhlHistory>
