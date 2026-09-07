import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyPlayerGrade,
  deriveEligibility,
  normalizePlayerGame,
  summarizePhaseGrades,
} from '../convex/playerDomain.ts'

test('player-game validation preserves zero, unknown, and ungraded states', () => {
  assert.deepEqual(normalizePlayerGame({ snaps: null, grade: 84.26 }), {
    snaps: null,
    grade: 84.3,
  })
  assert.deepEqual(normalizePlayerGame({ snaps: 0, grade: null }), {
    snaps: 0,
    grade: null,
  })
  assert.throws(
    () => normalizePlayerGame({ snaps: 0, grade: 72 }),
    /zero snaps/i,
  )
  assert.throws(
    () => normalizePlayerGame({ snaps: 12.5, grade: 72 }),
    /whole number/i,
  )
})

test('phase summaries weight only grades with known positive snaps', () => {
  assert.deepEqual(
    summarizePhaseGrades([
      { snaps: 20, grade: 80 },
      { snaps: 10, grade: 50 },
      { snaps: null, grade: 99 },
      { snaps: 0, grade: null },
      { snaps: 15, grade: null },
    ]),
    {
      gradedSnaps: 30,
      knownSnaps: 45,
      ungradedKnownSnaps: 15,
      unknownSnapGrades: [99],
      weightedGrade: 70,
    },
  )
})

test('CFB26 grade bands use the approved thresholds', () => {
  assert.equal(classifyPlayerGrade(null), 'Ungraded')
  assert.equal(classifyPlayerGrade(90), 'Elite')
  assert.equal(classifyPlayerGrade(80), 'High quality')
  assert.equal(classifyPlayerGrade(70), 'Above average')
  assert.equal(classifyPlayerGrade(60), 'Slightly above average')
  assert.equal(classifyPlayerGrade(50), 'Below average')
  assert.equal(classifyPlayerGrade(49.9), 'Poor')
})

test('eligibility honors an owner override without erasing derived evidence', () => {
  const result = deriveEligibility({
    evidence: {
      ageBasedExceptionSeasons: 0,
      competitionSeasons: [2023, 2024],
      enrollmentSeason: 2023,
      legacyRedshirtSeason: 2023,
      medicalHardshipSeasons: 1,
      otherExtensionSeasons: 0,
    },
    override: 2029,
    rule: {
      baseEligibilitySeasons: 4,
      clockSeasons: 5,
      legacyRedshirtExtendsClock: true,
      season: 2026,
    },
  })

  assert.equal(result.derivedEligibleThroughSeason, 2028)
  assert.equal(result.eligibleThroughSeason, 2029)
  assert.equal(result.source, 'override')
  assert.deepEqual(result.warnings, [
    'Owner override differs from the season-rule derivation.',
  ])
})
