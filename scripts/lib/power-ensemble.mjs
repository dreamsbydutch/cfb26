import {
  calibrateMargin,
  fitLogisticMarginCalibrator,
} from '../../convex/ratingBacktest.ts'

const key = (row) => `${row.season}:${row.gameId}`

/** Join complete forecast cohorts; never silently score an easier intersection. */
export function alignComponents(components) {
  if (components.length < 2 || components.length > 8)
    throw new Error('Expected 2–8 components.')
  const maps = components.map((rows) => {
    const map = new Map(rows.map((row) => [key(row), row]))
    if (map.size !== rows.length) throw new Error('Duplicate forecast.')
    return map
  })
  if (maps.some((map) => map.size !== maps[0].size))
    throw new Error('Incomplete component cohort.')
  return components[0].map((row) => {
    const aligned = maps.map((map) => map.get(key(row)))
    if (
      aligned.some(
        (other) =>
          !other ||
          [
            'featureCutoffAt',
            'kickoffAt',
            'actualMargin',
            'neutralSite',
            'week',
            'seasonType',
          ].some((field) => other[field] !== row[field]),
      )
    )
      throw new Error('Unmatched forecast identity or cutoff.')
    if (
      ![row.featureCutoffAt, row.kickoffAt].every(Number.isFinite) ||
      !(row.featureCutoffAt < row.kickoffAt) ||
      !Number.isFinite(row.actualMargin) ||
      aligned.some((other) => !Number.isFinite(other.predictedMargin))
    )
      throw new Error('Invalid pregame forecast.')
    return { ...row, margins: aligned.map((other) => other.predictedMargin) }
  })
}

function solve(matrix, target) {
  const a = matrix.map((row, i) => [...row, target[i]])
  for (let c = 0; c < a.length; c++) {
    let pivot = c
    for (let r = c + 1; r < a.length; r++)
      if (Math.abs(a[r][c]) > Math.abs(a[pivot][c])) pivot = r
    if (Math.abs(a[pivot][c]) < 1e-10) return null
    ;[a[c], a[pivot]] = [a[pivot], a[c]]
    const divisor = a[c][c]
    for (let j = c; j <= a.length; j++) a[c][j] /= divisor
    for (let r = 0; r < a.length; r++) {
      if (r === c) continue
      const factor = a[r][c]
      for (let j = c; j <= a.length; j++) a[r][j] -= factor * a[c][j]
    }
  }
  return a.map((row) => row.at(-1))
}

/** Exact active-face least squares on the simplex: no prescribed component share. */
export function fitEnsembleWeights(rows, testSeason) {
  if (
    !Number.isInteger(testSeason) ||
    rows.length < 100 ||
    rows.some(
      (row) => !Number.isInteger(row.season) || row.season >= testSeason,
    )
  )
    throw new Error('Weights require at least 100 earlier-season forecasts.')
  const n = rows[0].margins.length
  if (
    n < 2 ||
    n > 8 ||
    rows.some(
      (row) =>
        row.margins.length !== n ||
        ![row.actualMargin, ...row.margins].every(Number.isFinite),
    )
  )
    throw new Error('Invalid component margins.')
  let best = null
  for (let mask = 1; mask < 2 ** n; mask++) {
    const indices = Array.from({ length: n }, (_, i) => i).filter(
      (i) => mask & (1 << i),
    )
    const anchor = indices[0],
      rest = indices.slice(1)
    const matrix = rest.map(() => rest.map(() => 0)),
      target = rest.map(() => 0)
    for (const row of rows) {
      const residual = row.actualMargin - row.margins[anchor]
      const x = rest.map((i) => row.margins[i] - row.margins[anchor])
      for (let i = 0; i < rest.length; i++) {
        target[i] += x[i] * residual
        for (let j = 0; j < rest.length; j++) matrix[i][j] += x[i] * x[j]
      }
    }
    const solution = rest.length ? solve(matrix, target) : []
    if (!solution) continue
    const weights = Array(n).fill(0)
    weights[anchor] = 1 - solution.reduce((sum, value) => sum + value, 0)
    rest.forEach((index, i) => {
      weights[index] = solution[i]
    })
    if (weights.some((weight) => weight < -1e-9)) continue
    const total = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0)
    weights.forEach((weight, i) => {
      weights[i] = Math.max(0, weight) / total
    })
    const mse =
      rows.reduce(
        (sum, row) =>
          sum +
          (row.actualMargin -
            row.margins.reduce(
              (value, margin, i) => value + weights[i] * margin,
              0,
            )) **
            2,
        0,
      ) / rows.length
    if (!best || mse < best.mse - 1e-10) best = { weights, mse }
  }
  return {
    ...best,
    fitCount: rows.length,
    trainingSeasons: [...new Set(rows.map((row) => row.season))].sort(
      (a, b) => a - b,
    ),
  }
}

