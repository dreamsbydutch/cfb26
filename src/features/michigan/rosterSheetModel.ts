export type RosterEligibilityBand =
  'final' | 'nfl_window' | 'underclassman' | 'incoming' | 'unknown'

export function collegeYear(enrollmentSeason: number | null, season: number) {
  return enrollmentSeason === null || enrollmentSeason > season
    ? null
    : season - enrollmentSeason + 1
}

export const ROSTER_GROUPS = [
  'starter',
  'rotation',
  'bench',
  'prospect',
  'recruit',
] as const

export type RosterGroup = (typeof ROSTER_GROUPS)[number]

export const ROSTER_GROUP_LABELS: Record<RosterGroup, string> = {
  starter: 'Starters',
  rotation: 'Rotation',
  bench: 'Bench',
  prospect: 'Prospects',
  recruit: 'Recruits',
}

export const ROSTER_GROUP_DESCRIPTIONS: Record<RosterGroup, string> = {
  starter: 'Players assigned a starting role.',
  rotation:
    'Players assigned meaningful playing time beyond minimal garbage-time snaps.',
  bench:
    'Players outside the starting lineup and rotation, with limited or no snaps.',
  prospect:
    'First- or second-year college players outside the starting lineup and rotation, with limited or no snaps.',
  recruit: 'Committed to Michigan but not yet enrolled on the selected roster.',
}

export function rosterGroup({
  enrollmentSeason,
  role,
  season,
}: {
  enrollmentSeason: number | null
  role: 'starter' | 'rotation' | 'reserve' | 'unassigned'
  season: number
}): Exclude<RosterGroup, 'recruit'> {
  // Owner-assigned playing roles take precedence over age or appearance totals.
  // Total snaps and games played cannot distinguish meaningful work from mop-up.
  if (role === 'starter' || role === 'rotation') return role
  const year = collegeYear(enrollmentSeason, season)
  return year !== null && year <= 2 ? 'prospect' : 'bench'
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
