export type BacktestForecast = {
  actualMargin: number
  awayClassification?: string
  featureCutoffAt: number
  gameId: string
  homeClassification?: string
  homeWinProbability: number
  kickoffAt: number
  neutralSite: boolean
  predictedMargin: number
  season: number
  seasonType: 'postseason' | 'regular'
  week: number
}

export type RollingFold<T extends BacktestForecast> = {
  evaluation: Array<T>
  testSeason: number
  training: Array<T>
}

export type CalibrationBucket = {
  actualWinRate: number
  count: number
  lowerBound: number
  meanProbability: number
  upperBound: number
}

export type ForecastMetrics = {
  brier: number
  calibrationBuckets: Array<CalibrationBucket>
  count: number
  expectedCalibrationError: number
  marginMae: number
  winnerAccuracy: number
}

export type ForecastEvaluation = {
  byFavoriteStrength: Record<string, ForecastMetrics>
  bySeason: Record<string, ForecastMetrics>
  bySubdivision: Record<string, ForecastMetrics>
  byVenue: Record<string, ForecastMetrics>
  byWeekRange: Record<string, ForecastMetrics>
  overall: ForecastMetrics
}

export type LogisticMarginCalibration = {
  fitCount: number
  intercept: number
  maximumProbability: number
  minimumProbability: number
  slope: number
  trainingSeasons: Array<number>
  version: 'logistic-margin-v1'
}

export type FoldScore = Pick<
  ForecastMetrics,
  'brier' | 'expectedCalibrationError' | 'marginMae'
> & { season: number }

export type ModelEvaluation = {
  folds: Array<FoldScore>
  modelVersion: string
}

export type SelectionDecision = {
  accepted: boolean
  reasons: Array<string>
}

function round(value: number, precision = 6) {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}

