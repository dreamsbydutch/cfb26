import { v } from 'convex/values'

export const hockeyPlayerResult = v.object({
  sourcePlayerId: v.string(),
  name: v.string(),
  jersey: v.string(),
  played: v.boolean(),
  started: v.boolean(),
  goals: v.number(),
  assists: v.number(),
  shots: v.number(),
  penaltyMinutes: v.number(),
  plusMinus: v.number(),
  blockedShots: v.number(),
  goalie: v.union(
    v.null(),
    v.object({
      seconds: v.number(),
      saves: v.number(),
      goalsAgainst: v.number(),
      wins: v.optional(v.number()),
      shutouts: v.optional(v.number()),
    }),
  ),
})

export const hockeyResultSource = v.object({
  url: v.string(),
  sha256: v.string(),
})
