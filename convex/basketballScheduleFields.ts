import { v } from 'convex/values'
import {
  teamGame,
  teamScheduleUrl,
  validateTeamScheduleGames,
  validateTeamScheduleSeason,
} from './teamScheduleFields'
import type { Infer } from 'convex/values'

export const basketballGame = teamGame.extend({
  result: v.union(v.literal('W'), v.literal('L'), v.null()),
})
export const basketballScheduleUrl = (season: number) =>
  teamScheduleUrl('basketball', season)
export const validateBasketballSeason = validateTeamScheduleSeason
export const validateBasketballGames = (
  season: number,
  games: Array<Infer<typeof basketballGame>>,
) => validateTeamScheduleGames('basketball', season, games)
