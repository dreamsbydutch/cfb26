import { v } from 'convex/values'

export const npiTeam = v.object({
  sourceTeamId: v.string(),
  team: v.string(),
  teamKey: v.string(),
  rank: v.number(),
  npi: v.number(),
})

export const npiSchedule = v.object({
  latest: v.union(
    v.null(),
    v.object({
      observedAt: v.number(),
      final: v.boolean(),
      sourceUrl: v.string(),
      michiganRank: v.union(v.number(), v.null()),
      teams: v.array(npiTeam),
    }),
  ),
  refreshFailed: v.boolean(),
})
