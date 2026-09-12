import type { PowerRatingTeam, PowerTeamRating } from './ratingSystem.ts'

export type PowerHistory = Map<
  string,
  { season: number; rating: PowerTeamRating }
>

export type PowerCarryover = {
  transitionPriorGames: number
  priorGames: number
  seasonRetention: number
}

export const POWER_CARRYOVER: Readonly<PowerCarryover> = {
  transitionPriorGames: 2,
  priorGames: 4,
  seasonRetention: 1,
}

/** Offensive continuity changes confidence, not a fabricated defensive roster estimate. */
export function offensiveReturningShare(profile?: {
  passingUsage?: number
  receivingUsage?: number
  returningUsage: number | null
}): number | undefined {
  if (!profile) return undefined
  const value =
    profile.passingUsage !== undefined && profile.receivingUsage !== undefined
      ? (profile.passingUsage + profile.receivingUsage) / 2
      : profile.returningUsage
  return value !== null && Number.isFinite(value) && value >= 0 && value <= 1
    ? value
    : undefined
}

export function withOffensiveContinuity(
  prior: NonNullable<PowerRatingTeam['prior']>,
  share?: number,
) {
  if (share === undefined) return prior
  if (!Number.isFinite(share) || share < 0 || share > 1)
    throw new Error('Continuity must be a share.')
  return {
    ...prior,
    effectiveGames: prior.effectiveGames * (0.75 + 0.25 * share),
    offenseEffectiveGames: prior.effectiveGames * (0.5 + 0.5 * share),
    defenseEffectiveGames: prior.effectiveGames,
    sources: [...prior.sources, 'verified_offensive_continuity'],
  }
}

/** Missing FBS-feed seasons are gaps in observation, not a reset of the program. */
export function historicalPowerPrior(
  team: Pick<PowerRatingTeam, 'id' | 'classification'>,
  season: number,
  history: PowerHistory,
  policy: Partial<PowerCarryover> = {},
): NonNullable<PowerRatingTeam['prior']> {
  // Defaults preserve the v2 reconstruction; production passes its versioned policy.
  const {
    transitionPriorGames = 2,
    priorGames = 8,
    seasonRetention = 1,
  } = policy
  if (!Number.isFinite(transitionPriorGames) || transitionPriorGames < 0)
    throw new Error('Transition prior weight must be finite and nonnegative.')
  if (
    !Number.isFinite(priorGames) ||
    priorGames < 0 ||
    !Number.isFinite(seasonRetention) ||
    seasonRetention < 0 ||
    seasonRetention > 1
  )
    throw new Error('Invalid historical carryover policy.')
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
        team.classification === 'fcs' && cohort.length === 0 ? 0 : priorGames,
      sources: ['population_prior'],
    }
  const gap = Math.max(0, season - previous.season - 1)
  const retention = seasonRetention * 0.5 ** gap
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
    effectiveGames: transitioning
      ? Math.min(transitionPriorGames, priorGames)
      : priorGames,
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
