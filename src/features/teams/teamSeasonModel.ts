import type { Infer } from 'convex/values'
import type { teamGame } from '../../../convex/teamScheduleFields'
import type { TeamSport, TeamValues } from '../../../convex/teamRosterFields'
import type { SeasonHistory } from './seasonHistory'

export type SeasonGame = Infer<typeof teamGame>
export type SeasonPlayer = { _id: string; values: TeamValues }
export type ScheduleState = {
  isPending: boolean
  isError: boolean
  data?: {
    games: Array<SeasonGame>
    sourceUrl: string | null
    importedAt: number | null
  }
}
export type RosterState = {
  isPending: boolean
  isError: boolean
  data?: { entries: Array<SeasonPlayer> }
}

export function seasonRecord(sport: TeamSport, games: Array<SeasonGame>) {
  const played = games.filter(
    (game) => !game.exhibition && game.status === 'final' && game.result,
  )
  return (sport === 'hockey' ? ['W', 'L', 'T'] : ['W', 'L'])
    .map((result) => played.filter((game) => game.result === result).length)
    .join('–')
}

export function seasonResults(sport: TeamSport, games: Array<SeasonGame>) {
  const played = games.filter(
    (game) => !game.exhibition && game.status === 'final' && game.result,
  )
  const scored = played.filter(
    (game) => game.michiganScore !== null && game.opponentScore !== null,
  )
  const scoring = (key: 'michiganScore' | 'opponentScore') =>
    scored.length
      ? scored.reduce((sum, game) => sum + (game[key] ?? 0), 0) / scored.length
      : null
  return {
    played: played.length,
    record: seasonRecord(sport, played),
    conference: seasonRecord(
      sport,
      played.filter((game) => game.conference),
    ),
    home: seasonRecord(
      sport,
      played.filter((game) => game.venue === 'home'),
    ),
    away: seasonRecord(
      sport,
      played.filter((game) => game.venue === 'away'),
    ),
    neutral: seasonRecord(
      sport,
      played.filter((game) => game.venue === 'neutral'),
    ),
    scoredGames: scored.length,
    scoringFor: scoring('michiganScore'),
    scoringAgainst: scoring('opponentScore'),
    postseason: games.filter(
      (game) =>
        !game.exhibition &&
        game.status !== 'scheduled' &&
        (/NCAA|National Invitation|\bNIT\b|Big Ten (?:Tournament|Quarterfinal|Semifinal|Championship|First.Round)|CCHA (?:Tournament|Championship|Quarterfinal|Semifinal|First.Round)/i.test(
          `${game.tournament} ${game.opponent} ${game.note}`,
        ) ||
          /frozen[-_]four|ncaa[-_](?:regional|tournament)/i.test(
            game.recapUrl ?? '',
          )),
    ),
  }
}

export function seasonHonors(history: SeasonHistory | undefined) {
  if (!history) return []
  const honors: Array<string> = []
  if (/^NCAA champion$/i.test(history.postseason ?? ''))
    honors.push('National champions')
  if (/^T?1st$/.test(history.conferenceFinish))
    honors.push(
      `${history.conference} ${history.conferenceFinish.startsWith('T') ? 'regular-season co-champions' : 'regular-season champions'}`,
    )
  if (history.tournamentFinish === '1st')
    honors.push(`${history.conference} tournament champions`)
  return honors
}

export function seasonContributors(
  sport: TeamSport,
  entries: Array<SeasonPlayer>,
) {
  // A later departure does not erase a recorded contribution to this season.
  return entries
    .filter(
      (entry) =>
        typeof entry.values.games === 'number' && entry.values.games > 0,
    )
    .sort((a, b) => {
      const total = (values: TeamValues) => {
        if (sport === 'basketball') return numeric(values.minutes)
        if (values.position === 'G') return numeric(values.goalieMinutes)
        const goals = numeric(values.goals)
        const assists = numeric(values.assists)
        return goals === null || assists === null ? null : goals + assists
      }
      const left = total(a.values)
      const right = total(b.values)
      return (
        (left === null
          ? right === null
            ? 0
            : 1
          : right === null
            ? -1
            : right - left) ||
        String(a.values.name).localeCompare(String(b.values.name))
      )
    })
}

export function seasonLeaders(
  entries: Array<SeasonPlayer>,
  keys: Array<string>,
) {
  const measured = entries.flatMap((entry) => {
    const values = keys.map((key) => numeric(entry.values[key]))
    return values.every((value) => value !== null)
      ? [
          {
            entry,
            total: values.reduce<number>((sum, value) => sum + value, 0),
          },
        ]
      : []
  })
  if (!measured.length) return null
  const total = Math.max(...measured.map((row) => row.total))
  return {
    total,
    names: measured
      .filter((row) => row.total === total)
      .map((row) => String(row.entry.values.name)),
  }
}

function numeric(value: TeamValues[string]) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
