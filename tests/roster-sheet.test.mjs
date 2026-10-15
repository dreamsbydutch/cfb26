import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collegeYear,
  rosterEligibilityBand,
} from '../src/features/michigan/rosterSheetModel.ts'

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
