import type { TeamSport, TeamValues } from '../../../convex/teamRosterFields'

export function metricValues(
  sport: TeamSport,
  goalie: boolean,
  v: TeamValues,
): Array<string | number> {
  const rate = (key: string) =>
    typeof v[key] === 'number' && typeof v.games === 'number' && v.games > 0
      ? (v[key] / v.games).toFixed(1)
      : '—'
  if (sport === 'basketball')
    return ['minutes', 'points', 'rebounds', 'assists']
      .map(rate)
      .concat(
        ['fgPct', 'threePct', 'ftPct'].map((key) =>
          typeof v[key] === 'number' ? `${v[key].toFixed(1)}%` : '—',
        ),
      )
  if (goalie)
    return [
      v.wins ?? '—',
      typeof v.saves === 'number' &&
      typeof v.goalsAgainst === 'number' &&
      v.saves + v.goalsAgainst > 0
        ? (v.saves / (v.saves + v.goalsAgainst)).toFixed(3)
        : '—',
      typeof v.goalsAgainst === 'number' &&
      typeof v.goalieMinutes === 'number' &&
      v.goalieMinutes > 0
        ? ((60 * v.goalsAgainst) / v.goalieMinutes).toFixed(2)
        : '—',
      v.shutouts ?? '—',
    ]
  return [
    v.goals ?? '—',
    v.assists ?? '—',
    typeof v.goals === 'number' && typeof v.assists === 'number'
      ? v.goals + v.assists
      : '—',
    v.shots ?? '—',
    v.pim ?? '—',
  ]
}
