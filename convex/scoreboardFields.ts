import { v } from 'convex/values'

export const liveScoreFields = {
  status: v.union(
    v.literal('scheduled'),
    v.literal('in_progress'),
    v.literal('completed'),
  ),
  homePoints: v.union(v.number(), v.null()),
  awayPoints: v.union(v.number(), v.null()),
  period: v.union(v.number(), v.null()),
  clock: v.union(v.string(), v.null()),
}
export const liveScoreValidator = v.object({
  ...liveScoreFields,
  updatedAt: v.number(),
})
export const scoreboardRowValidator = v.object({
  ...liveScoreFields,
  id: v.number(),
  homeId: v.number(),
  awayId: v.number(),
})
