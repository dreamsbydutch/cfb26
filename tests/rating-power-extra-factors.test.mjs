import test from 'node:test'
import assert from 'node:assert/strict'
import {
  enrichExtraFactors,
  fitFactorCorrection,
  replayExtraCorrection,
} from '../scripts/lib/power-extra-factors.mjs'

test('extra evidence joins exact identities, handles return direction, and excludes ambiguous fumble touchdowns', () => {
  const data = {
    games: [
      {
        sourceGameId: 1,
        season: 2020,
        homeSourceName: 'Home',
        awaySourceName: 'Away',
        homeProgramId: 'h',
        awayProgramId: 'a',
        ratingEvidence: {
          home: { plays: 60, ppa: 0.2 },
          away: { plays: 60, ppa: 0.1 },
        },
      },
    ],
  }
  const drive = {
    gameId: 1,
    isHomeOffense: true,
    startOffenseScore: 0,
    startDefenseScore: 0,
    endOffenseScore: 0,
    endDefenseScore: 7,
  }
  const archives = [
    {
      kind: 'returning',
      rows: [
        {
          season: 2020,
          team: 'Home',
          passingUsage: 0.8,
          percentPassingPPA: 0.7,
        },
        {
          season: 2020,
          team: 'Misspelled',
          passingUsage: 1,
          percentPassingPPA: 1,
        },
      ],
    },
    {
      kind: 'advanced',
      rows: [{ gameId: 1, team: 'Home', offense: { explosiveness: 1.5 } }],
    },
    {
      kind: 'drives',
      rows: [
        { ...drive, id: 'd1', driveResult: 'INT TD' },
        { ...drive, id: 'd2', driveResult: 'FUMBLE TD' },
      ],
    },
  ]
  const result = enrichExtraFactors(data, archives)
  assert.equal(result.games[0].researchTurnoverMargin, -1)
  assert.equal(result.games[0].researchReturnMargin, -7)
  assert.equal(result.games[0].ratingEvidence.home.explosiveness, 1.5)
  assert.equal(data.games[0].ratingEvidence.home.explosiveness, undefined)
  assert.equal(result.returning.get('2020:h').passingUsage, 0.8)
  assert.equal(result.coverage.unmatchedReturning, 1)
  assert.throws(
    () => enrichExtraFactors(data, [...archives, archives[2]]),
    /Duplicate drive/,
  )
})

test('factor coefficients recover learned corrections and reject future-season training', () => {
  const rows = Array.from({ length: 200 }, (_, i) => {
    const x = (i % 7) - 3,
      y = (i % 11) - 5
    return {
      season: 2018,
      predictedMargin: 4,
      actualMargin: 4 + 3 * x - 2 * y,
      features: [x, y],
    }
  })
  const fit = fitFactorCorrection(rows, 2019, 2)
  assert.ok(Math.abs(fit.coefficients[0] - 3) < 1e-9)
  assert.ok(Math.abs(fit.coefficients[1] + 2) < 1e-9)
  assert.throws(() => fitFactorCorrection(rows, 2018, 2), /earlier-season/)
  assert.deepEqual(fitFactorCorrection([], 2019, 2).coefficients, [0, 0])
})

test('volatility and continuity features use only eligible history and separate missingness', () => {
  const games = [
    {
      id: 'old',
      completed: true,
      season: 2020,
      kickoffAt: 1,
      homeTeamId: 'h',
      awayTeamId: 'a',
      researchTurnoverMargin: 3,
      researchReturnMargin: 7,
    },
  ]
  const base = {
    gameId: 'next',
    season: 2020,
    kickoffAt: 1e9,
    featureCutoffAt: 1e9 - 1,
    predictedMargin: 0,
    actualMargin: 10,
    homeTeamId: 'h',
    awayTeamId: 'b',
  }
  const run = (schedule, request = base) =>
    replayExtraCorrection(schedule, [request], new Map(), {
      name: 'combined-volatility',
    }).forecasts[0]
  assert.deepEqual(run(games).features, [3, 7])
  assert.deepEqual(
    run([
      ...games,
      {
        ...games[0],
        id: 'future',
        kickoffAt: 2e9,
        researchTurnoverMargin: 100,
      },
    ]).features,
    [3, 7],
  )
  assert.deepEqual(
    run(games, { ...base, featureCutoffAt: 6 * 3_600_000 + 1 }).features,
    [0, 0],
  )
  const known = new Map([
    ['2020:h', { passingUsage: 0.8, passingPpa: 1 }],
    ['2020:b', { passingUsage: 0.2, passingPpa: 0.5 }],
  ])
  const qb = replayExtraCorrection([], [base], known, {
    name: 'quarterback-continuity',
  }).forecasts[0]
  assert.ok(Math.abs(qb.features[0] - 0.6) < 1e-9)
  assert.deepEqual(
    replayExtraCorrection([], [base], new Map(), {
      name: 'quarterback-continuity',
    }).forecasts[0].features,
    [0, 0],
  )
})
