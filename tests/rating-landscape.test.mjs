import assert from 'node:assert/strict'
import test from 'node:test'
import { scoreWeeklyMatchup } from '../convex/ratingSystem.ts'

const score = (
  homePower,
  homePowerRank,
  awayPower,
  awayPowerRank,
  extras = {},
) =>
  scoreWeeklyMatchup({
    homePower,
    homePowerRank,
    awayPower,
    awayPowerRank,
    homeFieldAdvantage: 2.5,
    conferenceGame: true,
    neutralSite: false,
    ...extras,
  }).landscapeRating

test('Landscape puts Georgia–Oklahoma above the closer mid-table screenshot matchups', () => {
  const georgiaOklahoma = score(20.8, 5, 12.9, 18)
  assert.ok(georgiaOklahoma > score(1.7, 57, 6.2, 39), 'TCU–UCF')
  assert.ok(
    georgiaOklahoma > score(2.7, 54, 5.8, 42, { conferenceGame: false }),
    'Boise–Western Michigan',
  )
})

test('Landscape does not promote an unknown opponent using a fabricated average rating', () => {
  // Synthetic regression for the reported Ohio State–Illinois / Bucknell–Pitt pattern.
  const ohioStateIllinois = score(22, 3, 8, 32)
  const bucknellPitt = score(0, 65, null, undefined, {
    conferenceGame: false,
  })
  assert.ok(ohioStateIllinois > bucknellPitt)
  assert.ok(bucknellPitt < 30)
})

test('Indiana–Northwestern outranks Howard–Rutgers with missing Howard evidence', () => {
  assert.ok(
    score(21.4, 4, 7.8, 33) >
      score(-4.7, 88, null, undefined, { conferenceGame: false }),
  )
})

test('a measured zero Power is valid but missing Power cannot produce a margin', () => {
  const input = {
    homePower: 0,
    awayPower: 0,
    homeFieldAdvantage: 0,
    conferenceGame: false,
    neutralSite: true,
  }
  const known = scoreWeeklyMatchup(input)
  const missing = scoreWeeklyMatchup({ ...input, awayPower: null })
  assert.equal(known.projectedMargin, 0)
  assert.equal(known.competitiveness, 100)
  assert.equal(missing.projectedMargin, null)
  assert.equal(missing.competitiveness, 0)
  assert.ok(known.landscapeRating > missing.landscapeRating)
  assert.equal(
    scoreWeeklyMatchup({ ...input, homePower: null, awayPower: null })
      .landscapeRating,
    0,
  )
})

test('Landscape rewards stakes and competitiveness without depending on team names', () => {
  assert.ok(score(18, 5, 16, 10) > score(18, 45, 16, 50))
  assert.ok(score(18, 5, 16, 10, { neutralSite: true }) > score(18, 5, 16, 10))
  assert.equal(
    score(18, 5, 16, 10, { neutralSite: true }),
    score(16, 10, 18, 5, { neutralSite: true }),
  )
})
