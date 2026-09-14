import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProgramRatings } from '../convex/programRating.ts'
import { sustainedProgramResults } from '../convex/programSustained.ts'

const row = (season, performance = 95, games = 12) => ({
  teamId: 'team',
  season,
  performance,
  games,
})
const honor = (season, playoffStage = 1) => ({
  teamId: 'team',
  season,
  conferenceChampion: false,
  playoffStage,
})
const lift = (rows, honors = [], season = 2026, baseline = 60) =>
  sustainedProgramResults(rows, honors, season, baseline)

test('sustained results require consecutive well-observed elite seasons', () => {
  for (const rows of [
    [row(2025)],
    [row(2023), row(2025)],
    [row(2024, 70), row(2025)],
    [row(2024, 95, 3), row(2025)],
    [row(2025), row(2026)],
  ])
    assert.equal(lift(rows).ratingLift, 0)
  assert.ok(lift([row(2024), row(2025)]).ratingLift > 0)
  assert.equal(
    lift([row(2024, 70), row(2025, 70)], [honor(2024, 5), honor(2025, 5)])
      .ratingLift,
    0,
  )
})

test('strongest pair counts once and results never exceed their existing allocation', () => {
  const pair = [row(2024), row(2025)]
  assert.equal(lift(pair).ratingLift, 8)
  assert.equal(lift([row(2023), ...pair]).ratingLift, 8)
  assert.ok(lift(pair, [], 2026, 94).results <= 100)
  assert.equal(lift(pair, [], 2026, 96).ratingLift, 0)
})

test('earned confirmation is not a second trophy award', () => {
  const pair = [row(2024, 80), row(2025, 95)]
  const confirmed = lift(pair, [honor(2024), honor(2025)])
  assert.ok(confirmed.ratingLift > lift(pair).ratingLift)
  assert.deepEqual(lift(pair, [honor(2024, 5), honor(2025, 5)]), confirmed)
  assert.deepEqual(
    lift(pair, [honor(2024), honor(2024), honor(2025)]),
    confirmed,
  )
})

test('established success fades gradually and a better season cannot reduce confirmation', () => {
  const pair = [row(2024, 82), row(2025, 90)]
  const now = lift(pair).ratingLift
  assert.ok(lift([row(2024, 85), row(2025, 95)]).ratingLift >= now)
  assert.ok(Math.abs(lift(pair, [], 2027).ratingLift - now * 0.74) < 1e-10)
  assert.ok(Math.abs(lift(pair, [], 2028).ratingLift - now * 0.74 ** 2) < 1e-10)
})

test('Program remains one bounded ranking and v4 forecast features can be reproduced', () => {
  const input = {
    season: 2026,
    teams: [{ teamId: 'team', published: true }],
    evidence: [
      row(2021, 30),
      row(2022, 30),
      row(2023, 30),
      row(2024, 90),
      row(2025, 95),
    ],
  }
  const old = buildProgramRatings({ ...input, sustainedSuccess: false })[0]
  const current = buildProgramRatings(input)[0]
  assert.ok(current.programRating > old.programRating)
  assert.ok(
    current.programSustainedResults > 0 && current.programSustainedResults <= 8,
  )
  assert.equal(current.programAccomplishments, old.programAccomplishments)
  assert.equal(current.programAcquisition, old.programAcquisition)
  assert.equal(current.programDevelopment, old.programDevelopment)
  assert.equal(
    current.programRating,
    Math.round((old.programRating + current.programSustainedResults) * 100) /
      100,
  )
  assert.equal(current.programRank, 1)
})

test('future and early current-season evidence cannot establish a sustained baseline', () => {
  const input = {
    season: 2026,
    teams: [{ teamId: 'team', published: true }],
    evidence: [row(2025)],
  }
  assert.equal(buildProgramRatings(input)[0].programSustainedResults, 0)
  assert.equal(
    buildProgramRatings({
      ...input,
      evidence: [...input.evidence, row(2026, 100, 2), row(2027)],
    })[0].programSustainedResults,
    0,
  )
})
