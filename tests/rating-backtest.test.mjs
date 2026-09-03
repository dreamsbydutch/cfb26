import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRollingFolds,
  calibrateMargin,
  chooseChampion,
  evaluateForecasts,
  fitLogisticMarginCalibrator,
} from '../convex/ratingBacktest.ts'
import { buildMatchupProjection } from '../convex/ratingModel.ts'

function example(season, week, overrides = {}) {
  const kickoffAt = Date.UTC(season, 8, week)
  return {
    actualMargin: week % 2 === 0 ? -3 : 7,
    awayClassification: 'fbs',
    featureCutoffAt: kickoffAt - 1,
    gameId: `${season}-${week}`,
    homeClassification: 'fbs',
    homeWinProbability: week % 2 === 0 ? 0.4 : 0.7,
    kickoffAt,
    neutralSite: false,
    predictedMargin: week % 2 === 0 ? -1 : 6,
    season,
    seasonType: 'regular',
    week,
    ...overrides,
  }
}

test('rolling folds train only on seasons before the held-out season', () => {
  const folds = buildRollingFolds([
    example(2022, 1),
    example(2023, 1),
    example(2024, 1),
  ])

  assert.deepEqual(
    folds.map((fold) => ({
      evaluation: fold.evaluation.map((row) => row.season),
      testSeason: fold.testSeason,
      training: fold.training.map((row) => row.season),
    })),
    [
      { evaluation: [2023], testSeason: 2023, training: [2022] },
      {
        evaluation: [2024],
        testSeason: 2024,
        training: [2022, 2023],
      },
    ],
  )
})

test('rolling folds reject features created at or after kickoff', () => {
  assert.throws(
    () =>
      buildRollingFolds([
        example(2022, 1),
        example(2023, 1, {
          featureCutoffAt: Date.UTC(2023, 8, 1),
        }),
      ]),
    /before kickoff/,
  )
})

test('forecast evaluation calculates margin, probability, and calibration metrics', () => {
  const result = evaluateForecasts([
    example(2024, 1, {
      actualMargin: 10,
      homeWinProbability: 0.8,
      predictedMargin: 7,
    }),
    example(2024, 2, {
      actualMargin: -7,
      homeWinProbability: 0.25,
      neutralSite: true,
      predictedMargin: -5,
    }),
  ])

  assert.equal(result.overall.count, 2)
  assert.equal(result.overall.marginMae, 2.5)
  assert.equal(result.overall.brier, 0.05125)
  assert.equal(result.overall.winnerAccuracy, 1)
  assert.equal(result.overall.expectedCalibrationError, 0.225)
  assert.equal(result.bySeason['2024'].count, 2)
  assert.equal(result.byVenue.home.count, 1)
  assert.equal(result.byVenue.neutral.count, 1)
  assert.equal(result.bySubdivision.fbs_vs_fbs.count, 2)
})

test('logistic calibration learns a monotonic margin probability curve', () => {
  const training = [
    [-14, 0],
    [-10, 0],
    [-7, 0],
    [-3, 0],
    [3, 1],
    [7, 1],
    [10, 1],
    [14, 1],
  ].map(([predictedMargin, homeWon], index) => ({
    homeWon,
    predictedMargin,
    season: 2020 + Math.floor(index / 4),
  }))
  const calibration = fitLogisticMarginCalibrator(training)

  assert.ok(calibration.slope > 0)
  assert.ok(calibrateMargin(-7, calibration) < 0.5)
  assert.ok(calibrateMargin(0, calibration) > 0.45)
  assert.ok(calibrateMargin(0, calibration) < 0.55)
  assert.ok(calibrateMargin(7, calibration) > 0.5)
})

