import assert from 'node:assert/strict'
import test from 'node:test'
import { gameTimeSlot } from '../src/features/landscape/gameTimeSlots.ts'

const easternKickoff = (hour, minute = 0) =>
  Date.UTC(2026, 8, 19, hour + 4, minute)

test('common kickoff offsets collapse into the major football slates', () => {
  assert.equal(gameTimeSlot(easternKickoff(11, 30)).id, 'noon')
  assert.equal(gameTimeSlot(easternKickoff(12, 45)).id, 'noon')
  assert.equal(gameTimeSlot(easternKickoff(14, 30)).id, 'afternoon')
  assert.equal(gameTimeSlot(easternKickoff(16)).id, 'afternoon')
  assert.equal(gameTimeSlot(easternKickoff(18)).id, 'night')
  assert.equal(gameTimeSlot(easternKickoff(21, 29)).id, 'night')
})

test('games between the major slates retain useful separate groups', () => {
  assert.equal(gameTimeSlot(easternKickoff(11, 29)).id, 'early')
  assert.equal(gameTimeSlot(easternKickoff(13)).id, 'early-afternoon')
  assert.equal(gameTimeSlot(easternKickoff(16, 30)).id, 'early-evening')
  assert.equal(gameTimeSlot(easternKickoff(21, 30)).id, 'late-night')
})

test('slot dates follow the Eastern football calendar', () => {
  const slot = gameTimeSlot(easternKickoff(12))
  assert.equal(slot.dateKey, '2026-09-19')
  assert.equal(slot.dateLabel, 'Saturday, Sep 19')
})
