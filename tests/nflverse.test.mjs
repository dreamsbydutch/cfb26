import assert from 'node:assert/strict'
import test from 'node:test'
import { nflRosterStatus, nflStatistics, parseCsv } from '../convex/nflverse.ts'

test('CSV parsing preserves quoted commas and escaped quotes', () => {
  assert.deepEqual(
    parseCsv('id,name\r\n1,"Smith, John"\r\n2,"A ""Nickname"" B"'),
    [
      { id: '1', name: 'Smith, John' },
      { id: '2', name: 'A "Nickname" B' },
    ],
  )
})

test('nflverse statuses map to the retained roster vocabulary', () => {
  assert.equal(nflRosterStatus('ACT'), 'active')
  assert.equal(nflRosterStatus('DEV'), 'practice_squad')
  assert.equal(nflRosterStatus('PUP'), 'injured_reserve')
  assert.equal(nflRosterStatus('CUT'), 'inactive')
})

test('conventional stats omit absent and zero values', () => {
  assert.deepEqual(nflStatistics({ passing_yards: '245', targets: '0' }), [
    { category: 'passing_yards', value: 245 },
  ])
})
