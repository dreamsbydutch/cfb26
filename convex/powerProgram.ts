import { programForecast } from './programContext.ts'
import { POWER_MODEL_VERSION } from './ratingSystem.ts'
import type { ProgramContext, ProgramForecastFit } from './programContext.ts'
import type { LogisticMarginCalibration } from './ratingBacktest.ts'
import type { PowerRatingEdition } from './ratingSystem.ts'

export type PowerProgramFit = {
  weight: number
  scale: number
  homeOffset: number
  trainingSeasons: Array<number>
  probability: LogisticMarginCalibration
}

/** Final forecast only: never feed this blend into recursive history or Program. */
export function withProgramPower(
  edition: PowerRatingEdition,
  contexts: ReadonlyMap<string, ProgramContext>,
  mapping: ProgramForecastFit | undefined,
  fit: PowerProgramFit,
): PowerRatingEdition {
  if (
    !fit.trainingSeasons.length ||
    [...fit.trainingSeasons, ...fit.probability.trainingSeasons].some(
      (year) => year >= edition.season,
    ) ||
    ![fit.weight, fit.scale, fit.homeOffset].every(Number.isFinite) ||
    fit.weight < 0 ||
    fit.weight > 1
  )
    throw new Error('Program blend requires valid earlier-season training.')
  const round = (value: number) => Math.round(value * 100) / 100
  const ratings = edition.ratings.map((row) => {
    if (!row.published) return row
    if (row.powerWithoutProgram)
      throw new Error('Program blend already applied.')
    const { power, offense, defense, specialTeams, homeFieldAdvantage } = row
    const programPoints =
      (programForecast(contexts.get(row.teamId), mapping, edition.season) ??
        0) * fit.scale
    const blendedPower = round(
      (1 - fit.weight) * power + fit.weight * programPoints,
    )
    // History supplies overall strength, not independently measured unit efficiency.
    const adjustment = (blendedPower - power) / 2
    return {
      ...row,
      power: blendedPower,
      offense: round(offense + adjustment),
      defense: round(defense + adjustment),
      homeFieldAdvantage: round(
        (1 - fit.weight) * homeFieldAdvantage +
          fit.weight * (2.5 * fit.scale + fit.homeOffset),
      ),
      powerWithoutProgram: {
        power,
        offense,
        defense,
        specialTeams,
        homeFieldAdvantage,
      },
    }
  })
  const published = ratings
    .filter((row) => row.published)
    .sort((a, b) => b.power - a.power || a.name.localeCompare(b.name))
    .map((row, index) => ({ ...row, rank: index + 1 }))
  return {
    ...edition,
    modelVersion: POWER_MODEL_VERSION,
    calibration: fit.probability,
    ratings: [...published, ...ratings.filter((row) => !row.published)],
  }
}
