import assert from 'node:assert/strict'
import test from 'node:test'

import { auditCfbdSeason } from '../convex/cfbdAudit.ts'

const completedGame = {
  awayClassification: 'fbs',
  awayId: 2,
  awayPoints: 13,
  awayTeam: 'Fresno State',
  completed: true,
  homeClassification: 'fbs',
  homeId: 1,
  homePoints: 30,
  homeTeam: 'Michigan',
  id: 401628455,
  neutralSite: false,
  season: 2024,
  seasonType: 'regular',
  startDate: '2024-08-31T23:30:00.000Z',
  week: 1,
}

const gameStats = {
  id: completedGame.id,
  teams: [
    {
      homeAway: 'home',
      points: 30,
      stats: [{ category: 'totalYards', stat: '269' }],
      team: 'Michigan',
      teamId: 1,
    },
    {
      homeAway: 'away',
      points: 13,
      stats: [{ category: 'totalYards', stat: '244' }],
      team: 'Fresno State',
      teamId: 2,
    },
  ],
}

test('season audit accepts a reconciled as-of-week dataset', () => {
  const report = auditCfbdSeason({
    fbsTeams: [
      { id: 1, school: 'Michigan' },
      { id: 2, school: 'Fresno State' },
    ],
    games: [completedGame],
    season: 2024,
    teamGameStats: [gameStats],
    throughWeek: 1,
  })

  assert.equal(report.ok, true)
  assert.deepEqual(report.issues, [])
  assert.deepEqual(report.counts, {
    completedGames: 1,
    crossDivisionGames: 0,
    fbsTeamsRepresented: 2,
    games: 1,
    postseasonGames: 0,
    teamGameStats: 1,
  })
})

test('season audit reports duplicates, future games, and orphaned box scores', () => {
  const report = auditCfbdSeason({
    fbsTeams: [
      { id: 1, school: 'Michigan' },
      { id: 2, school: 'Fresno State' },
      { id: 3, school: 'Ohio State' },
    ],
    games: [completedGame, completedGame, { ...completedGame, id: 9, week: 2 }],
    season: 2024,
    teamGameStats: [gameStats, { ...gameStats, id: 999 }],
    throughWeek: 1,
  })

  assert.equal(report.ok, false)
  assert.deepEqual(
    report.issues.map((issue) => issue.code),
    ['DUPLICATE_GAME', 'FUTURE_GAME', 'MISSING_FBS_TEAM', 'ORPHANED_STATS'],
  )
})

test('season audit treats an idle FBS team as limited coverage, not corruption', () => {
  const report = auditCfbdSeason({
    fbsTeams: [
      { id: 1, school: 'Michigan' },
      { id: 2, school: 'Fresno State' },
      { id: 3, school: 'Ohio State' },
    ],
    games: [completedGame],
    season: 2024,
    teamGameStats: [gameStats],
    throughWeek: 1,
  })

  assert.equal(report.ok, true)
  assert.deepEqual(report.issues, [
    {
      code: 'MISSING_FBS_TEAM',
      message: '1 FBS team(s) have no game through Week 1.',
      severity: 'warning',
    },
  ])
})

test('season audit rejects invalid completed scores and mismatched participants', () => {
  const report = auditCfbdSeason({
    fbsTeams: [
      { id: 1, school: 'Michigan' },
      { id: 2, school: 'Fresno State' },
    ],
    games: [{ ...completedGame, homePoints: null }],
    season: 2024,
    teamGameStats: [
      {
        ...gameStats,
        teams: [gameStats.teams[0], { ...gameStats.teams[1], teamId: 99 }],
      },
    ],
    throughWeek: 1,
  })

  assert.deepEqual(
    report.issues.map((issue) => issue.code),
    ['INVALID_COMPLETED_SCORE', 'PARTICIPANT_MISMATCH'],
  )
  assert.equal(report.ok, false)
})
