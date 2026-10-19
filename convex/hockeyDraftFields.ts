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
