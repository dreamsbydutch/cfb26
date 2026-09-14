export type ProgramContext = {
  programRating: number
  programSeasons: number
  historyThroughSeason: number
}
export type ProgramForecastFit = {
  intercept: number
  slope: number
  count: number
  trainingSeasons: Array<number>
}

export function fitProgramForecast(
  rows: ReadonlyArray<{
    season: number
    programRating: number
    target: number
  }>,
  forecastSeason: number,
): ProgramForecastFit {
  if (
    rows.length < 200 ||
    rows.some(
      (row) =>
        row.season >= forecastSeason ||
        ![row.season, row.programRating, row.target].every(Number.isFinite),
    )
  )
    throw new Error('Program forecast needs earlier-season training targets.')
  const x = rows.reduce((sum, row) => sum + row.programRating, 0) / rows.length
  const y = rows.reduce((sum, row) => sum + row.target, 0) / rows.length
  const variance = rows.reduce(
    (sum, row) => sum + (row.programRating - x) ** 2,
    0,
  )
  const covariance = rows.reduce(
    (sum, row) => sum + (row.programRating - x) * (row.target - y),
    0,
  )
  const slope = variance > 1e-9 ? covariance / variance : 0
  return {
    intercept: y - slope * x,
    slope,
    count: rows.length,
    trainingSeasons: [...new Set(rows.map((row) => row.season))].sort(
      (a, b) => a - b,
    ),
  }
}

function validContext(context: ProgramContext | undefined, season: number) {
  if (!context) return false
  if (
    !Number.isInteger(context.historyThroughSeason) ||
    context.historyThroughSeason >= season ||
    !Number.isFinite(context.programRating) ||
    context.programRating < 0 ||
    context.programRating > 100 ||
    !Number.isInteger(context.programSeasons) ||
    context.programSeasons < 0
  )
    throw new Error(
      'Program context must contain only completed prior seasons.',
    )
  return context.programSeasons > 0
}

export function programForecast(
  context: ProgramContext | undefined,
  fit: ProgramForecastFit | undefined,
  season: number,
): number | undefined {
  if (!validContext(context, season) || !fit) return undefined
  if (
    !fit.trainingSeasons.length ||
    fit.trainingSeasons.some((year) => year >= season) ||
    ![fit.slope, fit.intercept].every(Number.isFinite)
  )
    throw new Error('Future or invalid Program forecast fit.')
  return Math.max(
    -25,
    Math.min(25, fit.intercept + fit.slope * context!.programRating),
  )
}

/** Deliberate merit policy: zero for unknown/average history, at most 0.15 win-equivalents. */
export function resumeProgramBonus(
  context: ProgramContext | undefined,
  season: number,
  wins: number,
) {
  if (!validContext(context, season) || wins <= 0) return 0
  return 0.15 * Math.max(0, (context!.programRating - 50) / 50)
}

/** Half one game of opponent evidence; actual current-season games dilute its influence. */
export function resumeProgramPrior(
  context: ProgramContext | undefined,
  fit: ProgramForecastFit | undefined,
  season: number,
) {
  const power = programForecast(context, fit, season)
  return power === undefined
    ? undefined
    : {
        power,
        offense: power / 2,
        defense: power / 2,
        effectiveGames: 0.5,
        sources: ['prior_season_program_context'],
      }
}
