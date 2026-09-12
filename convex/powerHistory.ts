import type { PowerRatingTeam, PowerTeamRating } from './ratingSystem.ts'

export type PowerHistory = Map<
  string,
  { season: number; rating: PowerTeamRating }
>

/** Missing FBS-feed seasons are gaps in observation, not a reset of the program. */
export function historicalPowerPrior(
  team: Pick<PowerRatingTeam, 'id' | 'classification'>,
  season: number,
  history: PowerHistory,
  transitionPriorGames = 2,
): NonNullable<PowerRatingTeam['prior']> {
  if (!Number.isFinite(transitionPriorGames) || transitionPriorGames < 0)
    throw new Error('Transition prior weight must be finite and nonnegative.')
  const candidate = history.get(team.id)
  const previous =
    candidate && candidate.season < season ? candidate : undefined
  const cohort = [...history.values()].filter(
    (row) => row.season < season && row.rating.classification === 'fcs',
  )
  const fcsMean = cohort.length
    ? cohort.reduce((sum, row) => sum + row.rating.power, 0) / cohort.length
    : 0
  const baseline =
    (previous?.rating.classification ?? team.classification) === 'fcs'
      ? fcsMean
      : 0
  if (!previous)
    return {
      power: baseline,
      // No FCS population has been observed at the beginning of the history
      // window. Let cross-division evidence establish it; zero is not evidence.
      effectiveGames:
        team.classification === 'fcs' && cohort.length === 0 ? 0 : 8,
      sources: ['population_prior'],
    }
  const gap = Math.max(0, season - previous.season - 1)
  const retention = 0.5 ** gap
  const power = baseline + retention * (previous.rating.power - baseline)
  const sources = ['multi_season_performance']
  const transitioning =
    previous.rating.classification === 'fcs' && team.classification !== 'fcs'
  if (gap > 0) sources.push('historical_coverage_gap')
  if (transitioning) sources.push('subdivision_transition')
  if (previous.rating.gamesPlayed < 8) sources.push('population_prior')
  return {
    power,
    offense:
      baseline / 2 + retention * (previous.rating.offense - baseline / 2),
    defense:
      baseline / 2 + retention * (previous.rating.defense - baseline / 2),
    specialTeams: retention * previous.rating.specialTeams,
    effectiveGames: transitioning ? transitionPriorGames : 8,
    sources,
  }
}

export function rememberPowerSeason(
  history: PowerHistory,
  season: number,
  ratings: ReadonlyArray<PowerTeamRating>,
) {
  for (const rating of ratings) {
    // An empty imported schedule must not erase the last observed season.
    if (rating.gamesPlayed > 0) history.set(rating.teamId, { season, rating })
  }
}
