import test from 'node:test'
import assert from 'node:assert/strict'
import {
  alignComponents,
  fitEnsembleWeights,
  combineForecast,
  fitEnsembleProbability,
  applyEnsembleProbability,
  evaluateLearnedEnsemble,
} from '../scripts/lib/power-ensemble.mjs'

const rows = Array.from({ length: 200 }, (_, i) => {
  const x = (i % 19) - 9,
    y = (i % 13) - 6
  return {
    gameId: String(i),
    season: 2020,
    week: 1,
    seasonType: 'regular',
    kickoffAt: 100,
    featureCutoffAt: 99,
    neutralSite: true,
    margins: [x, y, -x - y],
    predictedMargin: x,
    actualMargin: 0.7 * x + 0.3 * y,
  }
})

test('weights recover a known mixture, allow zero shares and remain on the simplex', () => {
  const fit = fitEnsembleWeights(rows, 2021)
  assert.ok(Math.abs(fit.weights[0] - 0.7) < 1e-8)
  assert.ok(Math.abs(fit.weights[1] - 0.3) < 1e-8)
  assert.ok(fit.weights[2] < 1e-8)
  assert.ok(fit.mse < 1e-12)
  const single = fitEnsembleWeights(
    rows.map((row) => ({ ...row, actualMargin: row.margins[0] })),
    2021,
  )
  assert.deepEqual(single.weights, [1, 0, 0])
  const constrained = fitEnsembleWeights(
    rows.map((row) => ({
      ...row,
      actualMargin: 2 * row.margins[0] - row.margins[1],
    })),
    2021,
  )
  assert.ok(constrained.weights.every((weight) => weight >= 0))
  assert.ok(
    Math.abs(constrained.weights.reduce((sum, weight) => sum + weight, 0) - 1) <
      1e-12,
  )
})

test('duplicate components have a deterministic finite solution; future weights are refused', () => {
  const duplicate = rows.map((row) => ({
    ...row,
    margins: [row.predictedMargin, row.predictedMargin],
    actualMargin: row.predictedMargin,
  }))
  assert.deepEqual(fitEnsembleWeights(duplicate, 2021).weights, [1, 0])
  assert.throws(() => fitEnsembleWeights(rows, 2020), /earlier-season/)
  assert.throws(() => fitEnsembleWeights(rows.slice(0, 99), 2021), /100/)
  const fit = fitEnsembleWeights(rows, 2021)
  assert.throws(() => combineForecast(rows[0], fit), /Future weights/)
  const next = { ...rows[0], season: 2021 }
  assert.equal(
    combineForecast(next, fit).predictedMargin,
    combineForecast({ ...next, actualMargin: 900 }, fit).predictedMargin,
  )
})

test('component joins reject missing, duplicate, future and differently timed evidence', () => {
  assert.equal(alignComponents([rows, [...rows].reverse()]).length, rows.length)
  assert.throws(() => alignComponents([rows, rows.slice(1)]), /Incomplete/)
  assert.throws(
    () => alignComponents([rows, [...rows.slice(1), rows[1]]]),
    /Duplicate/,
  )
  assert.throws(
    () =>
      alignComponents([
        rows,
        rows.map((row) => ({ ...row, featureCutoffAt: 98 })),
      ]),
    /Unmatched/,
  )
  const future = rows.map((row) => ({ ...row, featureCutoffAt: 100 }))
  assert.throws(() => alignComponents([future, future]), /pregame/)
})

test('probabilities learn from cross-fitted prior seasons and preserve neutral symmetry', () => {
  const calibrationRows = rows.map((row, i) => ({
    ...row,
    weightsTrainedThrough: 2019,
    actualMargin: i % 4 === 0 ? -row.predictedMargin : row.predictedMargin,
  }))
  const fit = fitEnsembleProbability(calibrationRows, 2021)
  assert.throws(
    () => fitEnsembleProbability(calibrationRows, 2020),
    /earlier cross-fitted/,
  )
  assert.throws(
    () =>
      fitEnsembleProbability(
        calibrationRows.map((row) => ({ ...row, weightsTrainedThrough: 2020 })),
        2021,
      ),
    /cross-fitted/,
  )
  const home = applyEnsembleProbability(
    { ...rows[0], season: 2021, predictedMargin: 10 },
    fit,
  )
  const away = applyEnsembleProbability(
    { ...rows[0], season: 2021, predictedMargin: -10 },
    fit,
  )
  assert.ok(
    Math.abs(home.homeWinProbability + away.homeWinProbability - 1) < 1e-10,
  )
  assert.ok(home.homeWinProbability > 0.5 && home.homeWinProbability < 0.99)
  assert.throws(
    () => applyEnsembleProbability(rows[0], fit),
    /Future probability/,
  )
})

test('the complete rolling evaluator cannot learn weights or probabilities from held-out outcomes', () => {
  const history = [2016, 2017, 2018, 2019, 2020].flatMap((season) =>
    rows.map((row, i) => ({
      ...row,
      season,
      actualMargin: i % 4 === 0 ? -row.actualMargin : row.actualMargin,
    })),
  )
  const original = evaluateLearnedEnsemble(history, [2018, 2019, 2020])
  const changed = evaluateLearnedEnsemble(
    history.map((row) =>
      row.season === 2020
        ? { ...row, actualMargin: 100 - row.actualMargin }
        : row,
    ),
    [2018, 2019, 2020],
  )
  assert.deepEqual(original.fits, changed.fits)
  assert.deepEqual(
    original.forecasts.map((row) => [
      row.predictedMargin,
      row.homeWinProbability,
    ]),
    changed.forecasts.map((row) => [
      row.predictedMargin,
      row.homeWinProbability,
    ]),
  )
  assert.notDeepEqual(original.finalFit, changed.finalFit)
  for (const fit of original.fits) {
    assert.ok(
      fit.weights.trainingSeasons.every((season) => season < fit.season),
    )
    assert.ok(
      fit.calibration.trainingSeasons.every((season) => season < fit.season),
    )
  }
})
