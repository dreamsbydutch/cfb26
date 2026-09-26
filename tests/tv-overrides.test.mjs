import assert from 'node:assert/strict'
import test from 'node:test'
import {
  manualTvPlan,
  parseTvOverrides,
  tvSlotMemory,
} from '../src/features/landscape/watchRating.ts'

const now = Date.UTC(2026, 8, 26, 20)
const games = Array.from({ length: 8 }, (_, i) => ({
  _id: String(i),
  homeSourceName: `Team ${i}`,
  awaySourceName: 'Away',
  startTime: now - 3600000,
  tvOutlets: [`Network ${i}`],
}))
const event = (allowFlip = true) => ({
  network: 'Sportsnet',
  event: 'Blue Jays',
  allowFlip,
})
const empty = () => Array.from({ length: 6 }, () => null)
const ids = (plan) => plan.slots.filter(Boolean).map((g) => g._id)

test('every combination of manual slots fills remaining capacity with distinct top games', () => {
  for (let mask = 0; mask < 64; mask++) {
    const overrides = empty().map((_, i) => (mask & (1 << i) ? event() : null))
    const plan = manualTvPlan(games, [], overrides, now)
    const capacity = 6 - overrides.filter(Boolean).length
    assert.deepEqual(
      ids(plan).sort(),
      games
        .slice(0, capacity)
        .map((g) => g._id)
        .sort(),
      `mask ${mask}`,
    )
    overrides.forEach((manual, i) => {
      if (manual) assert.equal(plan.slots[i], undefined)
    })
  }
})
test('manual main without flipping reserves both slots and reallocates all football picks', () => {
  for (const index of [0, 2, 4]) {
    const overrides = empty()
    overrides[index] = event(false)
    const plan = manualTvPlan(games, [], overrides, now)
    assert.deepEqual(ids(plan).sort(), ['0', '1', '2', '3'])
    assert.ok(plan.disabled.includes(index + 1))
    assert.equal(plan.slots[index + 1], undefined)
  }
})
test('Michigan moves to an available main slot and has no automatic flip game', () => {
  const michigan = { ...games[0], homeSourceName: 'Michigan' }
  const overrides = empty()
  overrides[0] = event(false)
  const plan = manualTvPlan([michigan, ...games.slice(1)], [], overrides, now)
  assert.equal(plan.slots[2]._id, '0')
  assert.equal(plan.slots[3], undefined)
  assert.deepEqual(ids(plan).sort(), ['0', '1', '2'])
  overrides[3] = event()
  assert.equal(
    manualTvPlan(
      [michigan, ...games.slice(1)],
      [],
      overrides,
      now,
    ).disabled.includes(3),
    false,
  )
})
test('retained secondary games stay in their slots through rank changes', () => {
  const overrides = empty()
  overrides[1] = event()
  const before = manualTvPlan(games, [], overrides, now)
  const after = manualTvPlan(
    [games[0], games[4], games[3], games[2], games[1], ...games.slice(5)],
    tvSlotMemory(before.slots),
    overrides,
    now,
  )
  assert.deepEqual(
    after.slots.map((g) => g?._id),
    before.slots.map((g) => g?._id),
  )
})
test('clearing an override restores football capacity; empty slates preserve only manual slots', () => {
  const overrides = empty()
  overrides[2] = event(false)
  assert.equal(ids(manualTvPlan(games, [], overrides, now)).length, 4)
  assert.equal(ids(manualTvPlan(games, [], empty(), now)).length, 6)
  assert.deepEqual(ids(manualTvPlan([], [], overrides, now)), [])
})
test('stored manual events are validated, trimmed and bounded', () => {
  const overrides = empty()
  overrides[0] = { network: '  ESPN  ', event: '  Tennis  ', allowFlip: false }
  assert.deepEqual(parseTvOverrides(overrides)[0], {
    network: 'ESPN',
    event: 'Tennis',
    allowFlip: false,
  })
  assert.deepEqual(parseTvOverrides({}), empty())
  overrides[1] = { network: 42, event: 'Invalid', allowFlip: true }
  overrides[2] = { network: ' ', event: 'Empty', allowFlip: true }
  overrides[3] = {
    network: 'x'.repeat(100),
    event: 'y'.repeat(200),
    allowFlip: true,
  }
  assert.equal(parseTvOverrides(overrides)[1], null)
  assert.equal(parseTvOverrides(overrides)[2], null)
  assert.equal(parseTvOverrides(overrides)[3].network.length, 60)
  assert.equal(parseTvOverrides(overrides)[3].event.length, 120)
})