test('champion selection requires joint improvement without seasonal regression', () => {
  const incumbent = {
    folds: [
      {
        brier: 0.2,
        expectedCalibrationError: 0.08,
        marginMae: 10,
        season: 2022,
      },
      {
        brier: 0.2,
        expectedCalibrationError: 0.08,
        marginMae: 10,
        season: 2023,
      },
      {
        brier: 0.2,
        expectedCalibrationError: 0.08,
        marginMae: 10,
        season: 2024,
      },
    ],
    modelVersion: 'incumbent',
  }
  const balanced = {
    folds: [
      {
        brier: 0.19,
        expectedCalibrationError: 0.07,
        marginMae: 9.5,
        season: 2022,
      },
      {
        brier: 0.19,
        expectedCalibrationError: 0.07,
        marginMae: 9.5,
        season: 2023,
      },
      {
        brier: 0.19,
        expectedCalibrationError: 0.07,
        marginMae: 9.5,
        season: 2024,
      },
    ],
    modelVersion: 'balanced',
  }
  const probabilityOnly = {
    folds: incumbent.folds.map((fold) => ({
      ...fold,
      brier: 0.18,
      marginMae: 10.2,
    })),
    modelVersion: 'probability-only',
  }
  const unstable = {
    folds: [
      {
        brier: 0.16,
        expectedCalibrationError: 0.06,
        marginMae: 8,
        season: 2022,
      },
      {
        brier: 0.16,
        expectedCalibrationError: 0.06,
        marginMae: 8,
        season: 2023,
      },
      {
        brier: 0.24,
        expectedCalibrationError: 0.12,
        marginMae: 12,
        season: 2024,
      },
    ],
    modelVersion: 'unstable',
  }

  const selection = chooseChampion(
    incumbent,
    [probabilityOnly, unstable, balanced],
    { minimumHeldOutSeasons: 3 },
  )

  assert.equal(selection.champion.modelVersion, 'balanced')
  assert.equal(selection.decisions['probability-only'].accepted, false)
  assert.equal(selection.decisions.unstable.accepted, false)
  assert.deepEqual(selection.decisions.balanced.reasons, [])
})

test('champion selection requires eight held-out seasons by default', () => {
  const incumbent = {
    folds: [
      {
        brier: 0.2,
        expectedCalibrationError: 0.08,
        marginMae: 10,
        season: 2024,
      },
    ],
    modelVersion: 'incumbent',
  }
  const challenger = {
    folds: [
      {
        brier: 0.18,
        expectedCalibrationError: 0.06,
        marginMae: 9,
        season: 2024,
      },
    ],
    modelVersion: 'challenger',
  }

  const selection = chooseChampion(incumbent, [challenger])

  assert.equal(selection.champion.modelVersion, 'incumbent')
  assert.match(
    selection.decisions.challenger.reasons[0],
    /eight held-out seasons/,
  )
})

test('current matchup projection identifies and accepts a versioned calibration', () => {
  const dimensions = {
    continuity: 50,
    defense: 50,
    form: 50,
    offense: 50,
    passingDefense: 50,
    passingOffense: 50,
    power: 50,
    resume: 50,
    rushingDefense: 50,
    rushingOffense: 50,
    situationalDefense: 50,
    situationalOffense: 50,
    specialTeams: 50,
    talent: 50,
    tempo: 50,
    volatility: 50,
  }
  const teamA = {
    confidence: 100,
    dimensions,
    overall: 60,
    sourceProgramName: 'Team A',
  }
  const teamB = {
    confidence: 100,
    dimensions,
    overall: 50,
    sourceProgramName: 'Team B',
  }
  const baseline = buildMatchupProjection(teamA, teamB, 'neutral')
  const calibrated = buildMatchupProjection(teamA, teamB, 'neutral', {
    fitCount: 1_000,
    intercept: 0,
    maximumProbability: 0.99,
    minimumProbability: 0.01,
    slope: 0.3,
    trainingSeasons: [2016, 2017, 2018],
    version: 'logistic-margin-v1',
  })

  assert.equal(baseline.probabilityCalibrationVersion, 'fixed-logistic-v1')
  assert.equal(calibrated.probabilityCalibrationVersion, 'logistic-margin-v1')
  assert.ok(calibrated.teamAWinProbability > baseline.teamAWinProbability)
})
