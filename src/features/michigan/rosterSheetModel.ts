export type RosterEligibilityBand =
  'final' | 'nfl_window' | 'underclassman' | 'incoming' | 'unknown'

export function collegeYear(enrollmentSeason: number | null, season: number) {
  return enrollmentSeason === null || enrollmentSeason > season
    ? null
    : season - enrollmentSeason + 1
}

export function rosterEligibilityBand({
  eligibleThroughSeason,
  enrollmentSeason,
  incoming = false,
  season,
}: {
  eligibleThroughSeason: number | null
  enrollmentSeason: number | null
  incoming?: boolean
  season: number
}): RosterEligibilityBand {
  if (incoming) return 'incoming'
  if (eligibleThroughSeason === null) return 'unknown'
  if (eligibleThroughSeason <= season) return 'final'
  const year = collegeYear(enrollmentSeason, season)
  if (year === null) return 'unknown'
  return year <= 2 ? 'underclassman' : 'nfl_window'
}
