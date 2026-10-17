import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collegeYear,
  rosterEligibilityBand,
  rosterGroup,
  rosterParticipation,
} from '../src/features/michigan/rosterSheetModel.ts'

test('roster participation displays the saved phase GP and snaps instead of stale annual zeroes', () => {
  const participation = rosterParticipation({
    gamesPlayed: 0,
    positionRoom: 'Quarterbacks',
    participationTotals: {
      offense: { gamesPlayed: 5, snaps: 299, throughTeamGames: 5 },
    },
  })
  assert.equal(participation.games, 5)
  assert.equal(participation.snaps, 299)
  assert.equal(participation.phase, 'offense')
  assert.equal(participation.throughTeamGames, 5)
})

test('roster participation uses the main phase without summing overlapping GP or special-teams snaps', () => {
  const participationTotals = {
    offense: { gamesPlayed: 5, snaps: 156, throughTeamGames: 5 },
    defense: { gamesPlayed: 4, snaps: 120, throughTeamGames: 5 },
    specialTeams: { gamesPlayed: 3, snaps: 30, throughTeamGames: 4 },
  }
  for (const [positionRoom, phase, games, snaps] of [
    ['Backs', 'offense', 5, 156],
    ['Receivers', 'offense', 5, 156],
    ['Offensive line', 'offense', 5, 156],
    ['Defensive line', 'defense', 4, 120],
    ['Linebackers', 'defense', 4, 120],
    ['Secondary', 'defense', 4, 120],
    ['Specialists', 'specialTeams', 3, 30],
  ]) {
    const participation = rosterParticipation({
      gamesPlayed: 6,
      positionRoom,
      participationTotals,
    })
    assert.equal(participation.phase, phase)
    assert.equal(participation.games, games)
    assert.equal(participation.snaps, snaps)
  }
})

test('roster participation preserves explicit zeroes and never invents snaps for an unknown phase', () => {
  const zero = rosterParticipation({
    gamesPlayed: 3,
    positionRoom: 'Quarterbacks',
    participationTotals: {
      offense: { gamesPlayed: 0, snaps: 0, throughTeamGames: 5 },
    },
  })
  assert.equal(zero.games, 0)
  assert.equal(zero.snaps, 0)
  for (const positionRoom of ['Backs', 'Other']) {
    const missing = rosterParticipation({
      gamesPlayed: 3,
      positionRoom,
      participationTotals: {
        specialTeams: { gamesPlayed: 2, snaps: 20, throughTeamGames: 5 },
      },
    })
    assert.equal(missing.games, 3)
    assert.equal(missing.snaps, null)
    assert.equal(missing.throughTeamGames, null)
  }
  const historical = rosterParticipation({
    gamesPlayed: 12,
    positionRoom: 'Quarterbacks',
  })
  assert.equal(historical.games, 12)
  assert.equal(historical.snaps, null)
})

test('starting and meaningful rotation roles take precedence over college year', () => {
  for (const role of ['starter', 'rotation']) {
    for (const enrollmentSeason of [2026, 2025, 2022, null]) {
      assert.equal(rosterGroup({ role, enrollmentSeason, season: 2026 }), role)
    }
  }
})

test('limited-participation players are prospects only in their first two college years', () => {
  for (const role of ['reserve', 'unassigned']) {
    for (const enrollmentSeason of [2026, 2025]) {
      assert.equal(
        rosterGroup({ role, enrollmentSeason, season: 2026 }),
        'prospect',
      )
    }
    for (const enrollmentSeason of [2024, 2023, 2022, null, 2027]) {
      assert.equal(
        rosterGroup({ role, enrollmentSeason, season: 2026 }),
        'bench',
      )
    }
  }
})

test('prospects advance to bench with college experience, including transfers', () => {
  assert.equal(
    rosterGroup({ role: 'reserve', enrollmentSeason: 2025, season: 2026 }),
    'prospect',
  )
  assert.equal(
    rosterGroup({ role: 'reserve', enrollmentSeason: 2025, season: 2027 }),
    'bench',
  )
  // A transfer arriving at Michigan in 2026 still has four college years.
  assert.equal(
    rosterGroup({ role: 'reserve', enrollmentSeason: 2023, season: 2026 }),
    'bench',
  )
})

test('roster colors use college enrollment, including transfers, rather than Michigan entry', () => {
  assert.equal(collegeYear(2022, 2026), 5)
  assert.equal(
    rosterEligibilityBand({
      enrollmentSeason: 2022,
      eligibleThroughSeason: 2026,
      season: 2026,
    }),
    'final',
  )
  assert.equal(
    rosterEligibilityBand({
      enrollmentSeason: 2023,
      eligibleThroughSeason: 2027,
      season: 2026,
    }),
    'nfl_window',
  )
})

test('final eligibility takes precedence over college year and extensions preserve return options', () => {
  assert.equal(
    rosterEligibilityBand({
      enrollmentSeason: 2025,
      eligibleThroughSeason: 2026,
      season: 2026,
    }),
    'final',
  )
  assert.equal(
    rosterEligibilityBand({
      enrollmentSeason: 2021,
      eligibleThroughSeason: 2027,
      season: 2026,
    }),
    'nfl_window',
  )
  assert.equal(
    rosterEligibilityBand({
      enrollmentSeason: 2021,
      eligibleThroughSeason: 2026,
      season: 2026,
    }),
    'final',
  )
})

test('first and second college years are green; third and fourth years with eligibility remaining are amber', () => {
  for (const enrollmentSeason of [2026, 2025]) {
    assert.equal(
      rosterEligibilityBand({
        enrollmentSeason,
        eligibleThroughSeason: 2029,
        season: 2026,
      }),
      'underclassman',
    )
  }
  for (const enrollmentSeason of [2024, 2023]) {
    assert.equal(
      rosterEligibilityBand({
        enrollmentSeason,
        eligibleThroughSeason: 2027,
        season: 2026,
      }),
      'nfl_window',
    )
  }
})

test('incoming recruits are blue without fabricated enrollment, participation or eligibility', () => {
  assert.equal(
    rosterEligibilityBand({
      incoming: true,
      enrollmentSeason: null,
      eligibleThroughSeason: null,
      season: 2026,
    }),
    'incoming',
  )
  assert.equal(collegeYear(2027, 2026), null)
})

test('unknown eligibility or enrollment remains neutral rather than inventing a year band', () => {
  assert.equal(collegeYear(null, 2026), null)
  assert.equal(
    rosterEligibilityBand({
      enrollmentSeason: 2024,
      eligibleThroughSeason: null,
      season: 2026,
    }),
    'unknown',
  )
  assert.equal(
    rosterEligibilityBand({
      enrollmentSeason: null,
      eligibleThroughSeason: 2028,
      season: 2026,
    }),
    'unknown',
  )
  assert.equal(
    rosterEligibilityBand({
      enrollmentSeason: null,
      eligibleThroughSeason: 2026,
      season: 2026,
    }),
    'final',
  )
})
