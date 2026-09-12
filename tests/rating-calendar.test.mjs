import assert from 'node:assert/strict'
import test from 'node:test'
import { publicationWeek } from '../convex/ratingCalendar.ts'

test('postseason week one cannot close the Week 7 resume gate', () => {
  const startTime = Date.UTC(2026, 11, 18)
  const schedule = [
    { seasonType: 'regular', week: 16, startTime: startTime - 7 * 86400000 },
    { seasonType: 'postseason', week: 1, startTime },
  ]
  assert.equal(
    publicationWeek({ asOf: startTime, selected: schedule[1], schedule }),
    17,
  )
  assert.equal(
    publicationWeek({
      asOf: startTime + 14 * 86400000,
      selected: schedule[1],
      schedule,
    }),
    19,
  )
  assert.equal(
    publicationWeek({ asOf: startTime, selected: schedule[0], schedule }),
    16,
  )
})
