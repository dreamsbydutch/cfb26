import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseScoreboard,
  parseScoreboardAllowance,
  needsScoreboard,
  acceptLiveScore,
  scoreboardBudget,
  scoreboardBackoff,
  SCOREBOARD_INTERVAL,
} from '../convex/scoreboardModel.ts'
import {
  gameStatus,
  scheduleSections,
} from '../src/features/landscape/gameTimeSlots.ts'

const now = Date.UTC(2026, 8, 26, 18)
const raw = {
  id: 1,
  homeTeam: { id: 2, points: 0 },
  awayTeam: { id: 3, points: 7 },
  status: 'in_progress',
  period: 1,
  clock: '8:32',
}
const row = parseScoreboard([raw])[0]
const liveScore = {
  status: row.status,
  homePoints: row.homePoints,
  awayPoints: row.awayPoints,
  period: row.period,
  clock: row.clock,
  updatedAt: now,
}
const game = {
  startTime: now - 3600000,
  completed: false,
  homeSourceId: 2,
  awaySourceId: 3,
  landscapeRating: 50,
  michiganRating: 30,
}

test('scoreboard validates identity, status and scores including shutouts', () => {
  assert.equal(row.homePoints, 0)
  assert.equal(row.awayPoints, 7)
  assert.throws(() => parseScoreboard([raw, raw]), /Duplicate/)
  assert.throws(
    () => parseScoreboard([{ ...raw, status: 'unknown' }]),
    /status/,
  )
  assert.throws(
    () => parseScoreboard([{ ...raw, homeTeam: { id: 2, points: null } }]),
    /no score/,
  )
  assert.throws(
    () => parseScoreboard([{ ...raw, awayTeam: { id: 3, points: -1 } }]),
    /number/,
  )
  assert.throws(() => parseScoreboard({}), /size/)
  assert.equal(
    parseScoreboard([
      { ...raw, status: 'scheduled', homeTeam: { id: 2, points: null } },
    ])[0].homePoints,
    null,
  )
})

test('allowance checks fail closed on missing metadata', () => {
  assert.deepEqual(
    parseScoreboardAllowance({
      remainingCalls: 1200,
      resetAt: '2026-10-01T00:00:00Z',
      features: { scoreboard: true },
    }),
    { enabled: true, remainingCalls: 1200, resetAt: Date.UTC(2026, 9, 1) },
  )
  assert.throws(() => parseScoreboardAllowance({ remainingCalls: null }))
})

test('polling only covers known unresolved games near kickoff', () => {
  assert.equal(needsScoreboard(game, now), true)
  assert.equal(
    needsScoreboard({ ...game, startTime: now + 11 * 60000 }, now),
    false,
  )
  assert.equal(
    needsScoreboard({ ...game, startTime: now + 10 * 60000 }, now),
    true,
  )
  assert.equal(
    needsScoreboard({ ...game, startTime: now - 9 * 3600000 }, now),
    false,
  )
  for (const extra of [
    { completed: true },
    { canceled: true },
    { startTimeTbd: true },
    { liveScore: { ...liveScore, status: 'completed' } },
  ])
    assert.equal(needsScoreboard({ ...game, ...extra }, now), false)
})

test('live updates cannot cross teams, regress a final, or overwrite newer data', () => {
  assert.equal(acceptLiveScore(game, row, now), true)
  assert.equal(acceptLiveScore(game, { ...row, homeId: 9 }, now), false)
  assert.equal(acceptLiveScore({ ...game, completed: true }, row, now), false)
  assert.equal(acceptLiveScore({ ...game, liveScore }, row, now - 1), false)
  assert.equal(
    acceptLiveScore(
      { ...game, liveScore: { ...liveScore, status: 'completed' } },
      row,
      now + 1,
    ),
    false,
  )
  assert.equal(
    acceptLiveScore(
      { ...game, liveScore },
      { ...row, status: 'scheduled' },
      now + 1,
    ),
    false,
  )
  // Provider score corrections are allowed; points need not monotonically increase.
  assert.equal(
    acceptLiveScore({ ...game, liveScore }, { ...row, awayPoints: 0 }, now + 1),
    true,
  )
})

test('request reservations cap daily/monthly usage and exclude overlapping polls', () => {
  const first = scoreboardBudget(null, now)
  assert.equal(first.monthRequests, 2)
  const state = {
    ...first,
    nextPollAt: now + SCOREBOARD_INTERVAL,
    allowanceCheckedAt: now,
  }
  assert.equal(scoreboardBudget(state, now + 1).allowed, false)
  assert.equal(
    scoreboardBudget(state, now + SCOREBOARD_INTERVAL).monthRequests,
    3,
  )
  assert.equal(
    scoreboardBudget(
      { ...state, monthRequests: 1500 },
      now + SCOREBOARD_INTERVAL,
    ).allowed,
    false,
  )
  assert.equal(
    scoreboardBudget({ ...state, dayRequests: 250 }, now + SCOREBOARD_INTERVAL)
      .allowed,
    false,
  )
  const nextMonth = scoreboardBudget(
    { ...state, monthRequests: 1500 },
    Date.UTC(2026, 9, 1),
  )
  assert.equal(nextMonth.allowed, true)
  assert.equal(nextMonth.monthRequests, 2)
  assert.equal(scoreboardBudget(state, now + 3600000).checkAllowance, true)
})

test('provider failures back off instead of retrying inside each poll', () => {
  assert.equal(scoreboardBackoff(403, 1), 86400000)
  assert.equal(scoreboardBackoff(429, 1), 3600000)
  assert.ok(scoreboardBackoff(500, 2) > scoreboardBackoff(500, 1))
  assert.equal(scoreboardBackoff(undefined, 50), 3600000)
})

test('UI distinguishes fresh live, delayed live, final and canonical daily results', () => {
  assert.equal(gameStatus({ ...game, liveScore }, now), 'Live')
  assert.equal(
    gameStatus({ ...game, liveScore }, now + 16 * 60000),
    'Score delayed',
  )
  assert.equal(
    gameStatus({ ...game, liveScore }, now + 9 * 3600000),
    'Result pending',
  )
  assert.equal(
    gameStatus(
      { ...game, liveScore: { ...liveScore, status: 'completed' } },
      now,
    ),
    'Final',
  )
  assert.equal(
    gameStatus(
      { ...game, completed: true, homePoints: 0, awayPoints: 7, liveScore },
      now,
    ),
    'Final',
  )
  const sections = scheduleSections(
    [
      { ...game, id: 'live', liveScore },
      { ...game, id: 'next', startTime: now + 3600000 },
      { ...game, id: 'done', completed: true, homePoints: 21, awayPoints: 7 },
    ],
    'landscape',
    now,
  )
  assert.deepEqual(
    sections.map((s) => s.label),
    ['Live & started', 'Upcoming', 'Past games & results'],
  )
})
