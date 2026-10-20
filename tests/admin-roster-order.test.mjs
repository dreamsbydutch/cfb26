import assert from 'node:assert/strict'
import test from 'node:test'
import { compareAdminRosterPlayers } from '../src/features/roster/adminRosterOrder.ts'

test('admin roster sorts position, then tier, then snaps, then name', () => {
  const rows = [
    { position: 'RB', tier: 'starter', snaps: 500, name: 'Back' },
    { position: 'QB', tier: 'rotation', snaps: 400, name: 'Rotation' },
    { position: 'QB', tier: 'starter', snaps: 20, name: 'Starter' },
    { position: 'QB', tier: 'bench', snaps: null, name: 'Unknown' },
    { position: 'QB', tier: 'bench', snaps: 0, name: 'Zero' },
    { position: 'QB', tier: 'bench', snaps: 10, name: 'Zulu' },
    { position: 'QB', tier: 'bench', snaps: 10, name: 'Alpha' },
    { position: 'QB', tier: 'prospect', snaps: 100, name: 'Prospect' },
    { position: 'QB', tier: 'recruit', snaps: null, name: 'Recruit' },
  ]
  assert.deepEqual(
    rows.sort(compareAdminRosterPlayers).map((row) => row.name),
    [
      'Starter',
      'Rotation',
      'Alpha',
      'Zulu',
      'Zero',
      'Unknown',
      'Prospect',
      'Recruit',
      'Back',
    ],
  )
})

test('admin position aliases retain the requested position order', () => {
  const positions = [
    'QB',
    'HB',
    'FB',
    'SLOT',
    'TE',
    'OT',
    'OG',
    'C',
    'EDGE',
    'DL',
    'LB',
    'CB',
    'S',
    'K',
    'P',
    'LS',
    'unknown',
  ]
  const rows = [...positions]
    .reverse()
    .map((position) => ({
      position,
      name: position,
      tier: 'starter',
      snaps: 0,
    }))
  assert.deepEqual(
    rows.sort(compareAdminRosterPlayers).map((row) => row.position),
    positions,
  )
})
