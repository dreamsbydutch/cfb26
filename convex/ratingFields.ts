import { v } from 'convex/values'

export const programSnapshotFields = {
  recordDifficulty: v.optional(v.number()),
  recordProbability: v.optional(v.number()),
  programRating: v.optional(v.number()),
  programRank: v.optional(v.number()),
  programResults: v.optional(v.number()),
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
