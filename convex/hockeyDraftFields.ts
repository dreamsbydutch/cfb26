import { v } from 'convex/values'

export const HOCKEY_DRAFT_SOURCE =
  'https://mgoblue.com/news/2008/6/27/michigan_players_selected_in_the_nhl_draft'
export const hockeyDraft = v.object({
  playerName: v.string(),
  year: v.number(),
  round: v.number(),
  overallPick: v.number(),
  nhlTeam: v.string(),
  priorToMichigan: v.union(v.boolean(), v.null()),
  sourceUrl: v.string(),
  sourceSha256: v.string(),
})

export const HOCKEY_DRAFT_RANKING_SOURCE =
  'https://www.eliteprospects.com/draft-center/consolidated-ranking'
export const hockeyDraftProjection = v.object({
  playerName: v.string(),
  draftYear: v.number(),
  rank: v.number(),
  sourceUrl: v.literal(HOCKEY_DRAFT_RANKING_SOURCE),
  sourcePlayerUrl: v.string(),
  observedAt: v.number(),
  sourceSha256: v.string(),
})
