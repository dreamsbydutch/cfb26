import type { PowerTeamRating } from './ratingSystem.ts'

export const PROGRAM_MODEL_VERSION = 'cfb26-program-v3'

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
  // Smooth aging; the newest five seasons retain roughly 82% of decade weight.
  return 0.74 ** age
}

/** Normalize sources independently before selecting a fallback: their raw units differ. */
export function acquisitionPercentiles(
  profiles: ReadonlyArray<{
    teamId: string
    talent: number | null
    recruitingPoints: number | null
  }>,
  field: ReadonlySet<string>,
) {
  const values = (key: 'talent' | 'recruitingPoints') =>
    new Map(
      profiles
        .filter(
          (row) =>
            field.has(row.teamId) &&
            row[key] !== null &&
            Number.isFinite(row[key]),
        )
        .map((row) => [row.teamId, row[key]!] as const),
    )
  const talent = values('talent'),
    recruiting = values('recruitingPoints')
  // A tiny observed cohort is not a credible national percentile distribution.
  const normalize = (source: Map<string, number>) =>
    source.size >= Math.max(1, field.size * 0.8)
      ? evidencePercentiles(source)
      : new Map<string, number>()
  const t = normalize(talent),
    r = normalize(recruiting)
  return new Map(
    [...field].flatMap((id) => {
      const value = t.get(id) ?? r.get(id)
      return value === undefined ? [] : [[id, value] as const]
    }),
  )
}

/** Preserve NFL output; bounded value-added cannot replace absolute production. */
export function developmentWithConversion(
  output: number,
  cohortTalent?: number,
) {
  if (!Number.isFinite(output) || output < 0 || output > 100)
    throw new Error('Draft output must be a percentile.')
  if (cohortTalent === undefined) return output
  if (!Number.isFinite(cohortTalent) || cohortTalent < 0 || cohortTalent > 100)
    throw new Error('Cohort talent must be a percentile.')
  return Math.max(
    0,
    Math.min(
      100,
      output + 0.2 * Math.max(-25, Math.min(25, output - cohortTalent)),
    ),
  )
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