function mean(values: Array<number>) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function assertFinite(value: number, label: string) {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`)
}

function validateForecast(forecast: BacktestForecast) {
  assertFinite(forecast.actualMargin, 'Actual margin')
  assertFinite(forecast.predictedMargin, 'Predicted margin')
  assertFinite(forecast.homeWinProbability, 'Home win probability')
  if (forecast.homeWinProbability < 0 || forecast.homeWinProbability > 1) {
    throw new Error('Home win probability must be between 0 and 1.')
  }
  if (forecast.featureCutoffAt >= forecast.kickoffAt) {
    throw new Error(
      `Game ${forecast.gameId} must have a feature cutoff before kickoff.`,
    )
  }
}

export function buildRollingFolds<T extends BacktestForecast>(
  forecasts: ReadonlyArray<T>,
  minimumTrainingSeasons = 1,
): Array<RollingFold<T>> {
  if (!Number.isInteger(minimumTrainingSeasons) || minimumTrainingSeasons < 1) {
    throw new Error('Minimum training seasons must be a positive integer.')
  }
  for (const forecast of forecasts) validateForecast(forecast)
  const seasons = [
    ...new Set(forecasts.map((forecast) => forecast.season)),
  ].sort((left, right) => left - right)

  return seasons.slice(minimumTrainingSeasons).map((testSeason) => ({
    evaluation: forecasts.filter((forecast) => forecast.season === testSeason),
    testSeason,
    training: forecasts.filter((forecast) => forecast.season < testSeason),
  }))
}

function actualHomeResult(margin: number) {
  return margin === 0 ? 0.5 : margin > 0 ? 1 : 0
}

function calculateMetrics(
  forecasts: ReadonlyArray<BacktestForecast>,
): ForecastMetrics {
  if (forecasts.length === 0) {
    return {
      brier: 0,
      calibrationBuckets: [],
      count: 0,
      expectedCalibrationError: 0,
      marginMae: 0,
      winnerAccuracy: 0,
    }
  }

  const bucketRows = Array.from({ length: 10 }, () => ({
    actual: [] as Array<number>,
    probabilities: [] as Array<number>,
  }))
  let correctWinners = 0
  let decidedGames = 0
  for (const forecast of forecasts) {
    const actual = actualHomeResult(forecast.actualMargin)
    const bucketIndex = Math.min(
      Math.floor(forecast.homeWinProbability * 10),
      9,
    )
    bucketRows[bucketIndex].actual.push(actual)
    bucketRows[bucketIndex].probabilities.push(forecast.homeWinProbability)
    if (actual !== 0.5) {
      decidedGames += 1
      if (forecast.homeWinProbability >= 0.5 === (actual === 1)) {
        correctWinners += 1
      }
    }
  }
  const calibrationBuckets = bucketRows.flatMap((bucket, index) => {
    if (bucket.actual.length === 0) return []
    return [
      {
        actualWinRate: round(mean(bucket.actual)),
        count: bucket.actual.length,
        lowerBound: index / 10,
        meanProbability: round(mean(bucket.probabilities)),
        upperBound: (index + 1) / 10,
      },
    ]
  })
  const expectedCalibrationError = calibrationBuckets.reduce(
    (sum, bucket) =>
      sum +
      (bucket.count / forecasts.length) *
        Math.abs(bucket.actualWinRate - bucket.meanProbability),
    0,
  )

  return {
    brier: round(
      mean(
        forecasts.map(
          (forecast) =>
            (forecast.homeWinProbability -
              actualHomeResult(forecast.actualMargin)) **
            2,
        ),
      ),
    ),
    calibrationBuckets,
    count: forecasts.length,
    expectedCalibrationError: round(expectedCalibrationError),
    marginMae: round(
      mean(
        forecasts.map((forecast) =>
          Math.abs(forecast.predictedMargin - forecast.actualMargin),
        ),
      ),
    ),
    winnerAccuracy: round(
      decidedGames === 0 ? 0 : correctWinners / decidedGames,
    ),
  }
}

function evaluateGroups(
  forecasts: ReadonlyArray<BacktestForecast>,
  group: (forecast: BacktestForecast) => string,
) {
  const grouped = new Map<string, Array<BacktestForecast>>()
  for (const forecast of forecasts) {
    const key = group(forecast)
    grouped.set(key, [...(grouped.get(key) ?? []), forecast])
  }
  return Object.fromEntries(
    [...grouped].map(([key, rows]) => [key, calculateMetrics(rows)]),
  )
}

function favoriteStrength(forecast: BacktestForecast) {
  const margin = Math.abs(forecast.predictedMargin)
  if (margin <= 3) return 'toss_up'
  if (margin <= 7) return 'moderate'
  if (margin <= 14) return 'strong'
  return 'heavy'
}

function weekRange(forecast: BacktestForecast) {
  if (forecast.seasonType === 'postseason') return 'postseason'
  if (forecast.week <= 4) return 'weeks_1_4'
  if (forecast.week <= 8) return 'weeks_5_8'
  if (forecast.week <= 12) return 'weeks_9_12'
  return 'weeks_13_plus'
}

function subdivision(forecast: BacktestForecast) {
  const home = forecast.homeClassification?.toLowerCase()
  const away = forecast.awayClassification?.toLowerCase()
  return home === 'fbs' && away === 'fbs' ? 'fbs_vs_fbs' : 'includes_fcs'
}

export function evaluateForecasts(
  forecasts: ReadonlyArray<BacktestForecast>,
): ForecastEvaluation {
  for (const forecast of forecasts) validateForecast(forecast)
  return {
    byFavoriteStrength: evaluateGroups(forecasts, favoriteStrength),
    bySeason: evaluateGroups(forecasts, (forecast) => String(forecast.season)),
    bySubdivision: evaluateGroups(forecasts, subdivision),
    byVenue: evaluateGroups(forecasts, (forecast) =>
      forecast.neutralSite ? 'neutral' : 'home',
    ),
    byWeekRange: evaluateGroups(forecasts, weekRange),
    overall: calculateMetrics(forecasts),
  }
}

function logistic(value: number) {
  if (value >= 0) return 1 / (1 + Math.exp(-value))
  const exponential = Math.exp(value)
  return exponential / (1 + exponential)
}

export function calibrateMargin(
  predictedMargin: number,
  calibration: LogisticMarginCalibration,
) {
  assertFinite(predictedMargin, 'Predicted margin')
  return Math.min(
    Math.max(
      logistic(calibration.intercept + calibration.slope * predictedMargin),
      calibration.minimumProbability,
    ),
    calibration.maximumProbability,
  )
}

export function fitLogisticMarginCalibrator(
  rows: ReadonlyArray<
    Pick<BacktestForecast, 'predictedMargin' | 'season'> & { homeWon: number }
  >,
  options: {
    maximumProbability?: number
    minimumProbability?: number
    regularization?: number
  } = {},
): LogisticMarginCalibration {
  if (rows.length < 4)
    throw new Error('Calibration requires at least four games.')
  if (
    !rows.some((row) => row.homeWon === 0) ||
    !rows.some((row) => row.homeWon === 1)
  ) {
    throw new Error('Calibration requires both home wins and home losses.')
  }
  for (const row of rows) {
    assertFinite(row.predictedMargin, 'Predicted margin')
    if (row.homeWon !== 0 && row.homeWon !== 1) {
      throw new Error('Home-won outcomes must be either 0 or 1.')
    }
  }

  const regularization = options.regularization ?? 0.1
  const priorSlope = 1 / 6.5
  let intercept = 0
  let slope = priorSlope
  for (let iteration = 0; iteration < 50; iteration += 1) {
    let gradientIntercept = 0
    let gradientSlope = regularization * (slope - priorSlope)
    let hessianIntercept = 0
    let hessianSlope = regularization
    let hessianCross = 0
    for (const row of rows) {
      const probability = logistic(intercept + slope * row.predictedMargin)
      const residual = probability - row.homeWon
      const weight = Math.max(probability * (1 - probability), 1e-9)
      gradientIntercept += residual
      gradientSlope += residual * row.predictedMargin
      hessianIntercept += weight
      hessianCross += weight * row.predictedMargin
      hessianSlope += weight * row.predictedMargin ** 2
    }
    const determinant =
      hessianIntercept * hessianSlope - hessianCross * hessianCross
    if (Math.abs(determinant) < 1e-12) break
    const interceptStep =
      (hessianSlope * gradientIntercept - hessianCross * gradientSlope) /
      determinant
    const slopeStep =
      (-hessianCross * gradientIntercept + hessianIntercept * gradientSlope) /
      determinant
    intercept -= interceptStep
    slope = Math.max(slope - slopeStep, 1e-6)
    if (Math.max(Math.abs(interceptStep), Math.abs(slopeStep)) < 1e-8) break
  }

  const minimumProbability = options.minimumProbability ?? 0.01
  const maximumProbability = options.maximumProbability ?? 0.99
  if (
    minimumProbability < 0 ||
    maximumProbability > 1 ||
    minimumProbability >= maximumProbability
  ) {
    throw new Error('Calibration probability bounds are invalid.')
  }
  return {
    fitCount: rows.length,
    intercept: round(intercept, 10),
    maximumProbability,
    minimumProbability,
    slope: round(slope, 10),
    trainingSeasons: [...new Set(rows.map((row) => row.season))].sort(
      (left, right) => left - right,
    ),
    version: 'logistic-margin-v1',
  }
}

function aggregateFolds(evaluation: ModelEvaluation) {
  if (evaluation.folds.length === 0) {
    throw new Error(`${evaluation.modelVersion} has no held-out folds.`)
  }
  return {
    brier: mean(evaluation.folds.map((fold) => fold.brier)),
    expectedCalibrationError: mean(
      evaluation.folds.map((fold) => fold.expectedCalibrationError),
    ),
    marginMae: mean(evaluation.folds.map((fold) => fold.marginMae)),
  }
}

export function chooseChampion(
  incumbent: ModelEvaluation,
  challengers: ReadonlyArray<ModelEvaluation>,
  gates: {
    maximumCalibrationRegression?: number
    maximumRelativeFoldRegression?: number
    minimumHeldOutSeasons?: number
  } = {},
) {
  const maximumRelativeFoldRegression =
    gates.maximumRelativeFoldRegression ?? 0.03
  const maximumCalibrationRegression =
    gates.maximumCalibrationRegression ?? 0.015
  const minimumHeldOutSeasons = gates.minimumHeldOutSeasons ?? 8
  const baseline = aggregateFolds(incumbent)
  const incumbentBySeason = new Map(
    incumbent.folds.map((fold) => [fold.season, fold]),
  )
  const decisions: Record<string, SelectionDecision> = {}

  for (const challenger of challengers) {
    const reasons: Array<string> = []
    const aggregate = aggregateFolds(challenger)
    if (challenger.folds.length < minimumHeldOutSeasons) {
      reasons.push(
        minimumHeldOutSeasons === 8
          ? 'Challenger requires eight held-out seasons.'
          : `Challenger requires ${minimumHeldOutSeasons} held-out seasons.`,
      )
    }
    if (aggregate.marginMae >= baseline.marginMae) {
      reasons.push('Aggregate margin MAE did not improve.')
    }
    if (aggregate.brier >= baseline.brier) {
      reasons.push('Aggregate Brier score did not improve.')
    }
    if (
      aggregate.expectedCalibrationError >
      baseline.expectedCalibrationError + maximumCalibrationRegression
    ) {
      reasons.push('Aggregate calibration error regressed materially.')
    }

    let comparableFolds = 0
    let jointImprovements = 0
    for (const fold of challenger.folds) {
      const incumbentFold = incumbentBySeason.get(fold.season)
      if (!incumbentFold) continue
      comparableFolds += 1
      if (
        fold.marginMae < incumbentFold.marginMae &&
        fold.brier < incumbentFold.brier
      ) {
        jointImprovements += 1
      }
      if (
        fold.marginMae >
          incumbentFold.marginMae * (1 + maximumRelativeFoldRegression) ||
        fold.brier >
          incumbentFold.brier * (1 + maximumRelativeFoldRegression) ||
        fold.expectedCalibrationError >
          incumbentFold.expectedCalibrationError + maximumCalibrationRegression
      ) {
        reasons.push(`Held-out ${fold.season} regressed materially.`)
      }
    }
    if (comparableFolds !== incumbent.folds.length) {
      reasons.push('Challenger does not cover every incumbent held-out season.')
    } else if (jointImprovements <= comparableFolds / 2) {
      reasons.push(
        'Joint margin and Brier improvement did not win most seasons.',
      )
    }
    decisions[challenger.modelVersion] = {
      accepted: reasons.length === 0,
      reasons: [...new Set(reasons)],
    }
  }

  const accepted = challengers
    .filter((challenger) => decisions[challenger.modelVersion].accepted)
    .sort((left, right) => {
      const leftMetrics = aggregateFolds(left)
      const rightMetrics = aggregateFolds(right)
      return (
        leftMetrics.marginMae - rightMetrics.marginMae ||
        leftMetrics.brier - rightMetrics.brier
      )
    })

  return {
    champion: accepted[0] ?? incumbent,
    decisions,
    incumbent,
  }
}
