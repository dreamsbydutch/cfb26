import test from 'node:test'
import assert from 'node:assert/strict'
import {
  fitProgramForecast,
  programForecast,
  resumeProgramBonus,
  resumeProgramPrior,
} from '../convex/programContext.ts'
import {
  buildPowerRatingEdition,
  buildResumeRatingEdition,
} from '../convex/ratingSystem.ts'

const context = (rating = 90) => ({
  programRating: rating,
  programSeasons: 9,
  historyThroughSeason: 2025,
})
const fit = {
  intercept: -25,
  slope: 0.5,
  count: 300,
  trainingSeasons: [2024, 2025],
}
const season = 2026,
  kickoffAt = Date.UTC(2026, 8, 1),
  cutoffAt = Date.UTC(2026, 9, 1)
const teams = ['a', 'b', 'c'].map((id) => ({
  id,
  name: id,
  classification: 'fbs',
}))
const game = (
  id,
  homeTeamId,
  awayTeamId,
  homePoints = 24,
  awayPoints = 21,
) => ({
  id,
  homeTeamId,
  awayTeamId,
  homePoints,
  awayPoints,
  completed: true,
  season,
  week: 1,
  kickoffAt,
  neutralSite: true,
  overtimePeriods: 0,
})
const games = [game('ab', 'a', 'b'), game('bc', 'b', 'c', 28, 14)]
const powerEdition = buildPowerRatingEdition({
  teams,
  games,
  season,
  week: 7,
  cutoffAt,
})

test('Program mapping learns point units only from earlier-season targets', () => {
  const rows = Array.from({ length: 200 }, (_, i) => ({
    season: 2025,
    programRating: i % 100,
    target: (i % 100) * 0.4 - 20,
  }))
  const trained = fitProgramForecast(rows, 2026)
  assert.ok(Math.abs(trained.slope - 0.4) < 1e-10)
  assert.ok(Math.abs(trained.intercept + 20) < 1e-10)
  assert.throws(() => fitProgramForecast(rows, 2025), /earlier-season/)
  assert.throws(
    () => programForecast(context(), { ...fit, trainingSeasons: [2026] }, 2026),
    /Future/,
  )
  assert.throws(
    () =>
      programForecast({ ...context(), historyThroughSeason: 2026 }, fit, 2026),
    /prior seasons/,
  )
})

test('own-history bonus is bounded and requires earned wins and meaningful prior evidence', () => {
  assert.equal(resumeProgramBonus(context(100), 2026, 1), 0.15)
  assert.equal(resumeProgramBonus(context(50), 2026, 8), 0)
  assert.equal(resumeProgramBonus(context(100), 2026, 0), 0)
  assert.equal(
    resumeProgramBonus({ ...context(100), programSeasons: 0 }, 2026, 3),
    0,
  )
  assert.equal(resumeProgramBonus(undefined, 2026, 3), 0)
  assert.equal(
    resumeProgramBonus(context(80), 2026, 2),
    resumeProgramBonus(context(80), 2026, 10),
  )
})

test('own-history bonus changes only the declared score allocation and leaves the Week 7 gate intact', () => {
  const base = buildResumeRatingEdition({ games, powerEdition, week: 6 })
  const changed = buildResumeRatingEdition({
    games,
    powerEdition,
    week: 6,
    programContext: new Map([['a', context(100)]]),
  })
  const before = base.ratings.find((r) => r.teamId === 'a'),
    after = changed.ratings.find((r) => r.teamId === 'a')
  assert.ok(Math.abs(after.resume - before.resume - 0.15) <= 0.001)
  assert.equal(after.scheduleComponent, before.scheduleComponent)
  assert.equal(after.dominanceComponent, before.dominanceComponent)
  assert.equal(after.resumeProgramBonus, 0.15)
  assert.equal(changed.visible, false)
  assert.equal(
    buildResumeRatingEdition({ games, powerEdition, week: 7 }).visible,
    true,
  )
})

test('opponent context adds bounded evidence and the evaluated team cannot alter its opponents through its own prior', () => {
  assert.equal(resumeProgramPrior(context(), fit, 2026).effectiveGames, 0.5)
  const score = (own) =>
    buildResumeRatingEdition({
      games,
      powerEdition,
      week: 7,
      programForecastFit: fit,
      programContext: new Map([
        ['a', context(own)],
        ['b', context(80)],
      ]),
    }).ratings.find((r) => r.teamId === 'a')
  assert.equal(score(50).scheduleComponent, score(100).scheduleComponent)
  assert.equal(score(50).dominanceComponent, score(100).dominanceComponent)
  const noContext = buildResumeRatingEdition({
    games,
    powerEdition,
    week: 7,
  }).ratings.find((r) => r.teamId === 'a')
  assert.ok(score(50).scheduleComponent > noContext.scheduleComponent)
  const future = new Map([['b', { ...context(), historyThroughSeason: 2026 }]])
  assert.throws(
    () =>
      buildResumeRatingEdition({
        games,
        powerEdition,
        week: 7,
        programContext: future,
        programForecastFit: fit,
      }),
    /prior seasons/,
  )
})

test('current results eventually dominate half a game of historical opponent evidence', () => {
  const estimate = (count, prior) => {
    const repeated = Array.from({ length: count }, (_, i) =>
      game(String(i), 'b', 'c', 20, 20),
    )
    return buildPowerRatingEdition({
      teams: teams.map((t) => ({
        ...t,
        prior:
          t.id === 'b' && prior
            ? resumeProgramPrior(context(100), fit, 2026)
            : undefined,
      })),
      games: repeated,
      season,
      week: 7,
      cutoffAt,
    }).ratings.find((r) => r.teamId === 'b').power
  }
  assert.ok(
    Math.abs(estimate(12, true) - estimate(12, false)) <
      Math.abs(estimate(1, true) - estimate(1, false)),
  )
})
