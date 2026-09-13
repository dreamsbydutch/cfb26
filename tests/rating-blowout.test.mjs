import assert from 'node:assert/strict'
import test from 'node:test'
import {
  resultMargin,
  marginInfluence,
  censoredMargin,
} from '../convex/powerMargin.ts'
import { buildPowerRatingEdition } from '../convex/ratingSystem.ts'
import { efficiencyMargin } from '../convex/gameEvidence.ts'

test('the real Power fit does not downgrade a favorite for exceeding its expectation', () => {
  const teams = [20, -20, 0, 0].map((power, i) => ({
    id: String(i),
    name: String(i),
    classification: 'fbs',
    prior: { power, effectiveGames: 50, sources: ['fixture'] },
  }))
  const fit = (games, marginTreatment = 'huber') =>
    buildPowerRatingEdition({
      teams,
      games,
      season: 2026,
      week: 2,
      cutoffAt: 100,
      marginTreatment,
      fixedHomeField: 2.5,
    })
  const games = [
    {
      id: 'win',
      homeTeamId: '0',
      awayTeamId: '1',
      homePoints: 63,
      awayPoints: 3,
      completed: true,
      kickoffAt: 1,
      season: 2026,
      week: 1,
      neutralSite: false,
      overtimePeriods: 0,
    },
  ]
  const before = fit([]),
    after = fit(games)
  const gap = (e) =>
    e.ratings.find((r) => r.teamId === '0').power -
    e.ratings.find((r) => r.teamId === '1').power
  assert.ok(gap(after) > gap(before), `${gap(before)} -> ${gap(after)}`)
  assert.ok(gap(fit(games, 'censored')) >= gap(before) - 0.000001)
})

test('censored blowouts preserve lower-bound evidence without pretending the cap is exact', () => {
  assert.equal(censoredMargin(35, 60, 43), 43)
  assert.equal(censoredMargin(35, 60, 20), 35)
  assert.equal(censoredMargin(-35, -60, -43), -43)
  assert.equal(censoredMargin(35, 35, 43), 35)
  assert.equal(censoredMargin(20, 20, 43), 20)
  assert.throws(() => censoredMargin(35, Infinity, 43))
})

test('a 60-point win exceeding a 43-point expectation remains positive evidence', () => {
  const margin = resultMargin(63, 3, 0, 'huber')
  assert.equal(margin, 60)
  assert.ok((margin - 43) * marginInfluence(margin, 43) > 0)
  assert.ok(resultMargin(63, 3, 0, 'capped') - 43 < 0)
})
test('extreme residuals have bounded influence with symmetric treatment of either team', () => {
  for (const margin of [5, 35, 60, 100, -5, -35, -60, -100]) {
    const contribution = margin * marginInfluence(margin, 0)
    assert.ok(Math.abs(contribution) <= 21)
    assert.equal(contribution, -(-margin * marginInfluence(-margin, 0)))
  }
  assert.equal(resultMargin(63, 3, 1, 'huber'), 7)
})

test('continuous efficiency preserves dominant evidence without a 30-play discontinuity', () => {
  const evidence = (plays) => ({
    home: { ppa: 1, plays },
    away: { ppa: 0, plays },
  })
  assert.equal(efficiencyMargin(evidence(26), true), 65)
  assert.equal(efficiencyMargin(evidence(30), true), 65)
  assert.equal(efficiencyMargin(evidence(26)), undefined)
  assert.equal(efficiencyMargin(evidence(30)), 35)
})
