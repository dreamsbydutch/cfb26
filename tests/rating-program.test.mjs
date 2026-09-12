import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildProgramRatings,
  evidencePercentiles,
  programSeasonWeight,
} from '../convex/programRating.ts'

const teams = ['sustained', 'brand', 'newcomer'].map((teamId) => ({
  teamId,
  published: true,
}))

test('verified offseason capacity updates Program before any current-season games', () => {
  const rows = buildProgramRatings({
    season: 2026,
    teams,
    evidence: [
      {
        teamId: 'newcomer',
        season: 2026,
        games: 0,
        performance: 50,
        acquisition: 90,
        development: 70,
      },
    ],
  })
  const newcomer = rows.find((row) => row.teamId === 'newcomer')
  assert.equal(newcomer.programResults, 50)
  assert.equal(newcomer.programAcquisition, 90)
  assert.ok(newcomer.programRating > 50)
  assert.equal(newcomer.programSeasons, 0)
})
test('recent sustained excellence outranks older prestige and a small hot sample', () => {
  const evidence = []
  for (let age = 0; age < 10; age++) {
    evidence.push({
      teamId: 'sustained',
      season: 2026 - age,
      games: 12,
      performance: age < 5 ? 85 : 40,
    })
    evidence.push({
      teamId: 'brand',
      season: 2026 - age,
      games: 12,
      performance: age < 5 ? 40 : 95,
    })
  }
  evidence.push({
    teamId: 'newcomer',
    season: 2026,
    games: 3,
    performance: 100,
  })
  const rows = buildProgramRatings({ season: 2026, teams, evidence })
  assert.equal(rows[0].teamId, 'sustained')
  assert.ok(
    rows.find((row) => row.teamId === 'newcomer').programCoverage <
      rows[0].programCoverage,
  )
  assert.equal(rows[0].programAcquisition, null)
  assert.deepEqual(
    rows.map((row) => row.programRank),
    [1, 2, 3],
  )
  assert.equal(programSeasonWeight(10), 0)
})
test('coverage at the neutral estimate cannot itself earn program points', () => {
  const base = { teamId: 'sustained', season: 2026, games: 12, performance: 70 }
  const score = (row) =>
    buildProgramRatings({
      season: 2026,
      teams: teams.slice(0, 1),
      evidence: [row],
    })[0]
  assert.equal(
    score(base).programRating,
    score({ ...base, acquisition: 50, development: 50 }).programRating,
  )
  assert.ok(
    score(base).programCoverage <
      score({ ...base, acquisition: 50, development: 50 }).programCoverage,
  )
})
test('future evidence and retired history cannot change the current program rating', () => {
  const score = (evidence) =>
    buildProgramRatings({ season: 2026, teams, evidence })
  assert.deepEqual(
    score([]),
    score([
      { teamId: 'brand', season: 2027, games: 12, performance: 100 },
      { teamId: 'brand', season: 2016, games: 12, performance: 100 },
    ]),
  )
  assert.deepEqual(
    [
      ...evidencePercentiles(
        new Map([
          ['a', 7],
          ['b', 7],
        ]),
      ),
    ].map((row) => row[1]),
    [50, 50],
  )
})
