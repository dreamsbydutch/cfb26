export type Quadrant = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export function classifyQuadrant(powerRank: number | null): Quadrant | null {
  if (powerRank === null) return null
  if (!Number.isInteger(powerRank) || powerRank < 1) {
    throw new Error('Power rank must be a positive whole number.')
  }
  if (powerRank <= 35) return 'Q1'
  if (powerRank <= 70) return 'Q2'
  if (powerRank <= 105) return 'Q3'
  return 'Q4'
}

export function moveBallotEntry(
  entries: ReadonlyArray<string>,
  programKey: string,
  targetRank: number,
) {
  const currentIndex = entries.indexOf(programKey)
  if (currentIndex < 0) throw new Error('Ballot team was not found.')
  if (
    !Number.isInteger(targetRank) ||
    targetRank < 1 ||
    targetRank > entries.length
  ) {
    throw new Error('Target rank is outside the ballot.')
  }
  const next = [...entries]
  next.splice(currentIndex, 1)
  next.splice(targetRank - 1, 0, programKey)
  return next
}

export type PlayoffTeam = {
  conference: string | null
  conferenceChampion?: boolean
  eligible?: boolean
  programKey: string
  resumeRank: number
}

export type PlayoffRules = {
  byeCount: number
  championBidCount: number
  fieldSize: number
}

export function buildPlayoffProjection(input: {
  rules: PlayoffRules
  teams: Array<PlayoffTeam>
}) {
  const rules = input.rules
  if (
    !Number.isInteger(rules.fieldSize) ||
    rules.fieldSize < 2 ||
    !Number.isInteger(rules.championBidCount) ||
    rules.championBidCount < 0 ||
    rules.championBidCount > rules.fieldSize
  ) {
    throw new Error('Invalid playoff qualification rules.')
  }

  const ranked = input.teams
    .filter((team) => team.eligible !== false)
    .sort(
      (a, b) =>
        a.resumeRank - b.resumeRank || a.programKey.localeCompare(b.programKey),
    )
  const actualChampions = ranked.filter(
    (team) => team.conference && team.conferenceChampion,
  )
  const representedConferences = new Set(
    actualChampions.map((team) => team.conference),
  )
  const provisionalChampions = ranked.filter(
    (team, index, all) =>
      team.conference !== null &&
      !representedConferences.has(team.conference) &&
      all.findIndex((candidate) => candidate.conference === team.conference) ===
        index,
  )
  const guaranteedActualChampions = actualChampions
    .sort((a, b) => a.resumeRank - b.resumeRank)
    .slice(0, rules.championBidCount)
  const automatic = [
    ...guaranteedActualChampions,
    ...provisionalChampions
      .sort((a, b) => a.resumeRank - b.resumeRank)
      .slice(0, rules.championBidCount - guaranteedActualChampions.length),
  ]
  const automaticKeys = new Set(automatic.map((team) => team.programKey))
  const atLarge = ranked
    .filter((team) => !automaticKeys.has(team.programKey))
    .slice(0, rules.fieldSize - automatic.length)
  const selectedKeys = new Set(
    [...automatic, ...atLarge].map((team) => team.programKey),
  )
  const field = [...automatic, ...atLarge]
    .sort((a, b) => a.resumeRank - b.resumeRank)
    .map((team, index) => ({
      bid: automaticKeys.has(team.programKey)
        ? ('automatic' as const)
        : ('at_large' as const),
      bye: index < Math.min(rules.byeCount, rules.fieldSize),
      explanation: automaticKeys.has(team.programKey)
        ? team.conferenceChampion
          ? `Actual ${team.conference} champion.`
          : `Highest-ranked eligible ${team.conference} team.`
        : `Highest-ranked remaining eligible team at Résumé No. ${team.resumeRank}.`,
      programKey: team.programKey,
      seed: index + 1,
    }))

  return {
    field,
    firstTeamOut:
      ranked.find((team) => !selectedKeys.has(team.programKey))?.programKey ??
      null,
  }
}
