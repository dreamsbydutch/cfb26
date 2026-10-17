import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import {
  assertSnapshotCanReplace,
  normalizeParticipationName,
  validateParticipationImport,
} from '../convex/participationModel.ts'

const screenshot = JSON.parse(
  readFileSync(
    new URL(
      '../scripts/imports/michigan-2026-offense-through-5.json',
      import.meta.url,
    ),
    'utf8',
  ),
)

test('defense screenshot balances 36 players through six games and rejects invalid breakdowns', () => {
  const defense = JSON.parse(
    readFileSync(
      new URL(
        '../scripts/imports/michigan-2026-defense-through-6.json',
        import.meta.url,
      ),
      'utf8',
    ),
  )
  validateParticipationImport(defense)
  assert.equal(defense.rows.length, 36)
  assert.equal(
    defense.rows.reduce((sum, row) => sum + row.snaps, 0),
    4026,
  )
  assert.equal(defense.throughTeamGames, 6)
  assert.throws(
    () => validateParticipationImport({ ...defense, phase: 'offense' }),
    /requires defense/,
  )
  defense.rows[0].defenseBreakdown.coverage = 1
  assert.throws(() => validateParticipationImport(defense), /sum/)
})

test('the 2026 screenshot contains 34 players with balanced offensive snap counts', () => {
  validateParticipationImport(screenshot)
  assert.equal(screenshot.rows.length, 34)
  assert.equal(
    screenshot.rows.reduce((sum, row) => sum + row.snaps, 0),
    3408,
  )
  assert.equal(
    screenshot.rows.find((row) => row.name === 'Bryce Underwood').snaps,
    299,
  )
  assert.equal(
    screenshot.rows.find((row) => row.name === 'Marky Walbridge').gamesPlayed,
    2,
  )
})

test('invalid screenshot counts fail before any import', () => {
  for (const change of [
    (row) => {
      row.snaps += 1
    },
    (row) => {
      row.gamesPlayed = 6
    },
    (row) => {
      row.gamesPlayed = 0
    },
    (row) => {
      row.snaps = -1
    },
    (row) => {
      row.gamesPlayed = 0.5
    },
    (row) => {
      row.offenseBreakdown.pass = Number.NaN
    },
  ]) {
    const input = structuredClone(screenshot)
    change(input.rows[0])
    assert.throws(() => validateParticipationImport(input))
  }
})

test('duplicate rows and wrong-phase breakdowns are rejected', () => {
  assert.throws(
    () =>
      validateParticipationImport({
        ...screenshot,
        rows: [screenshot.rows[0], screenshot.rows[0]],
      }),
    /duplicate/,
  )
  assert.throws(
    () => validateParticipationImport({ ...screenshot, phase: 'defense' }),
    /requires offense/,
  )
  assert.throws(
    () => validateParticipationImport({ ...screenshot, throughTeamGames: 0 }),
    /cutoff/,
  )
  assert.throws(
    () => validateParticipationImport({ ...screenshot, sourceImageSha256: '' }),
    /SHA-256/,
  )
})

test('defense and special teams can retain known totals without invented breakdowns', () => {
  for (const phase of ['defense', 'specialTeams']) {
    validateParticipationImport({
      ...screenshot,
      phase,
      rows: [
        { name: 'Example Player', jerseyNumber: 1, gamesPlayed: 2, snaps: 17 },
      ],
    })
  }
})

test('cumulative replacement accepts repeats and growth but refuses older or lower totals', () => {
  const current = { snaps: 100, gamesPlayed: 3, throughTeamGames: 5 }
  assertSnapshotCanReplace(current, current)
  assertSnapshotCanReplace(
    { snaps: 125, gamesPlayed: 4, throughTeamGames: 6 },
    current,
  )
  assert.throws(
    () =>
      assertSnapshotCanReplace({ ...current, throughTeamGames: 4 }, current),
    /older/,
  )
  assert.throws(
    () => assertSnapshotCanReplace({ ...current, snaps: 99 }, current),
    /decrease/,
  )
  assert.throws(
    () => assertSnapshotCanReplace({ ...current, gamesPlayed: 2 }, current),
    /decrease/,
  )
})

test('name normalization tolerates punctuation and suffixes without fuzzy identity guesses', () => {
  assert.equal(
    normalizeParticipationName('Jaime Ffrench Jr.'),
    normalizeParticipationName('Jaime Ffrench'),
  )
  assert.equal(
    normalizeParticipationName("Houston Ka'aha'aina-Torres"),
    normalizeParticipationName('Houston Ka’aha’aina-Torres'),
  )
  assert.notEqual(
    normalizeParticipationName("Tomas O'Maera"),
    normalizeParticipationName("Tomas O'Meara"),
  )
})
