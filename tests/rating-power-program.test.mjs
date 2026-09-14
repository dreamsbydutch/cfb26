import test from 'node:test'
import assert from 'node:assert/strict'
import { withProgramPower } from '../convex/powerProgram.ts'
import { POWER_PROGRAM_RELEASE } from '../convex/powerProgramRelease.ts'
import { projectPowerMatchup } from '../convex/ratingSystem.ts'

const context = {
  programRating: 80,
  programSeasons: 9,
  historyThroughSeason: 2025,
}
const mapping = {
  intercept: -25,
  slope: 0.5,
  count: 200,
  trainingSeasons: [2025],
}
const team = (id, power, published = true) => ({
  teamId: id,
  name: id,
  classification: published ? 'fbs' : 'fcs',
  published,
  power,
  offense: power / 2,
  defense: power / 2,
  specialTeams: 0,
  homeFieldAdvantage: 2.6,
  gamesPlayed: 2,
  dataSources: [],
  limitedSample: false,
  priorWeight: 0.5,
  specialTeamsAvailable: false,
})
const base = {
  season: 2026,
  week: 3,
  cutoffAt: 1,
  modelVersion: 'cfb26-power-v5',
  leagueAveragePoints: 25,
  ratings: [team('a', 10), team('b', -10), team('fcs', -20, false)],
}
const contexts = new Map([
  ['a', context],
  ['b', { ...context, programRating: 60 }],
])
const fit = POWER_PROGRAM_RELEASE

test('released Program blend matches learned component margin and venue algebra', () => {
  const result = withProgramPower(base, contexts, mapping, fit)
  const a = result.ratings[0],
    b = result.ratings[1]
  const expected =
    (1 - fit.weight) * (20 + 2.6) +
    fit.weight * ((15 - 5 + 2.5) * fit.scale + fit.homeOffset)
  assert.ok(
    Math.abs(a.power - b.power + a.homeFieldAdvantage - expected) < 0.02,
  )
  assert.ok(Math.abs(a.offense + a.defense + a.specialTeams - a.power) <= 0.011)
  assert.equal(result.calibration, fit.probability)
  assert.deepEqual(
    result.ratings.filter((r) => r.published).map((r) => r.rank),
    [1, 2],
  )
  assert.equal(base.ratings[0].power, 10)
  const forward = projectPowerMatchup(result, 'a', 'b', 'neutral')
  const reverse = projectPowerMatchup(result, 'b', 'a', 'neutral')
  assert.equal(forward.projectedMargin, -reverse.projectedMargin)
  assert.equal(forward.teamAWinProbability, reverse.teamBWinProbability)
})

test('FCS matchups preserve base point projections with the combined probability curve', () => {
  const result = withProgramPower(base, contexts, mapping, fit)
  for (const venue of ['neutral', 'team_a', 'team_b']) {
    const original = projectPowerMatchup(
      { ...base, calibration: fit.probability },
      'a',
      'fcs',
      venue,
    )
    assert.deepEqual(projectPowerMatchup(result, 'a', 'fcs', venue), original)
  }
})

test('missing history matches neutral research fallback; future training and duplicate blending fail', () => {
  const result = withProgramPower(base, new Map(), mapping, fit)
  assert.equal(
    result.ratings[0].power,
    Math.round((1 - fit.weight) * 1000) / 100,
  )
  assert.throws(
    () => withProgramPower(result, contexts, mapping, fit),
    /already applied/,
  )
  assert.throws(
    () => withProgramPower({ ...base, season: 2025 }, contexts, mapping, fit),
    /earlier-season/,
  )
  assert.throws(
    () =>
      withProgramPower(
        base,
        new Map([['a', { ...context, historyThroughSeason: 2026 }]]),
        mapping,
        fit,
      ),
    /prior seasons/,
  )
})
