import { v } from 'convex/values'
import type { Infer } from 'convex/values'
import type { TeamSport } from './teamRosterFields'

export const teamGame = v.object({
  sourceGameId: v.string(),
  date: v.string(),
  time: v.string(),
  endDate: v.union(v.string(), v.null()),
  opponentId: v.string(),
  opponent: v.string(),
  opponentPrefix: v.string(),
  location: v.string(),
  venue: v.union(
    v.literal('home'),
    v.literal('away'),
    v.literal('neutral'),
    v.literal('unknown'),
  ),
  exhibition: v.boolean(),
  conference: v.boolean(),
  status: v.union(
    v.literal('scheduled'),
    v.literal('final'),
    v.literal('cancelled'),
    v.literal('postponed'),
    v.literal('no_contest'),
  ),
  result: v.union(v.literal('W'), v.literal('L'), v.literal('T'), v.null()),
  michiganScore: v.union(v.number(), v.null()),
  opponentScore: v.union(v.number(), v.null()),
  note: v.string(),
  tournament: v.string(),
  recapUrl: v.union(v.string(), v.null()),
  boxScoreUrl: v.union(v.string(), v.null()),
})

export function teamScheduleUrl(sport: TeamSport, season: number) {
  return `https://mgoblue.com/sports/${sport === 'hockey' ? 'mens-ice-hockey' : 'mens-basketball'}/schedule/${season}-${String(season + 1).slice(-2)}`
}

export function validateTeamScheduleSeason(season: number) {
  if (!Number.isInteger(season) || season < 2005 || season > 2200)
    throw new Error('Choose a valid team season starting in 2005 or later.')
}

export function validateTeamScheduleGames(
  sport: TeamSport,
  season: number,
  games: Array<Infer<typeof teamGame>>,
) {
  validateTeamScheduleSeason(season)
  if (!games.length || games.length > 80)
    throw new Error('Import between 1 and 80 games for one season.')
  const seen = new Set<string>()
  for (const game of games) {
    if (sport === 'basketball' && game.result === 'T')
      throw new Error('Basketball games cannot end in a tie.')
    if (!/^\d+$/.test(game.sourceGameId) || seen.has(game.sourceGameId))
      throw new Error('Official game IDs must be unique.')
    seen.add(game.sourceGameId)
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(game.date) ||
      !Number.isFinite(Date.parse(game.date)) ||
      new Date(`${game.date}T00:00:00Z`).toISOString().slice(0, 10) !==
        game.date ||
      game.date < `${season}-07-01` ||
      game.date > `${season + 1}-06-30`
    )
      throw new Error('Game date must belong to the selected team season.')
    if (
      game.endDate !== null &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(game.endDate) ||
        !Number.isFinite(Date.parse(game.endDate)) ||
        new Date(`${game.endDate}T00:00:00Z`).toISOString().slice(0, 10) !==
          game.endDate ||
        game.endDate < game.date ||
        game.endDate > `${season + 1}-06-30`)
    )
      throw new Error('Game end date must belong to the selected team season.')
    if (!game.opponent.trim() || game.opponent.length > 160)
      throw new Error('Opponent is required.')
    for (const field of [
      'time',
      'opponentId',
      'opponentPrefix',
      'location',
      'note',
      'tournament',
    ] as const)
      if (game[field].length > 1000)
        throw new Error('Schedule text is too long.')
    for (const url of [game.recapUrl, game.boxScoreUrl]) {
      if (url !== null && (!/^https:\/\//.test(url) || url.length > 2000))
        throw new Error('Source links must use HTTPS.')
    }
    for (const score of [game.michiganScore, game.opponentScore])
      if (
        score !== null &&
        (!Number.isInteger(score) ||
          score < 0 ||
          score > (sport === 'hockey' ? 100 : 300))
      )
        throw new Error('Scores must be nonnegative whole numbers.')
    if ((game.michiganScore === null) !== (game.opponentScore === null))
      throw new Error('Both scores must be present or unknown.')
    if (
      game.status !== 'final' &&
      (game.michiganScore !== null || game.result !== null)
    )
      throw new Error('Unplayed games cannot have final scores or results.')
    if (game.result !== null && game.michiganScore === null)
      throw new Error('A recorded result needs both scores.')
    if (game.michiganScore !== null && game.opponentScore !== null) {
      const result =
        game.michiganScore > game.opponentScore
          ? 'W'
          : game.michiganScore < game.opponentScore
            ? 'L'
            : 'T'
      if (game.result !== result)
        throw new Error('Result must match the recorded score.')
    }
  }
}
