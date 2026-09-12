import assert from 'node:assert/strict'
import test from 'node:test'
import { cancellationEvidence, isResolvedGame } from '../convex/gameStatus.ts'
import {
  acquisitionPercentiles,
  developmentWithConversion,
  programSeasonWeight,
} from '../convex/programRating.ts'
import {
  aggregateCompetitiveDrives,
  competitiveMargin,
  recordDifficulty,
} from '../convex/gameEvidence.ts'
import {
  fitPowerCalibration,
  calibratePowerEdition,
} from '../convex/powerCalibration.ts'
import {
  buildPowerRatingEdition,
  buildResumeRatingEdition,
  projectPowerMatchup,
} from '../convex/ratingSystem.ts'
import { withOffensiveContinuity } from '../convex/powerHistory.ts'

test('cancellations require affirmative evidence, not missing scores', () => {
  const pending = { sourceGameId: 123, season: 2024, completed: false }
  assert.equal(isResolvedGame(pending), false)
  assert.equal(isResolvedGame({ ...pending, completed: true }), false)
  assert.equal(isResolvedGame({ ...pending, sourceGameId: 401640992 }), true)
  assert.equal(
    cancellationEvidence({ ...pending, sourceGameId: 401640992, season: 2025 }),
    undefined,
  )
  assert.equal(
    isResolvedGame({
      ...pending,
      completed: true,
      homePoints: 0,
      awayPoints: 3,
    }),
    true,
  )
})
test('recruiting fallback remains comparable despite different units and missing talent', () => {
  const profiles = Array.from({ length: 10 }, (_, i) => ({
    teamId: String(i),
    talent: i === 4 ? null : i * 100,
    recruitingPoints: i * 10,
  }))
  const field = new Set(profiles.map((r) => r.teamId)),
    ratings = acquisitionPercentiles(profiles, field)
  assert.ok(
    ratings.get('4') > ratings.get('3') && ratings.get('4') < ratings.get('5'),
  )
  assert.deepEqual(
    ratings,
    acquisitionPercentiles(
      profiles.map((r) => ({
        ...r,
        recruitingPoints: r.recruitingPoints * 10000,
      })),
      field,
    ),
  )
  assert.equal(acquisitionPercentiles(profiles.slice(0, 2), field).size, 0)
})
test('Program aging is smooth and development retains absolute NFL output', () => {
  for (let age = 1; age < 10; age++)
    assert.ok(
      Math.abs(programSeasonWeight(age) / programSeasonWeight(age - 1) - 0.74) <
        1e-9,
    )
  assert.equal(developmentWithConversion(50), 50)
  assert.ok(
    developmentWithConversion(60, 30) > developmentWithConversion(60, 90),
  )
  assert.ok(
    developmentWithConversion(90, 95) > developmentWithConversion(20, 5),
  )
  assert.ok(Math.abs(developmentWithConversion(60, 0) - 60) <= 5)
})
test('competitive drives exclude already decided play and normalize possessions', () => {
  const make = (id, isHomeOffense, extras = {}) => ({
    id,
    gameId: 1,
    isHomeOffense,
    startPeriod: 1,
    endPeriod: 1,
    startOffenseScore: 0,
    startDefenseScore: 0,
    endOffenseScore: 7,
    endDefenseScore: 0,
    plays: 5,
    driveResult: 'TD',
    ...extras,
  })
  const drives = Array.from({ length: 12 }, (_, i) => make(String(i), i < 6))
  const baseline = aggregateCompetitiveDrives(drives).get(1)
  assert.deepEqual(
    aggregateCompetitiveDrives([
      ...drives,
      make('garbage', true, {
        startPeriod: 4,
        endPeriod: 4,
        startOffenseScore: 35,
        endOffenseScore: 42,
      }),
    ]).get(1),
    baseline,
  )
  assert.equal(
    competitiveMargin({
      ...baseline,
      observedAt: 1,
      version: 'competitive-v1',
    }),
    0,
  )
  assert.throws(() => aggregateCompetitiveDrives([drives[0], drives[0]]))
})
test('record difficulty distinguishes equal expected-win schedules and respects results', () => {
  assert.ok(
    recordDifficulty([0.9, 0.1], 2).difficulty >
      recordDifficulty([0.5, 0.5], 2).difficulty,
  )
  const before = recordDifficulty([0.8, 0.6], 1).difficulty
  assert.ok(recordDifficulty([0.8, 0.6, 0.7], 2).difficulty > before)
  assert.ok(recordDifficulty([0.8, 0.6, 0.7], 1).difficulty < before)
  assert.equal(recordDifficulty([], 0).difficulty, 0)
})
const cutoffAt = Date.UTC(2026, 9, 1)
const teams = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  classification: 'fbs',
  prior: {
    power: id === 'a' ? -15 : 0,
    effectiveGames: 4,
    sources: ['history'],
  },
}))
const game = {
  id: '1',
  homeTeamId: 'a',
  awayTeamId: 'b',
  homePoints: 37,
  awayPoints: 21,
  completed: true,
  neutralSite: true,
  overtimePeriods: 0,
  season: 2026,
  week: 1,
  kickoffAt: cutoffAt - 86400000,
}
const evidence = {
  version: 'competitive-v1',
  observedAt: cutoffAt - 1000,
  home: { ppa: 0.4, successRate: 0.6, plays: 65, drives: 10 },
  away: { ppa: 0, successRate: 0.4, plays: 65, drives: 10 },
  homeDrives: { possessions: 8, points: 14, conceded: 0, plays: 40 },
  awayDrives: { possessions: 8, points: 28, conceded: 0, plays: 40 },
}
test('efficiency is cutoff-safe and fixed home advantage does not absorb an upset', () => {
  const fit = (games) =>
    buildPowerRatingEdition({
      teams,
      games,
      season: 2026,
      week: 2,
      cutoffAt,
      efficiencyWeight: 0.2,
      fixedHomeField: 2.5,
      fullWeightResults: true,
    })
  const plain = fit([game])
  assert.deepEqual(
    plain,
    fit([
      { ...game, ratingEvidence: { ...evidence, observedAt: cutoffAt + 1 } },
    ]),
  )
  const current = fit([{ ...game, ratingEvidence: evidence }])
  assert.notDeepEqual(plain.ratings, current.ratings)
  assert.ok(current.ratings.every((r) => r.homeFieldAdvantage === 2.5))
  assert.equal(
    projectPowerMatchup(current, 'a', 'b', 'neutral').projectedMargin,
    -projectPowerMatchup(current, 'b', 'a', 'neutral').projectedMargin,
  )
})
test('Resume rewards actual wins even when competitive-drive performance was worse', () => {
  const powerEdition = buildPowerRatingEdition({
    teams,
    games: [game],
    season: 2026,
    week: 7,
    cutoffAt,
  })
  const fit = (e) =>
    buildResumeRatingEdition({
      powerEdition,
      games: [{ ...game, ratingEvidence: e }],
      week: 7,
    })
  const result = fit(evidence),
    plain = fit(undefined)
  assert.ok(result.ratings.find((r) => r.teamId === 'a').resume > 0)
  assert.ok(result.ratings.find((r) => r.teamId === 'b').resume < 0)
  assert.ok(
    result.ratings.find((r) => r.teamId === 'a').dominanceComponent <
      plain.ratings.find((r) => r.teamId === 'a').dominanceComponent,
  )
  assert.deepEqual(fit({ ...evidence, observedAt: cutoffAt + 1 }), plain)
})
test('offensive continuity leaves defensive prior confidence unchanged', () => {
  const prior = { power: 10, effectiveGames: 4, sources: ['history'] }
  assert.equal(withOffensiveContinuity(prior), prior)
  const changed = withOffensiveContinuity(prior, 0)
  assert.equal(changed.defenseEffectiveGames, 4)
  assert.equal(changed.offenseEffectiveGames, 2)
  assert.equal(changed.power, 10)
  assert.throws(() => withOffensiveContinuity(prior, -1))
})
test('margin and probability calibration cannot use the evaluation season', () => {
  const rows = Array.from({ length: 120 }, (_, i) => ({
    season: 2024,
    predictedMargin: (i % 21) - 10,
    actualMargin: ((i % 21) - 10) * 1.2 + (i % 2 ? 3 : -3),
    neutralSite: i % 3 === 0,
  }))
  const fit = fitPowerCalibration(rows, 2025)
  assert.throws(() => fitPowerCalibration(rows, 2024))
  const edition = buildPowerRatingEdition({
    teams,
    games: [],
    season: 2026,
    week: 1,
    cutoffAt,
  })
  assert.equal(calibratePowerEdition(edition, fit).calibration.intercept, 0)
  assert.throws(() => calibratePowerEdition({ ...edition, season: 2024 }, fit))
})
