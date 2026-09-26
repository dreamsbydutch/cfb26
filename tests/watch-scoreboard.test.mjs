import assert from 'node:assert/strict'
import test from 'node:test'
import {
  otherScoreboardGames,
  scoreboardStatus,
} from '../src/features/landscape/scoreboardGames.ts'

const now = Date.UTC(2026, 8, 26, 20)
const base = {
  _id: 'one',
  homeSourceName: 'Home',
  awaySourceName: 'Away',
  startTime: now - 3600000,
  completed: false,
  landscapeRating: 70,
}
const live = {
  status: 'in_progress',
  homePoints: 0,
  awayPoints: 7,
  period: 4,
  clock: '0:32',
  updatedAt: now,
}

test('visible clock preserves zeros, overtime and stale evidence', () => {
  assert.equal(
    scoreboardStatus({ ...base, liveScore: live }, now).label,
    'Q4 · 0:32',
  )
  assert.equal(scoreboardStatus({ ...base, liveScore: live }, now).home, 0)
  assert.equal(
    scoreboardStatus(
      { ...base, liveScore: { ...live, period: 6, clock: null } },
      now,
    ).label,
    '2OT',
  )
  assert.equal(
    scoreboardStatus(
      { ...base, liveScore: { ...live, updatedAt: now - 16 * 60000 } },
      now,
    ).label,
    'Q4 · 0:32',
  )
  assert.equal(scoreboardStatus(base, now).label, 'Awaiting score')
})

test('official results override live scores and incomplete results are not finals', () => {
  const game = {
    ...base,
    completed: true,
    homePoints: 0,
    awayPoints: 21,
    liveScore: live,
  }
  assert.deepEqual(scoreboardStatus(game, now), {
    home: 0,
    away: 21,
    kind: 'final',
    label: 'Final',
  })
  assert.equal(
    scoreboardStatus({ ...game, homePoints: undefined }, now).label,
    'Result pending',
  )
  assert.equal(
    scoreboardStatus(
      { ...base, liveScore: { ...live, status: 'completed' } },
      now,
    ).label,
    'Final',
  )
})

test('scoreboard excludes assigned slots, keeps other live games, recent results and chronological upcoming games', () => {
  const games = [
    { ...base, _id: 'assigned', liveScore: live },
    { ...base, _id: 'other', liveScore: live },
    { ...base, _id: 'final', completed: true, homePoints: 0, awayPoints: 21 },
    { ...base, _id: 'old', completed: true, startTime: now - 25 * 3600000 },
    { ...base, _id: 'canceled', canceled: true },
    { ...base, _id: 'later', startTime: now + 7200000 },
    { ...base, _id: 'next', startTime: now + 3600000 },
    { ...base, _id: 'tbd', startTimeTbd: true },
  ]
  const groups = otherScoreboardGames(games, new Set(['assigned']), now)
  assert.deepEqual(
    groups.map((g) => g.games.map((game) => game._id)),
    [['other'], ['final'], ['next', 'later', 'tbd']],
  )
  assert.equal(otherScoreboardGames(games, new Set(), now)[0].games.length, 2)
  assert.match(scoreboardStatus(games[5], now).label, /[ap]\.?m/i)
})
