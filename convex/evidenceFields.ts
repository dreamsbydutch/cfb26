import { v } from 'convex/values'

const unit = v.object({
  ppa: v.number(),
  successRate: v.number(),
  plays: v.number(),
  drives: v.number(),
})
const drives = v.object({
  possessions: v.number(),
  points: v.number(),
  conceded: v.number(),
  plays: v.number(),
})
export const gameEvidenceValidator = v.object({
  observedAt: v.number(),
  version: v.literal('competitive-v1'),
  home: v.optional(unit),
  away: v.optional(unit),
  homeDrives: v.optional(drives),
  awayDrives: v.optional(drives),
})
