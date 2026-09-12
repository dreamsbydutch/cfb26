import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPowerRatingEdition,
  buildResumeRatingEdition,
} from '../convex/ratingSystem.ts'
import {
  fitHistoricalPower,
  POWER_POLICIES,
  evaluatePowerPolicies,
} from '../convex/powerResearch.ts'

const season = 2026,
  cutoffAt = Date.UTC(2026, 11, 1)

const teams = ['a', 'b', 'c', 'd'].map((id) => ({
  id,
  name: id,
  classification: 'fbs',
}))
const game = (id, homeTeamId, awayTeamId, margin, extra = {}) => ({
  id,
  homeTeamId,
  awayTeamId,
  homePoints: 30 + margin,
  awayPoints: 30,
  neutralSite: true,
  overtimePeriods: 0,
  season,
  week: 6,
  kickoffAt: cutoffAt - 86400000,
  completed: true,
  ...extra,
})
const power = (prior = 0) =>
  buildPowerRatingEdition({
    season,
    cutoffAt,
    week: 7,
    games: [],
    teams: teams.map((team) => ({
      ...team,
      prior: {
        power: team.id === 'a' ? prior : -prior,
        effectiveGames: 8,
        sources: ['history'],
      },
    })),
  })
const resume = (games, edition = power()) =>
  buildResumeRatingEdition({ games, powerEdition: edition, week: 7 })
test('résumé is invariant to program history, current Power, and calendar recency', () => {
  const games = [game('1', 'a', 'b', 7), game('2', 'c', 'd', 21)]
  const values = (edition) =>
    edition.ratings.map((row) => [row.teamId, row.resume, row.expectedWins])
  assert.deepEqual(
    values(resume(games, power(30))),
    values(resume(games, power(-30))),
  )
  assert.deepEqual(
    values(resume(games)),
    values(
      resume(
        games.map((row) => ({
          ...row,
          kickoffAt: row.kickoffAt - 60 * 86400000,
          evidenceWeight: 0.1,
        })),
      ),
    ),
  )
})
test('every loss is negative and every win positive; dominance distinguishes wins', () => {
  for (const margin of [1, 7, 21, 60]) {
    const rows = resume([game('1', 'a', 'b', margin)]).ratings
    assert.ok(rows.find((row) => row.teamId === 'a').resume > 0)
    assert.ok(rows.find((row) => row.teamId === 'b').resume < 0)
  }
  const rows = resume([game('1', 'a', 'b', 21), game('2', 'c', 'd', 1)]).ratings
  assert.ok(
    rows.find((row) => row.teamId === 'a').resume >
      rows.find((row) => row.teamId === 'c').resume,
  )
})
test('future games cannot leak into résumé and all 138 FBS teams remain ranked', () => {
  assert.deepEqual(
    resume([]),
    resume([game('future', 'a', 'b', 14, { kickoffAt: cutoffAt + 1 })]),
  )
  const field = Array.from({ length: 138 }, (_, index) => ({
    id: String(index),
    name: String(index),
    classification: index === 137 ? 'transitioning' : 'fbs',
  }))
  const edition = buildPowerRatingEdition({
    season,
    cutoffAt,
    week: 0,
    games: [],
    teams: [...field, { id: 'fcs', name: 'FCS', classification: 'fcs' }],
  })
  assert.deepEqual(
    edition.ratings.filter((row) => row.published).map((row) => row.rank),
    Array.from({ length: 138 }, (_, i) => i + 1),
  )
  assert.equal(
    buildResumeRatingEdition({ games: [], powerEdition: edition, week: 6 })
      .visible,
    false,
  )
})
test('Power candidates carry prior seasons and ignore personnel learned after cutoff', () => {
  const games = [
    game('old', 'a', 'b', 21, {
      season: 2025,
      kickoffAt: Date.UTC(2025, 10, 1),
    }),
  ]
  const input = {
    teams,
    games,
    season,
    cutoffAt,
    week: 1,
    policy: POWER_POLICIES[1],
  }
  const baseline = fitHistoricalPower(input)
  assert.ok(baseline.ratings.find((row) => row.teamId === 'a').power > 0)
  assert.deepEqual(
    fitHistoricalPower({
      ...input,
      personnel: [
        {
          teamId: 'a',
          season,
          observedAt: cutoffAt + 1,
          effectiveAt: cutoffAt - 1,
          expiresAt: cutoffAt + 10,
          returningShare: 0,
          coachChanged: true,
          source: 'test',
        },
      ],
    }),
    baseline,
  )
})

test('postseason forecasts use completed regular-season evidence despite provider week resets', () => {
  const early = game('regular', 'a', 'b', 21, {
    kickoffAt: Date.UTC(2026, 8, 1),
    week: 1,
    seasonType: 'regular',
  })
  const bowl = game('bowl', 'a', 'b', 14, {
    kickoffAt: Date.UTC(2026, 11, 20),
    week: 1,
    seasonType: 'postseason',
  })
  const report = evaluatePowerPolicies({
    teams,
    games: [early, bowl],
    testSeasons: [season],
  })
  const forecast = report.reports[0].forecasts.find(
    (row) => row.gameId === 'bowl',
  )
  assert.ok(forecast.featureCutoffAt > early.kickoffAt)
  assert.ok(forecast.predictedMargin > 0)
  assert.ok(forecast.week >= 7)
  assert.equal(forecast.seasonType, 'postseason')
})
