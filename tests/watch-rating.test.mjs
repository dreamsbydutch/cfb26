import assert from 'node:assert/strict'
import test from 'node:test'
import {
  watchBoard,
  watchRating,
} from '../src/features/landscape/watchRating.ts'
import { scoreHistory } from '../convex/scoreboardModel.ts'

const now = Date.UTC(2026, 8, 26, 20)
const score = (extras = {}) => ({
  status: 'in_progress',
  homePoints: 21,
  awayPoints: 17,
  period: 4,
  clock: '4:00',
  updatedAt: now,
  ...extras,
})
const game = (id, extras = {}) => ({
  _id: id,
  homeSourceName: id,
  awaySourceName: 'Away',
  landscapeRating: 60,
  startTime: now - 7200000,
  completed: false,
  liveScore: score(),
  ...extras,
})

test('close late game displaces an important blowout; importance breaks comparable games', () => {
  const close = game('close', { landscapeRating: 55 })
  const blowout = game('big', {
    landscapeRating: 95,
    liveScore: score({ homePoints: 42, awayPoints: 7 }),
  })
  assert.ok(watchRating(close, now).score > watchRating(blowout, now).score)
  assert.ok(
    watchRating(game('important', { landscapeRating: 75 }), now).score >
      watchRating(close, now).score,
  )
  const early = game('early', {
    liveScore: score({ period: 1, clock: '8:00' }),
  })
  assert.ok(
    watchRating(game('late'), now).score > watchRating(early, now).score,
  )
  assert.equal(
    watchRating(
      game('ot', { liveScore: score({ period: 5, clock: null }) }),
      now,
    ).reason,
    'Overtime',
  )
})

test('a comeback from a blowout earns a boost, which expires and ignores corrections', () => {
  const current = game('comeback', {
    liveScore: score({ homePoints: 28, awayPoints: 21 }),
    liveScoreHistory: [
      score({ homePoints: 28, awayPoints: 0, updatedAt: now - 900000 }),
    ],
  })
  assert.equal(watchRating(current, now).reason, 'Comeback alert')
  assert.ok(
    watchRating(current, now).score >
      watchRating({ ...current, liveScoreHistory: [] }, now).score,
  )
  assert.notEqual(
    watchRating(
      {
        ...current,
        liveScoreHistory: [
          score({ homePoints: 28, awayPoints: 0, updatedAt: now - 1900000 }),
        ],
      },
      now,
    ).reason,
    'Comeback alert',
  )
  assert.notEqual(
    watchRating(
      { ...current, liveScore: score({ homePoints: 7, awayPoints: 0 }) },
      now,
    ).reason,
    'Comeback alert',
  )
})

test('Michigan is always main TV; backups are fifth and fourth with no duplicate picks', () => {
  const games = [
    game('a', { landscapeRating: 85 }),
    game('b', { landscapeRating: 70 }),
    game('c', { landscapeRating: 50 }),
    game('d', { landscapeRating: 40 }),
    game('Michigan', { liveScore: score({ homePoints: 0, awayPoints: 56 }) }),
  ]
  const board = watchBoard(games, now)
  assert.deepEqual(
    board.active.map((r) => r.game._id),
    ['Michigan', 'a', 'b', 'c', 'd'],
  )
  assert.deepEqual(
    board.assignments.map((t) => [t.main?.game._id, t.backup?.game._id]),
    [
      ['Michigan', undefined],
      ['a', 'd'],
      ['b', 'c'],
    ],
  )
})

test('finals, cancellations, TBD and expired games vacate TV slots', () => {
  const games = [
    game('final', { completed: true }),
    game('live-final', { liveScore: score({ status: 'completed' }) }),
    game('canceled', { canceled: true }),
    game('tbd', { startTimeTbd: true }),
    game('expired', { startTime: now - 9 * 3600000, liveScore: undefined }),
  ]
  assert.equal(watchBoard(games, now).active.length, 0)
  assert.ok(
    watchBoard(games, now).assignments.every((t) => !t.main && !t.backup),
  )
})

test('fresh live games outrank stale scores; stale Michigan remains pinned', () => {
  const stale = game('stale', {
    landscapeRating: 99,
    liveScore: score({ updatedAt: now - 16 * 60000 }),
  })
  const live = game('fresh', {
    landscapeRating: 30,
    liveScore: score({ homePoints: 60, awayPoints: 0 }),
  })
  assert.deepEqual(
    watchBoard([stale, live], now).active.map((r) => r.game._id),
    ['fresh', 'stale'],
  )
  assert.equal(watchRating(stale, now).state, 'uncertain')
  assert.equal(
    watchBoard([{ ...stale, homeSourceName: 'Michigan' }, live], now)
      .assignments[0].main.game._id,
    'stale',
  )
})

test('new kickoffs join across windows; next window fills slots without far-future Michigan', () => {
  const live = game('live')
  const next = game('next', { startTime: now + 60000, liveScore: undefined })
  const later = game('Michigan', {
    startTime: now + 4 * 3600000,
    liveScore: undefined,
  })
  const board = watchBoard([live, next, later], now)
  assert.equal(board.assignments[0].main.game._id, 'live')
  assert.equal(board.assignments[1].main.game._id, 'next')
  assert.equal(board.assignments[2].main, undefined)
  assert.equal(watchBoard([live, next, later], now + 120000).active.length, 2)
  assert.equal(
    watchBoard([next, later], now).assignments[0].main.game._id,
    'next',
  )
})

test('pregame rating is Landscape and missing clock does not invent a last-minute finish', () => {
  assert.equal(
    watchRating(
      game('future', { startTime: now + 60000, liveScore: undefined }),
      now,
    ).score,
    60,
  )
  assert.ok(
    watchRating(
      game('unknown', { liveScore: score({ period: null, clock: null }) }),
      now,
    ).score < watchRating(game('late'), now).score,
  )
  assert.equal(
    watchRating(
      game('zero', { liveScore: score({ homePoints: 0, awayPoints: 0 }) }),
      now,
    ).reason,
    'Tied late',
  )
})

test('history is bounded to six recent in-progress observations', () => {
  const history = Array.from({ length: 20 }, (_, i) =>
    score({ updatedAt: now - (20 - i) * 60000 }),
  )
  assert.equal(
    scoreHistory(history, score({ updatedAt: now - 1000 }), now).length,
    6,
  )
  assert.deepEqual(
    scoreHistory(
      [score({ updatedAt: now - 31 * 60000 })],
      score({ status: 'scheduled' }),
      now,
    ),
    [],
  )
})
