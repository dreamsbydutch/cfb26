import assert from 'node:assert/strict'
import test from 'node:test'
import {
  planMichiganMigration,
  prepareMichiganMigration,
} from '../convex/migrationV2.ts'

test('migration plans Player Seasons and drops PFF-derived records', () => {
  const plan = planMichiganMigration({
    draftOutcomes: [
      {
        legacyKey: 'p1',
        overallPick: 10,
        playerId: 'player-1',
        round: 1,
        status: 'drafted',
        team: 'DET',
        year: 2027,
      },
    ],
    players: [
      {
        displayName: 'Test Player',
        highSchool: 'Example High',
        homeState: 'MI',
        hometown: 'Ann Arbor',
        legacyKey: 'p1',
        slug: 'test-player',
        sourceUpdatedAt: 1,
      },
    ],
    rosterStints: [
      {
        eligibilityEndSeason: 2027,
        eligibilityLeaveSeason: 2025,
        eligibilityStartSeason: 2023,
        endSeason: 2024,
        legacyKey: 'p1',
        playerId: 'player-1',
        position: 'CB',
        programId: 'michigan',
        startSeason: 2023,
        status: 'departed',
      },
    ],
    seasonalPlayerStats: [{ playerId: 'player-1', season: 2023 }],
  })

  assert.equal(plan.people.length, 1)
  assert.deepEqual(
    plan.playerSeasons.map(({ listedPosition, season }) => ({
      listedPosition,
      season,
    })),
    [
      { listedPosition: 'CB', season: 2023 },
      { listedPosition: 'CB', season: 2024 },
    ],
  )
  assert.equal(plan.draftOutcomes.length, 1)
  assert.equal(plan.audit.deletedPffRows, 1)
  assert.deepEqual(plan.unresolved, [])
})

test('migration never guesses an orphan provider identity', () => {
  const plan = planMichiganMigration({
    draftOutcomes: [],
    players: [],
    rosterStints: [],
    seasonalPlayerStats: [{ playerId: null, season: 2020 }],
  })

  assert.equal(plan.audit.deletedPffRows, 1)
  assert.equal(plan.unresolved.length, 1)
  assert.equal(plan.unresolved[0].reason, 'missing_canonical_person')
})

test('migration preparation emits target lifecycle records and no PFF dataset', () => {
  const result = prepareMichiganMigration(
    {
      draftOutcomes: [],
      movementEvents: [],
      players: [
        {
          _id: 'player-1',
          displayName: 'Test Player',
          highSchool: '',
          homeState: '',
          hometown: '',
          legacyKey: 'p1',
          slug: 'test-player',
          sourceUpdatedAt: 1,
        },
      ],
      recruitingProfiles: [
        {
          compositeRating: 0.95,
          legacyKey: 'p1',
          playerId: 'player-1',
          recruitingSeason: 2023,
          source: 'high_school',
        },
      ],
      rosterStints: [
        {
          _id: 'stint-1',
          eligibilityEndSeason: 2027,
          eligibilityLeaveSeason: 2025,
          eligibilityStartSeason: 2023,
          legacyKey: 'p1',
          playerId: 'player-1',
          position: 'CB',
          programId: 'michigan',
          startSeason: 2023,
          status: 'active',
        },
      ],
      seasonalPlayerStats: [{ playerId: 'player-1', season: 2023 }],
    },
    2024,
  )

  assert.equal(result.datasets.players[0].entryMethod, 'high_school')
  assert.deepEqual(
    result.datasets.playerSeasons.map((row) => row.season),
    [2023, 2024],
  )
  assert.equal(result.datasets.evaluations.length, 1)
  assert.equal('seasonalPlayerStats' in result.datasets, false)
  assert.equal(result.audit.deletedPffRows, 1)
})
