import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPowerRatingEdition,
  buildResumeRatingEdition,
  resumeReferenceWinProbability,
  RESUME_OPPONENT_STRENGTH_WEIGHT,
} from '../convex/ratingSystem.ts'

const oldProbability = (strength, venue = 0) =>
  Math.max(
    0.03,
    Math.min(0.97, 1 / (1 + Math.exp(-(14 - strength + venue) / 6.5))),
  )

function credit(p, margin) {
  const win = Number(margin > 0)
  const d = 1 / (1 + Math.exp(-Math.max(-21, Math.min(21, margin)) / 6.5))
  const performance = win ? (1 - p) * (2 * d - 1) : -p * (2 - 2 * d)
  return 0.7 * (win - p) + 0.3 * performance
}

test('opponent leverage modestly rewards strong wins and softens strong losses while weak losses still hurt', () => {
  assert.equal(RESUME_OPPONENT_STRENGTH_WEIGHT, 1.15)
  for (const strength of [5, 10, 15, 20]) {
    const current = resumeReferenceWinProbability(strength, 0)
    const previous = oldProbability(strength)
    assert.ok(credit(current, 7) > credit(previous, 7))
    assert.ok(credit(current, -3) > credit(previous, -3))
    assert.ok(credit(current, -3) < 0)
  }
  for (const strength of [-10, -5]) {
    const current = resumeReferenceWinProbability(strength, 0)
    assert.ok(credit(current, 21) <= credit(oldProbability(strength), 21))
    assert.ok(credit(current, -3) <= credit(oldProbability(strength), -3))
    assert.ok(credit(current, 21) > 0)
  }
  assert.ok(
    credit(resumeReferenceWinProbability(-5, 0), -3) <
      credit(resumeReferenceWinProbability(20, 0), -3),
  )
  assert.equal(resumeReferenceWinProbability(0, 0), oldProbability(0))
  assert.ok(
    resumeReferenceWinProbability(10, 2.5) >
      resumeReferenceWinProbability(10, -2.5),
  )
})

test('hard schedules can outweigh two losses, but unbeaten weak schedules keep earning merit with no ranking ceiling', () => {
  const season = 2026
  const cutoffAt = Date.UTC(2026, 10, 1)
  const strong = Array.from({ length: 8 }, (_, i) => `strong${i}`)
  const weak = Array.from({ length: 8 }, (_, i) => `weak${i}`)
  const ids = ['hard', 'unbeaten', 'upset', ...strong, ...weak]
  const games = []
  const add = (homeTeamId, awayTeamId, margin) =>
    games.push({
      id: String(games.length),
      homeTeamId,
      awayTeamId,
      homePoints: 30 + margin,
      awayPoints: 30,
      neutralSite: true,
      overtimePeriods: 0,
      season,
      week: 8,
      kickoffAt: cutoffAt - 86400000,
      completed: true,
    })
  for (const a of strong) for (const b of weak) add(a, b, 28)
  for (let i = 0; i < 8; i++) {
    add('hard', strong[i], i < 6 ? 7 : -3)
    add('unbeaten', weak[i], 21)
    add('upset', weak[i], i < 7 ? 21 : -3)
  }
  const powerEdition = buildPowerRatingEdition({
    season,
    cutoffAt,
    week: 8,
    games,
    teams: ids.map((id) => ({ id, name: id, classification: 'fbs' })),
  })
  const edition = buildResumeRatingEdition({ games, powerEdition, week: 8 })
  const team = (id) => edition.ratings.find((row) => row.teamId === id)
  assert.equal(edition.modelVersion, 'cfb26-resume-v6')
  assert.equal(team('hard').actualWins, 6)
  assert.equal(team('unbeaten').actualWins, 8)
  assert.ok(team('hard').resume > team('unbeaten').resume)
  assert.ok(team('unbeaten').resume > team('upset').resume)
  assert.ok(team('unbeaten').resume > 0)
  const withoutLastWin = buildResumeRatingEdition({
    games: games.filter(
      (g) => !(g.homeTeamId === 'unbeaten' && g.awayTeamId === weak[7]),
    ),
    powerEdition,
    week: 8,
  })
  assert.ok(
    team('unbeaten').resume >
      withoutLastWin.ratings.find((row) => row.teamId === 'unbeaten').resume,
  )
  assert.deepEqual(
    edition.ratings.map((row) => row.resumeRank),
    ids.map((_, i) => i + 1),
  )
})
