import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildLineup,
  lineupPosition,
  specialTeamsUsage,
} from '../src/features/michigan/lineupModel.ts'

function entry(id, overrides = {}) {
  return {
    player: { _id: id, displayName: id },
    eligibility: { eligibleThroughSeason: 2029 },
    season: {
      listedPosition: 'WR',
      positionRoom: 'Receivers',
      rosterStatus: 'active',
      role: 'reserve',
      jerseyNumber: 0,
      heightInches: null,
      weightPounds: null,
      roomOrder: null,
      gamesPlayed: 6,
      depthStatus: 'available',
      eligibilityEvidence: { enrollmentSeason: 2025 },
      ...overrides,
    },
  }
}
const snapshot = (snaps, throughTeamGames = 5, gamesPlayed = 5) => ({
  snaps,
  throughTeamGames,
  gamesPlayed,
})
const ids = (rows) => rows.map((row) => row.id)

test('offense and defense show only assigned starters and rotation, including availability exceptions', () => {
  const rows = [
    entry('starter', {
      role: 'starter',
      depthStatus: 'out',
      availabilityNote: 'Ankle',
    }),
    entry('rotation', { role: 'rotation' }),
    entry('bench-high-snaps', {
      participationTotals: { offense: snapshot(500) },
    }),
    entry('young-prospect', {
      eligibilityEvidence: { enrollmentSeason: 2026 },
    }),
    entry('inactive', { role: 'starter', rosterStatus: 'inactive' }),
    entry('departed', { role: 'starter', rosterStatus: 'departed' }),
    entry('defender', {
      role: 'starter',
      listedPosition: 'CB',
      positionRoom: 'Secondary',
    }),
    { ...entry('missing-player', { role: 'starter' }), player: null },
  ]
  const result = buildLineup(rows, 2026)
  assert.deepEqual(ids(result.offense[0].starters), ['starter'])
  assert.deepEqual(ids(result.offense[0].rotation), ['rotation'])
  assert.equal(result.offense[0].starters[0].availability, 'out')
  assert.equal(result.offense[0].starters[0].availabilityNote, 'Ankle')
  assert.deepEqual(ids(result.defense[0].starters), ['defender'])
})

test('positions follow football order, preserve multiple starters, and normalize RB to HB', () => {
  const result = buildLineup(
    [
      entry('wide-one', { role: 'starter', roomOrder: 2 }),
      entry('wide-two', { role: 'starter', roomOrder: 1 }),
      entry('back', {
        role: 'rotation',
        listedPosition: 'RB',
        positionRoom: 'Backs',
      }),
      entry('quarterback', {
        role: 'starter',
        listedPosition: 'QB',
        positionRoom: 'Quarterbacks',
      }),
      entry('unknown', {
        role: 'starter',
        listedPosition: 'ATH',
        positionRoom: 'Other',
      }),
    ],
    2026,
  )
  assert.deepEqual(
    result.offense.map((position) => position.position),
    ['QB', 'HB', 'WR'],
  )
  assert.deepEqual(ids(result.offense[2].starters), ['wide-two', 'wide-one'])
  assert.deepEqual(ids(result.unmapped), ['unknown'])
  assert.equal(lineupPosition(' rb '), 'HB')
})

test('special-teams tiers use team games rather than player appearances and handle exact thresholds', () => {
  assert.deepEqual(specialTeamsUsage(snapshot(50)), { tier: 'core', rate: 10 })
  assert.deepEqual(specialTeamsUsage(snapshot(25, 5, 1)), {
    tier: 'rotation',
    rate: 5,
  })
  assert.deepEqual(specialTeamsUsage(snapshot(49)), {
    tier: 'rotation',
    rate: 9.8,
  })
  assert.deepEqual(specialTeamsUsage(snapshot(24)), {
    tier: 'limited',
    rate: 4.8,
  })
  assert.deepEqual(specialTeamsUsage(snapshot(0, 5, 0)), {
    tier: 'none',
    rate: 0,
  })
  assert.equal(specialTeamsUsage(snapshot(299, 30)).tier, 'rotation')
})

test('unknown or invalid special-teams cutoffs stay unknown rather than becoming zero or infinity', () => {
  for (const value of [
    undefined,
    snapshot(20, 0),
    snapshot(20, -1),
    snapshot(-1),
    snapshot(NaN),
    snapshot(20, Infinity),
  ]) {
    assert.deepEqual(specialTeamsUsage(value), { tier: 'unknown', rate: null })
  }
})

