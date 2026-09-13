import type { PowerRatingTeam } from './ratingSystem.ts'

export type RosterProfile = {
  teamId: string
  talent: number | null
  recruitingPoints: number | null
  returningUsage: number | null
}
export type RosterContext = {
  talent: number
  recruiting: number
  returning: number
  hasTalent: number
  hasRecruiting: number
  hasReturning: number
}
export type RosterFit = {
  coefficients: Array<number>
  trainingSeasons: Array<number>
  count: number
}
export type RosterTrainingRow = {
  season: number
  prior: number
  context: RosterContext
  target: number
}

/** Annual source scales are fitted on the observed FBS field, independently. */
export function rosterContexts(
  profiles: ReadonlyArray<RosterProfile>,
  field: ReadonlySet<string>,
) {
  const rows = profiles.filter((p) => field.has(p.teamId))
  const normalize = (key: 'talent' | 'recruitingPoints') => {
    const valid = rows.filter((p) => p[key] !== null && Number.isFinite(p[key]))
    if (valid.length < Math.max(2, field.size * 0.8))
      return new Map<string, number>()
    const mean = valid.reduce((s, p) => s + p[key]!, 0) / valid.length
    const sd = Math.sqrt(
      valid.reduce((s, p) => s + (p[key]! - mean) ** 2, 0) / valid.length,
    )
    return new Map(
      valid.map((p) => [
        p.teamId,
        sd > 0 ? Math.max(-3, Math.min(3, (p[key]! - mean) / sd)) : 0,
      ]),
    )
  }
  const talent = normalize('talent'),
    recruiting = normalize('recruitingPoints')
  return new Map(
    rows.map((p) => {
      const returning = p.returningUsage
      const valid =
        returning !== null &&
        Number.isFinite(returning) &&
        returning >= 0 &&
        returning <= 1
      return [
        p.teamId,
        {
          talent: talent.get(p.teamId) ?? 0,
          recruiting: recruiting.get(p.teamId) ?? 0,
          returning: valid ? returning - 0.5 : 0,
          hasTalent: Number(talent.has(p.teamId)),
          hasRecruiting: Number(recruiting.has(p.teamId)),
          hasReturning: Number(valid),
        },
      ] as const
    }),
  )
}

function features(prior: number, c: RosterContext) {
  return [
    1,
    prior / 15,
    c.talent,
    c.recruiting,
    c.returning,
    (prior / 15) * c.returning,
    c.hasTalent,
    c.hasRecruiting,
    c.hasReturning,
  ]
}

/** Small ridge regression; every target season must precede the forecast season. */
export function fitRosterForecast(
  rows: ReadonlyArray<RosterTrainingRow>,
  forecastSeason: number,
): RosterFit {
  if (rows.length < 200 || rows.some((r) => r.season >= forecastSeason))
    throw new Error(
      'Roster training requires earlier seasons and at least 200 team seasons.',
    )
  const size = 9,
    a = Array.from(
      { length: size },
      () => Array(size + 1).fill(0) as Array<number>,
    )
  for (const row of rows) {
    const x = features(row.prior, row.context),
      y = row.target / 15
    if (![...x, y].every(Number.isFinite))
      throw new Error('Invalid roster training row.')
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < size; j++) a[i][j] += x[i] * x[j]
      a[i][size] += x[i] * y
    }
  }
  for (let i = 0; i < size; i++) a[i][i] += i === 0 ? 1e-6 : 10
  for (let i = 0; i < size; i++) {
    let pivot = i
    for (let j = i + 1; j < size; j++)
      if (Math.abs(a[j][i]) > Math.abs(a[pivot][i])) pivot = j
    ;[a[i], a[pivot]] = [a[pivot], a[i]]
    const value = a[i][i]
    if (Math.abs(value) < 1e-10) throw new Error('Singular roster fit.')
    for (let j = i; j <= size; j++) a[i][j] /= value
    for (let k = 0; k < size; k++) {
      if (k === i) continue
      const factor = a[k][i]
      for (let j = i; j <= size; j++) a[k][j] -= factor * a[i][j]
    }
  }
  return {
    coefficients: a.map((row) => row[size]),
    trainingSeasons: [...new Set(rows.map((r) => r.season))].sort(
      (left, right) => left - right,
    ),
    count: rows.length,
  }
}

export function withRosterForecast(
  prior: NonNullable<PowerRatingTeam['prior']>,
  context: RosterContext | undefined,
  fit: RosterFit | undefined,
  season: number,
  weight = 0.5,
) {
  if (
    !fit ||
    !context ||
    (!context.hasTalent && !context.hasRecruiting && !context.hasReturning)
  )
    return prior
  if (
    fit.trainingSeasons.some((s) => s >= season) ||
    !Number.isFinite(weight) ||
    weight < 0 ||
    weight > 1
  )
    throw new Error('Invalid roster forecast boundary.')
  const estimate =
    15 *
    features(prior.power ?? 0, context).reduce(
      (s, x, i) => s + x * fit.coefficients[i],
      0,
    )
  if (!Number.isFinite(estimate)) throw new Error('Invalid roster forecast.')
  const adjustment =
    weight * Math.max(-8, Math.min(8, estimate - (prior.power ?? 0)))
  // Talent is team-wide. Continuity remains offensive; no defensive returners are invented.
  return {
    ...prior,
    power: (prior.power ?? 0) + adjustment,
    offense: (prior.offense ?? (prior.power ?? 0) / 2) + adjustment / 2,
    defense: (prior.defense ?? (prior.power ?? 0) / 2) + adjustment / 2,
    sources: [...prior.sources, 'trained_roster_forecast'],
  }
}
