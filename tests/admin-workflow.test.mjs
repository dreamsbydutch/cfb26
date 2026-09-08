import assert from 'node:assert/strict'
import test from 'node:test'
import {
  findActiveCommitment,
  parseOwnerSeason,
} from '../src/features/roster/adminWorkflow.ts'

const commitments = [
  {
    commitment: {
      playerId: 'prospect-2027',
      season: 2027,
      status: 'committed',
    },
  },
  {
    commitment: {
      playerId: 'former-prospect',
      season: 2026,
      status: 'enrolled',
    },
  },
]

test('commitment actions are unavailable for roster players without an active commitment', () => {
  assert.equal(findActiveCommitment(commitments, 'roster-player'), null)
})

test('commitment actions use the matching active commitment record', () => {
  assert.equal(
    findActiveCommitment(commitments, 'prospect-2027'),
    commitments[0],
  )
  assert.equal(findActiveCommitment(commitments, 'former-prospect'), null)
})

test('the owner season persists only supported season values', () => {
  assert.equal(parseOwnerSeason('2027', 2026), 2027)
  assert.equal(parseOwnerSeason('2014', 2026), 2026)
  assert.equal(parseOwnerSeason('not-a-season', 2026), 2026)
})