export function combineForecast(row, fit) {
  if (fit.trainingSeasons.some((season) => season >= row.season))
    throw new Error('Future weights cannot enter a forecast.')
  if (row.margins.length !== fit.weights.length)
    throw new Error('Component dimension mismatch.')
  return {
    ...row,
    predictedMargin: row.margins.reduce(
      (sum, margin, i) => sum + margin * fit.weights[i],
      0,
    ),
    weightsTrainedThrough: Math.max(...fit.trainingSeasons),
  }
}

/** Calibrate only genuinely out-of-season ensemble predictions, not refitted training margins. */
export function fitEnsembleProbability(rows, testSeason) {
  if (
    !Number.isInteger(testSeason) ||
    rows.length < 100 ||
    rows.some(
      (row) =>
        !Number.isInteger(row.season) ||
        row.season >= testSeason ||
        !Number.isFinite(row.weightsTrainedThrough) ||
        row.weightsTrainedThrough >= row.season ||
        ![row.predictedMargin, row.actualMargin].every(Number.isFinite),
    )
  )
    throw new Error(
      'Probability calibration requires earlier cross-fitted ensemble forecasts.',
    )
  const probability = fitLogisticMarginCalibrator(
    rows
      .filter((row) => row.actualMargin !== 0)
      .flatMap((row) => [
        {
          predictedMargin: row.predictedMargin,
          homeWon: Number(row.actualMargin > 0),
          season: row.season,
        },
        {
          predictedMargin: -row.predictedMargin,
          homeWon: Number(row.actualMargin < 0),
          season: row.season,
        },
      ]),
  )
  probability.intercept = 0
  probability.fitCount = rows.filter((row) => row.actualMargin !== 0).length
  return {
    probability,
    trainingSeasons: [...new Set(rows.map((row) => row.season))].sort(
      (a, b) => a - b,
    ),
  }
}

export function applyEnsembleProbability(row, fit) {
  if (fit.trainingSeasons.some((season) => season >= row.season))
    throw new Error('Future probability calibration.')
  return {
    ...row,
    homeWinProbability: calibrateMargin(row.predictedMargin, fit.probability),
  }
}

/** The warm-up fold supplies calibration predictions without consuming a test season. */
export function evaluateLearnedEnsemble(joined, testSeasons) {
  if (
    !testSeasons.length ||
    testSeasons.some(
      (season, i) =>
        !Number.isInteger(season) ||
        (i > 0 && season !== testSeasons[i - 1] + 1),
    )
  )
    throw new Error('Expected consecutive test seasons.')
  const crossFitted = [],
    forecasts = [],
    fits = []
  for (const season of [testSeasons[0] - 1, ...testSeasons]) {
    const weights = fitEnsembleWeights(
      joined.filter((row) => row.season < season),
      season,
    )
    const combined = joined
      .filter((row) => row.season === season)
      .map((row) => combineForecast(row, weights))
    if (!combined.length) throw new Error('Missing ensemble season.')
    if (testSeasons.includes(season)) {
      const calibration = fitEnsembleProbability(crossFitted, season)
      forecasts.push(
        ...combined.map((row) => applyEnsembleProbability(row, calibration)),
      )
      fits.push({ season, weights, calibration })
    }
    crossFitted.push(...combined)
  }
  const season = testSeasons.at(-1) + 1
  return {
    forecasts,
    fits,
    finalFit: {
      season,
      weights: fitEnsembleWeights(
        joined.filter((row) => row.season < season),
        season,
      ),
      calibration: fitEnsembleProbability(crossFitted, season),
    },
  }
}
