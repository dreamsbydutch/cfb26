import test from 'node:test'
import assert from 'node:assert/strict'
import { fitResultCalibration } from '../scripts/lib/result-calibration.mjs'
import { calibrateForecast } from '../convex/powerCalibration.ts'

test('signed research calibration learns an inverse signal only when explicitly enabled', () => {
  const rows = Array.from({ length: 200 }, (_, i) => {
    const predictedMargin = (i % 21) - 10
    return {
      season: 2017,
      predictedMargin,
      actualMargin: -3 * predictedMargin + 2,
      neutralSite: false,
    }
  })
  assert.throws(() => fitResultCalibration(rows, 2018), /positive point/)
  const fit = fitResultCalibration(rows, 2018, { allowNegativeScale: true })
  assert.ok(Math.abs(fit.scale + 3) < 1e-9)
  assert.ok(Math.abs(fit.homeOffset - 2) < 1e-9)
  assert.throws(
    () => fitResultCalibration(rows, 2017, { allowNegativeScale: true }),
    /earlier finite/,
  )
})

test('result-only units learn an unrestricted point scale and venue offset from past forecasts', () => {
  const rows = Array.from({ length: 240 }, (_, i) => {
    const x = (i % 37) - 18,
      neutralSite = i % 3 === 0
    return {
      season: 2024,
      predictedMargin: x,
      actualMargin: 8 * x + (neutralSite ? 0 : -12),
      neutralSite,
    }
  })
  const fit = fitResultCalibration(rows, 2025)
  assert.ok(Math.abs(fit.scale - 8) < 1e-10)
  assert.ok(Math.abs(fit.homeOffset + 12) < 1e-10)
  assert.deepEqual(fit.trainingSeasons, [2024])
  assert.equal(fit.probability.intercept, 0)
  assert.ok(
    Math.abs(
      calibrateForecast({ ...rows[4], season: 2025 }, fit).predictedMargin -
        rows[4].actualMargin,
    ) < 1e-8,
  )
  assert.throws(() => fitResultCalibration(rows, 2024), /earlier/)
  assert.throws(() => fitResultCalibration(rows.slice(0, 10), 2025), /earlier/)
  assert.throws(
    () =>
      fitResultCalibration(
        [{ ...rows[0], actualMargin: NaN }, ...rows.slice(1)],
        2025,
      ),
    /finite/,
  )
})