test('special-teams contributors can be reserves on offense or defense; primary-phase snaps do not establish ST roles', () => {
  const result = buildLineup(
    [
      entry('reserve-core', {
        participationTotals: { specialTeams: snapshot(60) },
      }),
      entry('defense-rotation', {
        listedPosition: 'LB',
        positionRoom: 'Linebackers',
        participationTotals: { specialTeams: snapshot(25) },
      }),
      entry('offense-starter', {
        role: 'starter',
        participationTotals: {
          offense: snapshot(400),
          specialTeams: snapshot(5),
        },
      }),
      entry('no-st-snapshot', {
        role: 'starter',
        participationTotals: { offense: snapshot(500) },
      }),
    ],
    2026,
  )
  assert.deepEqual(ids(result.specialTeams.core), ['reserve-core'])
  assert.deepEqual(ids(result.specialTeams.rotation), ['defense-rotation'])
  assert.deepEqual(ids(result.specialTeams.limited), ['offense-starter'])
  assert.equal(result.specialTeams.unknownCount, 1)
  assert.equal(result.specialTeams.recordedCount, 3)
})

test('specialists are compared within their position using ST rate, with tied leaders kept together', () => {
  const result = buildLineup(
    [
      entry('kicker-one', {
        listedPosition: 'K',
        positionRoom: 'Specialists',
        role: 'reserve',
        participationTotals: { specialTeams: snapshot(5) },
      }),
      entry('kicker-two', {
        listedPosition: 'K',
        positionRoom: 'Specialists',
        role: 'starter',
        participationTotals: { specialTeams: snapshot(6, 6, 6) },
      }),
      entry('backup-kicker', {
        listedPosition: 'K',
        positionRoom: 'Specialists',
        role: 'starter',
        participationTotals: { specialTeams: snapshot(2) },
      }),
      entry('unknown-punter', {
        listedPosition: 'P',
        positionRoom: 'Specialists',
        role: 'starter',
      }),
    ],
    2026,
  )
  const [kickers, punters] = result.specialTeams.specialists
  assert.deepEqual(ids(kickers.primary).sort(), ['kicker-one', 'kicker-two'])
  assert.deepEqual(ids(kickers.others), ['backup-kicker'])
  assert.deepEqual(ids(punters.primary), [])
  assert.deepEqual(ids(punters.unknown), ['unknown-punter'])
  assert.deepEqual(result.specialTeams.core, [])
  assert.deepEqual(result.specialTeams.rotation, [])
})

test('phase counts and eligibility remain independent, missing main-phase snaps stay unknown, and duplicate people are not repeated', () => {
  const row = entry('two-phase-player', {
    role: 'starter',
    participationTotals: {
      offense: snapshot(100, 6, 6),
      specialTeams: snapshot(50, 5, 4),
    },
  })
  const result = buildLineup(
    [
      row,
      row,
      entry('unknown-snaps', {
        role: 'rotation',
        eligibilityEvidence: { enrollmentSeason: null },
      }),
    ],
    2026,
  )
  const starter = result.offense[0].starters[0]
  assert.equal(starter.games, 6)
  assert.equal(starter.snaps, 100)
  assert.equal(starter.specialTeams.snaps, 50)
  assert.equal(starter.specialTeams.rate, 10)
  assert.deepEqual(ids(result.specialTeams.core), ['two-phase-player'])
  assert.deepEqual(result.specialTeams.cutoffs, [5])
  assert.equal(result.offense[0].rotation[0].snaps, null)
  assert.equal(result.offense[0].rotation[0].games, 6)
  assert.equal(result.offense[0].rotation[0].year, null)
  assert.equal(result.offense[0].rotation[0].band, 'unknown')
})

test('an empty season has empty units and honest ST coverage counts', () => {
  const result = buildLineup([], 2026)
  assert.deepEqual(result.offense, [])
  assert.deepEqual(result.defense, [])
  assert.equal(result.specialTeams.recordedCount, 0)
  assert.equal(result.specialTeams.unknownCount, 0)
  assert.deepEqual(result.specialTeams.cutoffs, [])
})

test('search and filters cannot promote a backup specialist to the primary usage group', () => {
  const rows = [
    entry('primary', {
      listedPosition: 'K',
      positionRoom: 'Specialists',
      participationTotals: { specialTeams: snapshot(10) },
    }),
    entry('backup', {
      listedPosition: 'K',
      positionRoom: 'Specialists',
      participationTotals: { specialTeams: snapshot(5) },
    }),
  ]
  const result = buildLineup(rows, 2026, new Set(['backup']))
  assert.deepEqual(result.specialTeams.specialists[0].primary, [])
  assert.deepEqual(ids(result.specialTeams.specialists[0].others), ['backup'])
  assert.equal(result.specialTeams.recordedCount, 1)
})
