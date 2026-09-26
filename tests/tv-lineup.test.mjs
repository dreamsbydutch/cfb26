import assert from 'node:assert/strict'
import test from 'node:test'
import {
  stableTvPlan,
  tvSlotMemory,
} from '../src/features/landscape/watchRating.ts'

const game = (id, network) => ({
  _id: id,
  homeSourceName: id,
  awaySourceName: 'Away',
  tvOutlets: [network],
})
const games = [
  game('A', 'ABC'),
  game('B', 'ESPN'),
  game('C', 'FOX'),
  game('D', 'CBS'),
  game('E', 'BTN'),
  game('F', 'ESPN2'),
]
const ids = (plan) => plan.map((g) => g?._id)

test('initial lineup includes distinct commercial-break sixth pick', () => {
  assert.deepEqual(ids(stableTvPlan(games, [])), ['A', 'F', 'B', 'E', 'C', 'D'])
})
test('ranks two through five can swap without changing any TV or backup', () => {
  const before = stableTvPlan(games, [])
  const after = stableTvPlan(
    [games[0], games[4], games[3], games[1], games[2], games[5]],
    tvSlotMemory(before),
  )
  assert.deepEqual(ids(after), ids(before))
})
test('main TV stays when its game slips to third, but switches at fourth', () => {
  const memory = tvSlotMemory(stableTvPlan(games, []))
  assert.equal(
    stableTvPlan(
      [games[1], games[2], games[0], games[3], games[4], games[5]],
      memory,
    )[0]._id,
    'A',
  )
  assert.equal(
    stableTvPlan(
      [games[1], games[2], games[3], games[0], games[4], games[5]],
      memory,
    )[0]._id,
    'B',
  )
})
test('new games reuse vacated networks rather than swap the secondary TVs', () => {
  const memory = tvSlotMemory(stableTvPlan(games, []))
  const replacements = [
    games[0],
    game('NewFOX', 'FOX'),
    game('NewESPN', 'ESPN'),
    games[3],
    games[4],
    games[5],
  ]
  const plan = stableTvPlan(replacements, memory)
  assert.equal(plan[2]._id, 'NewESPN')
  assert.equal(plan[4]._id, 'NewFOX')
})
test('Michigan immediately takes main TV and has no commercial-break pick', () => {
  const memory = tvSlotMemory(stableTvPlan(games, []))
  const plan = stableTvPlan([game('Michigan', 'CBS'), ...games], memory)
  assert.equal(plan[0]._id, 'Michigan')
  assert.equal(plan[1], undefined)
  const picked = plan.filter(Boolean).map((g) => g._id)
  assert.equal(new Set(picked).size, picked.length)
  assert.equal(picked.length, 5)
})
test('empty and small slates never duplicate a game to fill a TV', () => {
  assert.ok(stableTvPlan([], []).every((g) => !g))
  assert.deepEqual(ids(stableTvPlan(games.slice(0, 2), [])), [
    'A',
    undefined,
    'B',
    undefined,
    undefined,
    undefined,
  ])
})
