import {
  calibrateMargin,
  fitLogisticMarginCalibrator,
} from './ratingBacktest.ts'
import type {
  BacktestForecast,
  LogisticMarginCalibration,
} from './ratingBacktest.ts'
import type { PowerRatingEdition } from './ratingSystem.ts'

export type PowerCalibration = {
  scale: number
  homeOffset: number
  probability: LogisticMarginCalibration
  trainingSeasons: Array<number>
}

/** Fit only on earlier out-of-sample predictions, never final team ratings. */
export function fitPowerCalibration(
  rows: ReadonlyArray<BacktestForecast>,
  testSeason: number,
): PowerCalibration {
  if (rows.length < 100 || rows.some((row) => row.season >= testSeason))
    throw new Error('Calibration requires earlier-season forecasts.')
  let xx = 0,
    xh = 0,
    hh = 0,
    xy = 0,
    hy = 0
  for (const row of rows) {
    const x = row.predictedMargin,
      h = row.neutralSite ? 0 : 1,
      y = row.actualMargin
    if (![x, y].every(Number.isFinite))
      throw new Error('Invalid calibration forecast.')
    xx += x * x
    xh += x * h
    hh += h
    xy += x * y
    hy += h * y
  }
  const determinant = xx * hh - xh * xh
  const scale = Math.max(
    0.8,
    Math.min(
      1.5,
      determinant > 1e-9
        ? (xy * hh - hy * xh) / determinant
        : xx > 0
          ? xy / xx
          : 1,
    ),
  )
  const homeOffset = Math.max(
    -2,
    Math.min(2, determinant > 1e-9 ? (hy * xx - xy * xh) / determinant : 0),
  )
  // Mirror observations: a neutral game cannot depend on the arbitrary home label.
  const probability = fitLogisticMarginCalibrator(
    rows
      .filter((row) => row.actualMargin !== 0)
      .flatMap((row) => {
        const margin =
          row.predictedMargin * scale + (row.neutralSite ? 0 : homeOffset)
        const homeWon = row.actualMargin > 0 ? 1 : 0
        return [
          { predictedMargin: margin, homeWon, season: row.season },
          {
            predictedMargin: -margin,
            homeWon: 1 - homeWon,
            season: row.season,
          },
        ]
      }),
  )
  probability.fitCount = rows.length
  probability.intercept = 0
  return {
    scale,
    homeOffset,
    probability,
    trainingSeasons: [...new Set(rows.map((row) => row.season))].sort(
      (a, b) => a - b,
    ),
  }
}

export function calibrateForecast(
  row: BacktestForecast,
  fit: PowerCalibration,
): BacktestForecast {
  const predictedMargin =
    row.predictedMargin * fit.scale + (row.neutralSite ? 0 : fit.homeOffset)
  return {
    ...row,
    predictedMargin,
    homeWinProbability: calibrateMargin(predictedMargin, fit.probability),
  }
}

/** Scale the published point units together so table ratings and simulations agree. */
export function calibratePowerEdition(
  edition: PowerRatingEdition,
  fit: PowerCalibration,
): PowerRatingEdition {
  if (fit.trainingSeasons.some((year) => year >= edition.season))
    throw new Error('Future calibration cannot enter an edition.')
  const round = (value: number) => Math.round(value * 100) / 100
  return {
    ...edition,
    calibration: fit.probability,
    ratings: edition.ratings.map((row) => ({
      ...row,
      power: round(row.power * fit.scale),
      offense: round(row.offense * fit.scale),
      defense: round(row.defense * fit.scale),
      specialTeams: round(row.specialTeams * fit.scale),
      homeFieldAdvantage: round(
        row.homeFieldAdvantage * fit.scale + fit.homeOffset,
      ),
    })),
  }
}
