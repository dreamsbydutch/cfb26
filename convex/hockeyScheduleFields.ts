import {
  teamGame,
  teamScheduleUrl,
  validateTeamScheduleGames,
  validateTeamScheduleSeason,
} from './teamScheduleFields'
import type { Infer } from 'convex/values'

export const hockeyGame = teamGame
export const hockeyScheduleUrl = (season: number) =>
  teamScheduleUrl('hockey', season)
export const validateHockeySeason = validateTeamScheduleSeason
export const validateHockeyGames = (
  season: number,
  games: Array<Infer<typeof teamGame>>,
) => validateTeamScheduleGames('hockey', season, games)
