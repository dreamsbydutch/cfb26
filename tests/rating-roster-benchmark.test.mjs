import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fitRosterForecast,
  rosterContexts,
  withRosterForecast,
} from '../convex/powerRoster.ts'
import {
  marketMargins,
  compareMarketMargins,
  scoreExternalForecasts,
  chooseEarlyPowerChampion,
} from '../convex/powerBenchmarks.ts'
import { evaluateForecasts, chooseChampion } from '../convex/ratingBacktest.ts'

test('an overall improvement cannot hide worse early-season predictions', () => {
  const forecast = (season, week, prediction, probability) => ({
    gameId: `${season}-${week}`,
    season,
    week,
    seasonType: 'regular',
    kickoffAt: Date.UTC(season, 8, week),
    featureCutoffAt: Date.UTC(season, 8, week) - 1,
    actualMargin: 10,
    predictedMargin: prediction,
    homeWinProbability: probability,
    neutralSite: true,
  })
  const report = (modelVersion, forecasts) => ({
    modelVersion,
    forecasts,
    folds: Object.entries(evaluateForecasts(forecasts).bySeason).map(
      ([season, metrics]) => ({ season: Number(season), ...metrics }),
    ),
  })
  const seasons = Array.from({ length: 8 }, (_, i) => 2018 + i)
  const incumbent = report(
    'incumbent',
    seasons.flatMap((s) => [forecast(s, 1, 7, 0.7), forecast(s, 8, 1, 0.6)]),
  )
  const challenger = report(
    'challenger',
    seasons.flatMap((s) => [forecast(s, 1, 6, 0.69), forecast(s, 8, 8, 0.9)]),
  )
  const market = new Map(seasons.map((s) => [`${s}-1`, 8]))
  assert.equal(
    chooseChampion(incumbent, [challenger]).champion.modelVersion,
    'challenger',
  )
  const selected = chooseEarlyPowerChampion(incumbent, [challenger], market)
  assert.equal(selected.champion.modelVersion, 'incumbent')
  assert.ok(
    selected.decisions.challenger.reasons.includes(
      'Early-season margin MAE did not improve.',
    ),
  )
  const good = report(
    'good',
    challenger.forecasts.map((f) => ({
      ...f,
      predictedMargin: 9,
      homeWinProbability: 0.9,
    })),
  )
  assert.equal(
    chooseEarlyPowerChampion(incumbent, [good], market).champion.modelVersion,
    'good',
  )
  assert.equal(
    chooseEarlyPowerChampion(incumbent, [good], new Map()).champion
      .modelVersion,
    'incumbent',
  )
})

test('roster context normalizes source scales independently and preserves missingness', () => {
  const field = new Set(['a', 'b', 'c', 'd', 'e']),
    rows = [...field].map((teamId, i) => ({
      teamId,
      talent: i + 1,
      recruitingPoints: 10 * i,
      returningUsage: null,
    }))
  const first = rosterContexts(rows, field),
    scaled = rosterContexts(
      rows.map((r) => ({ ...r, talent: r.talent * 100 })),
      field,
    )
  assert.deepEqual(first, scaled)
  assert.equal(first.get('a').hasReturning, 0)
  assert.equal(
    rosterContexts(
      rows.map((r, i) => ({ ...r, talent: i < 2 ? null : r.talent })),
      field,
    ).get('e').hasTalent,
    0,
  )
})
test('trained roster forecast uses past labels, distinguishes talent, and bounds adjustments', () => {
  const context = (t) => ({
    talent: t,
    recruiting: t,
    returning: 0,
    hasTalent: 1,
    hasRecruiting: 1,
    hasReturning: 0,
  })
  const rows = Array.from({ length: 400 }, (_, i) => ({
    season: 2020 + (i % 3),
    prior: (i % 20) - 10,
    context: context((i % 7) - 3),
    target: 0.7 * ((i % 20) - 10) + 3 * ((i % 7) - 3),
  }))
  const fit = fitRosterForecast(rows, 2023),
    prior = { power: 0, effectiveGames: 4, sources: [] }
  const high = withRosterForecast(prior, context(2), fit, 2023),
    low = withRosterForecast(prior, context(-2), fit, 2023)
  assert.ok(high.power > low.power)
  assert.ok(Math.abs(high.power) <= 4)
  assert.equal(withRosterForecast(prior, undefined, fit, 2023), prior)
  assert.throws(() => fitRosterForecast(rows, 2022))
  assert.throws(() => withRosterForecast(prior, context(1), fit, 2022))
})
test('benchmark signs, opening coverage, duplicate providers, and matched games are explicit', () => {
  const rows = [
    {
      id: 1,
      season: 2025,
      lines: [
        { provider: 'A', spread: -7, spreadOpen: -6 },
        { provider: 'B', spread: -8, spreadOpen: -7 },
      ],
    },
    { id: 2, season: 2025, lines: [{ provider: 'A', spread: 3 }] },
  ]
  const opening = marketMargins(rows, 'opening')
  assert.equal(opening.get('1'), 6.5)
  assert.ok(!opening.has('2'))
  assert.equal(marketMargins(rows, 'archived').get('2'), -3)
  assert.throws(() =>
    marketMargins(
      [{ ...rows[0], lines: [rows[0].lines[0], rows[0].lines[0]] }],
      'opening',
    ),
  )
  const report = compareMarketMargins(
    [
      {
        gameId: '1',
        season: 2025,
        week: 1,
        actualMargin: 7,
        predictedMargin: 5,
      },
      {
        gameId: '2',
        season: 2025,
        week: 1,
        actualMargin: -3,
        predictedMargin: 1,
      },
    ],
    opening,
  )
  assert.equal(report.matched, 1)
  assert.equal(report.missing, 1)
  assert.equal(report.early.marketMae, 0.5)
  assert.throws(() =>
    scoreExternalForecasts([
      { observedAt: 20, kickoffAt: 10, featureCutoffAt: 5 },
    ]),
  )
})
