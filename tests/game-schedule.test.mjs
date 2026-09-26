import assert from 'node:assert/strict'
import test from 'node:test'
import {
  gameStatus,
  scheduleSections,
} from '../src/features/landscape/gameTimeSlots.ts'

const now = Date.UTC(2026, 8, 26, 14)
const game = (id, extras = {}) => ({
  id,
  startTime: now + 2 * 3600000,
  completed: false,
  landscapeRating: 50,
  michiganRating: 50,
  ...extras,
})

test('upcoming games precede started games and final results regardless of interest', () => {
  const sections = scheduleSections(
    [
      game('final', {
        startTime: now - 20 * 3600000,
        completed: true,
        homePoints: 29,
        awayPoints: 23,
        landscapeRating: 99,
      }),
      game('started', { startTime: now - 3600000 }),
      game('upcoming'),
    ],
    'landscape',
    now,
  )
  assert.deepEqual(
    sections.map((s) => s.groups[0].games[0].id),
    ['upcoming', 'started', 'final'],
  )
})

test('final scores require completed status and both scores, including zero', () => {
  assert.equal(
    gameStatus(
      game('zero', { completed: true, homePoints: 0, awayPoints: 7 }),
      now,
    ),
    'Final',
  )
  assert.equal(
    gameStatus(game('missing', { completed: true, homePoints: 7 }), now),
    'Result pending',
  )
  assert.equal(
    gameStatus(game('old', { startTime: now - 86400000 }), now),
    'Result pending',
  )
  assert.equal(
    gameStatus(
      game('partial', {
        startTime: now - 3600000,
        homePoints: 7,
        awayPoints: 0,
      }),
      now,
    ),
    'Started',
  )
  assert.equal(
    gameStatus(game('canceled', { canceled: true }), now),
    'Canceled',
  )
})

test('upcoming windows stay chronological and the selected lens orders within each window', () => {
  const games = [
    game('late', { startTime: now + 9 * 3600000, landscapeRating: 100 }),
    game('national', { landscapeRating: 90, michiganRating: 20 }),
    game('michigan', { landscapeRating: 20, michiganRating: 90 }),
  ]
  assert.deepEqual(
    scheduleSections(games, 'landscape', now)[0].groups.flatMap((g) =>
      g.games.map((row) => row.id),
    ),
    ['national', 'michigan', 'late'],
  )
  assert.deepEqual(
    scheduleSections(games, 'michigan', now)[0].groups.flatMap((g) =>
      g.games.map((row) => row.id),
    ),
    ['michigan', 'national', 'late'],
  )
  assert.deepEqual(
    games.map((g) => g.id),
    ['late', 'national', 'michigan'],
  )
})

test('kickoff transitions with the clock and past-only weeks show newest results first', () => {
  const upcoming = game('next')
  assert.equal(gameStatus(upcoming, upcoming.startTime), 'Started')
  assert.equal(
    gameStatus(upcoming, upcoming.startTime + 8 * 3600000),
    'Result pending',
  )
  const sections = scheduleSections(
    [
      game('older', { startTime: now - 2 * 86400000, completed: true }),
      game('recent', { startTime: now - 86400000, completed: true }),
    ],
    'landscape',
    now,
  )
  assert.equal(sections.length, 1)
  assert.equal(sections[0].label, 'Past games & results')
  assert.deepEqual(
    sections[0].groups.flatMap((g) => g.games.map((row) => row.id)),
    ['recent', 'older'],
  )
  assert.deepEqual(scheduleSections([], 'landscape', now), [])
})
