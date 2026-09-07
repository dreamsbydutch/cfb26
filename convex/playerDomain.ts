export type PhasePerformance = {
  grade: number | null
  snaps: number | null
}

export type GradeBand =
  | 'Above average'
  | 'Below average'
  | 'Elite'
  | 'High quality'
  | 'Poor'
  | 'Slightly above average'
  | 'Ungraded'

export type EligibilityEvidence = {
  ageBasedExceptionSeasons: number
  competitionSeasons: Array<number>
  enrollmentSeason: number | null
  legacyRedshirtSeason: number | null
  medicalHardshipSeasons: number
  otherExtensionSeasons: number
}

export type EligibilityRule = {
  baseEligibilitySeasons: number
  clockSeasons: number
  legacyRedshirtExtendsClock: boolean
  season: number
}

const finiteNumber = (value: number, label: string) => {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`)
  return value
}

export function normalizePlayerGame(
  performance: PhasePerformance,
): PhasePerformance {
  const snaps = performance.snaps
  const grade = performance.grade

  if (snaps !== null) {
    finiteNumber(snaps, 'Snaps')
    if (!Number.isInteger(snaps))
      throw new Error('Snaps must be a whole number.')
    if (snaps < 0) throw new Error('Snaps cannot be negative.')
  }
  if (grade !== null) {
    finiteNumber(grade, 'Grade')
    if (grade < 0 || grade > 100) {
      throw new Error('Grade must be between 0 and 100.')
    }
  }
  if (snaps === 0 && grade !== null) {
    throw new Error('A grade is invalid with explicit zero snaps.')
  }

  return {
    grade: grade === null ? null : Math.round(grade * 10) / 10,
    snaps,
  }
}

export function classifyPlayerGrade(grade: number | null): GradeBand {
  if (grade === null) return 'Ungraded'
  if (grade >= 90) return 'Elite'
  if (grade >= 80) return 'High quality'
  if (grade >= 70) return 'Above average'
  if (grade >= 60) return 'Slightly above average'
  if (grade >= 50) return 'Below average'
  return 'Poor'
}

export function summarizePhaseGrades(rows: Array<PhasePerformance>) {
  let gradedSnaps = 0
  let knownSnaps = 0
  let weightedPoints = 0
  const unknownSnapGrades: Array<number> = []

  for (const raw of rows) {
    const row = normalizePlayerGame(raw)
    if (row.snaps !== null) knownSnaps += row.snaps
    if (row.grade === null) continue
    if (row.snaps === null) {
      unknownSnapGrades.push(row.grade)
      continue
    }
    if (row.snaps > 0) {
      gradedSnaps += row.snaps
      weightedPoints += row.grade * row.snaps
    }
  }

  return {
    gradedSnaps,
    knownSnaps,
    ungradedKnownSnaps: knownSnaps - gradedSnaps,
    unknownSnapGrades,
    weightedGrade:
      gradedSnaps === 0
        ? null
        : Math.round((weightedPoints / gradedSnaps) * 10) / 10,
  }
}

export function summarizeOverallGrade(
  rows: Array<{
    defense: PhasePerformance
    offense: PhasePerformance
    specialTeams: PhasePerformance
  }>,
) {
  const summary = summarizePhaseGrades(
    rows.flatMap((row) => [row.offense, row.defense, row.specialTeams]),
  )
  return {
    ...summary,
    band: classifyPlayerGrade(summary.weightedGrade),
  }
}

export function deriveEligibility(input: {
  evidence: EligibilityEvidence
  override: number | null
  rule: EligibilityRule
}) {
  const { evidence, override, rule } = input
  const warnings: Array<string> = []
  if (evidence.enrollmentSeason === null) {
    return {
      derivedEligibleThroughSeason: null,
      eligibleThroughSeason: override,
      source: override === null ? ('unknown' as const) : ('override' as const),
      warnings,
    }
  }

  const includedRedshirt = Math.max(
    rule.clockSeasons - rule.baseEligibilitySeasons,
    0,
  )
  const extraRedshirt =
    rule.legacyRedshirtExtendsClock &&
    evidence.legacyRedshirtSeason !== null &&
    includedRedshirt === 0
      ? 1
      : 0
  const derivedEligibleThroughSeason =
    evidence.enrollmentSeason +
    Math.max(rule.clockSeasons, rule.baseEligibilitySeasons) -
    1 +
    extraRedshirt +
    evidence.medicalHardshipSeasons +
    evidence.otherExtensionSeasons +
    evidence.ageBasedExceptionSeasons

  if (override !== null && override !== derivedEligibleThroughSeason) {
    warnings.push('Owner override differs from the season-rule derivation.')
  }
  if (
    evidence.competitionSeasons.length > rule.baseEligibilitySeasons &&
    override === null
  ) {
    warnings.push('Competition evidence exceeds the base eligibility seasons.')
  }

  return {
    derivedEligibleThroughSeason,
    eligibleThroughSeason: override ?? derivedEligibleThroughSeason,
    source: override === null ? ('derived' as const) : ('override' as const),
    warnings,
  }
}

const POSITION_ROOMS: Readonly<Record<string, string>> = {
  C: 'Offensive line',
  CB: 'Secondary',
  DB: 'Secondary',
  DE: 'Defensive line',
  DL: 'Defensive line',
  DT: 'Defensive line',
  EDGE: 'Defensive line',
  FB: 'Backs',
  FS: 'Secondary',
  G: 'Offensive line',
  HB: 'Backs',
  ILB: 'Linebackers',
  K: 'Specialists',
  LG: 'Offensive line',
  LB: 'Linebackers',
  LT: 'Offensive line',
  LS: 'Specialists',
  NICKEL: 'Secondary',
  NT: 'Defensive line',
  OC: 'Offensive line',
  OG: 'Offensive line',
  OL: 'Offensive line',
  OLB: 'Linebackers',
  OT: 'Offensive line',
  P: 'Specialists',
  QB: 'Quarterbacks',
  RB: 'Backs',
  RG: 'Offensive line',
  RT: 'Offensive line',
  S: 'Secondary',
  SLOT: 'Receivers',
  SS: 'Secondary',
  TE: 'Receivers',
  WR: 'Receivers',
}

const POSITION_ROOM_ORDER = [
  'Quarterbacks',
  'Backs',
  'Receivers',
  'Offensive line',
  'Defensive line',
  'Linebackers',
  'Secondary',
  'Specialists',
] as const

export function derivePositionRoom(listedPosition: string) {
  return POSITION_ROOMS[listedPosition.trim().toUpperCase()] ?? 'Other'
}

export function comparePositionRooms(left: string, right: string) {
  const leftIndex = POSITION_ROOM_ORDER.indexOf(
    left as (typeof POSITION_ROOM_ORDER)[number],
  )
  const rightIndex = POSITION_ROOM_ORDER.indexOf(
    right as (typeof POSITION_ROOM_ORDER)[number],
  )
  return (
    (leftIndex < 0 ? POSITION_ROOM_ORDER.length : leftIndex) -
      (rightIndex < 0 ? POSITION_ROOM_ORDER.length : rightIndex) ||
    left.localeCompare(right)
  )
}
