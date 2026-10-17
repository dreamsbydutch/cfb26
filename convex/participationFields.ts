import { v } from 'convex/values'

export const participationPhase = v.union(
  v.literal('offense'),
  v.literal('defense'),
  v.literal('specialTeams'),
)

export const participationCounts = {
  gamesPlayed: v.number(),
  snaps: v.number(),
  defenseBreakdown: v.optional(
    v.object({
      runDefense: v.number(),
      passRush: v.number(),
      coverage: v.number(),
    }),
  ),
  offenseBreakdown: v.optional(
    v.object({
      pass: v.number(),
      passBlock: v.number(),
      run: v.number(),
      runBlock: v.number(),
    }),
  ),
}

export const participationSnapshot = v.object({
  ...participationCounts,
  throughTeamGames: v.number(),
  sourceLabel: v.string(),
  sourceImageSha256: v.optional(v.string()),
  importedAt: v.number(),
})

export const participationImport = {
  season: v.number(),
  phase: participationPhase,
  throughTeamGames: v.number(),
  sourceLabel: v.string(),
  sourceImageSha256: v.string(),
  rows: v.array(
    v.object({
      ...participationCounts,
      name: v.string(),
      jerseyNumber: v.number(),
      playerId: v.optional(v.id('players')),
    }),
  ),
}
