import type { PowerTeamRating } from './ratingSystem.ts'

export const PROGRAM_MODEL_VERSION = 'cfb26-program-v1'

export type ProgramSeasonEvidence = {
  teamId: string
  season: number
  games: number
  performance: number
  // Comparable within-season percentiles. Missing coverage stays missing.
  acquisition?: number
  development?: number
}

export type ProgramRating = {
  teamId: string
  programRating: number
  programRank: number
  programResults: number
  programAcquisition: number | null
  programDevelopment: number | null
  programCoverage: number
  programSeasons: number
  programUncertainty: number
}

export function programSeasonWeight(age: number) {
  if (!Number.isInteger(age) || age < 0 || age > 9) return 0
  return [1, 0.85, 0.7, 0.55, 0.4, 0.15, 0.12, 0.09, 0.06, 0.03][age]
}

/** Midrank percentiles preserve ties; coverage gates belong to the source adapter. */
export function evidencePercentiles(values: ReadonlyMap<string, number>) {
  const entries = [...values].sort((a, b) => a[1] - b[1])
  const result = new Map<string, number>()
  for (let start = 0; start < entries.length;) {
    let end = start + 1
    while (end < entries.length && entries[end][1] === entries[start][1]) end++
    const percentile =
      entries.length === 1
        ? 50
        : (100 * ((start + end - 1) / 2)) / (entries.length - 1)
    for (let index = start; index < end; index++)
      result.set(entries[index][0], percentile)
    start = end
  }
  return result
}

export function buildProgramRatings(input: {
  season: number
  teams: ReadonlyArray<Pick<PowerTeamRating, 'teamId' | 'published'>>
  evidence: ReadonlyArray<ProgramSeasonEvidence>
}): Array<ProgramRating> {
  const keys = new Set<string>()
  for (const row of input.evidence) {
    const key = `${row.teamId}:${row.season}`
    if (keys.has(key)) throw new Error('Duplicate program season evidence.')
    keys.add(key)
    if (
      ![row.performance, row.games, row.season].every(Number.isFinite) ||
      row.games < 0
    )
      throw new Error('Invalid program evidence.')
  }
  const maximumWeight = Array.from({ length: 10 }, (_, age) =>
    programSeasonWeight(age),
  ).reduce((a, b) => a + b, 0)
  const ratings = input.teams
    .filter((team) => team.published)
    .map((team) => {
      const rows = input.evidence.filter(
        (row) =>
          row.teamId === team.teamId &&
          programSeasonWeight(input.season - row.season) > 0,
      )
      const component = (
        key: 'performance' | 'acquisition' | 'development',
      ) => {
        let sum = 0
        let weight = 0
        for (const row of rows) {
          const value = row[key]
          if (value === undefined) continue
          const w =
            programSeasonWeight(input.season - row.season) *
            (key === 'performance' ? Math.min(row.games / 12, 1) : 1)
          sum += value * w
          weight += w
        }
        return { value: weight > 0 ? sum / weight : null, weight }
      }
      const results = component('performance')
      const acquisition = component('acquisition')
      const development = component('development')
      // Fixed weights prevent rich coverage alone from increasing the score.
      // Neutral regularization is an estimate, never an assertion of observed average performance.
      const score = (value: number | null) => value ?? 50
      const coverage =
        (0.7 * results.weight +
          0.2 * acquisition.weight +
          0.1 * development.weight) /
        maximumWeight
      const resultReliability = Math.min(results.weight / 1.5, 1)
      const programResults =
        50 + (score(results.value) - 50) * resultReliability
      return {
        teamId: team.teamId,
        programRating:
          Math.round(
            (programResults * 0.7 +
              score(acquisition.value) * 0.2 +
              score(development.value) * 0.1) *
              100,
          ) / 100,
        programRank: 0,
        programResults,
        programAcquisition: acquisition.value,
        programDevelopment: development.value,
        programCoverage: Math.round(coverage * 100),
        programSeasons: rows.filter((row) => row.games > 0).length,
        programUncertainty: Math.round(5 + 25 * (1 - coverage)),
      }
    })
    .sort(
      (a, b) =>
        b.programRating - a.programRating || a.teamId.localeCompare(b.teamId),
    )
  return ratings.map((row, index) => ({ ...row, programRank: index + 1 }))
}
