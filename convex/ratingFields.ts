import { v } from 'convex/values'

export const programSnapshotFields = {
  powerWithoutProgram: v.optional(
    v.object({
      power: v.number(),
      offense: v.number(),
      defense: v.number(),
      specialTeams: v.number(),
      homeFieldAdvantage: v.number(),
    }),
  ),
  resumeProgramBonus: v.optional(v.number()),
  recordDifficulty: v.optional(v.number()),
  recordProbability: v.optional(v.number()),
  programRating: v.optional(v.number()),
  programRank: v.optional(v.number()),
  programResults: v.optional(v.number()),
  programAccomplishments: v.optional(v.number()),
  programRecentAccomplishments: v.optional(v.number()),
  programLegacyAccomplishments: v.optional(v.number()),
  programAcquisition: v.optional(v.union(v.number(), v.null())),
  programDevelopment: v.optional(v.union(v.number(), v.null())),
  programCoverage: v.optional(v.number()),
  programSeasons: v.optional(v.number()),
  programUncertainty: v.optional(v.number()),
  seasonStrength: v.optional(v.number()),
  personnelCoverage: v.optional(v.string()),
}

export const rankingEditionFields = {
  programModelVersion: v.optional(v.string()),
  membershipBasis: v.optional(v.string()),
  rankingStage: v.optional(
    v.union(v.literal('in_season'), v.literal('selection'), v.literal('final')),
  ),
  coverageWarnings: v.optional(v.array(v.string())),
}
