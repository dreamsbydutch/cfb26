import { fitLogisticMarginCalibrator } from '../../convex/ratingBacktest.ts'

/** Independent Elo units need their own learned point conversion, not foundation scale caps. */
export function fitResultCalibration(
  rows,
  testSeason,
  { allowNegativeScale = false } = {},
) {
  if (
    rows.length < 100 ||
    rows.some(
      (r) =>
        r.season >= testSeason ||
        ![r.season, r.predictedMargin, r.actualMargin].every(Number.isFinite),
    )
  )
    throw new Error('Result calibration requires earlier finite forecasts.')
  let xx = 0,
    xh = 0,
    hh = 0,
    xy = 0,
    hy = 0
  for (const r of rows) {
    const x = r.predictedMargin,
      h = r.neutralSite ? 0 : 1,
      y = r.actualMargin
    xx += x * x
    xh += x * h
    hh += h
    xy += x * y
    hy += h * y
  }
  const determinant = xx * hh - xh * xh
  const scale =
    determinant > 1e-9
      ? (xy * hh - hy * xh) / determinant
      : xx > 0
        ? xy / xx
        : 0
  const homeOffset = determinant > 1e-9 ? (hy * xx - xy * xh) / determinant : 0
  if (
    !Number.isFinite(scale) ||
    !Number.isFinite(homeOffset) ||
    (!allowNegativeScale && scale <= 0)
  )
    throw new Error('Result signal has no valid positive point conversion.')
  const probability = fitLogisticMarginCalibrator(
    rows
      .filter((r) => r.actualMargin !== 0)
      .flatMap((r) => {
        const predictedMargin =
            r.predictedMargin * scale + (r.neutralSite ? 0 : homeOffset),
          homeWon = Number(r.actualMargin > 0)
        return [
          { predictedMargin, homeWon, season: r.season },
          {
            predictedMargin: -predictedMargin,
            homeWon: 1 - homeWon,
            season: r.season,
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
    trainingSeasons: [...new Set(rows.map((r) => r.season))].sort(
      (a, b) => a - b,
    ),
  }
}
