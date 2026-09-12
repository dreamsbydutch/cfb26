import assert from 'node:assert/strict'
import test from 'node:test'
import { buildPowerRatingEdition } from '../convex/ratingSystem.ts'
import {
  historicalPowerPrior,
  rememberPowerSeason,
} from '../convex/powerHistory.ts'
import { fitHistoricalPower, POWER_POLICIES } from '../convex/powerResearch.ts'

const cutoffAt = Date.UTC(2026, 8, 12)
const teams = Array.from({ length: 12 }, (_, i) => [
  { id: `fbs${i}`, name: `FBS ${i}`, classification: 'fbs' },
  { id: `fcs${i}`, name: `FCS ${i}`, classification: 'fcs' },
]).flat()
const games = Array.from({ length: 12 }, (_, i) => ({
  id: String(i),
  season: 2026,
  week: 1,
  completed: true,
  kickoffAt: cutoffAt - 86400000,
  neutralSite: true,
  overtimePeriods: 0,
  homeTeamId: `fbs${i}`,
  awayTeamId: `fcs${i}`,
  homePoints: 35,
  awayPoints: 7,
}))

test('the history pipeline cannot turn absent FCS evidence into an average-FBS prior', () => {
  const history = new Map()
  const seeded = teams.map((team) => ({
    ...team,
    prior: historicalPowerPrior(team, 2026, history),
  }))
  const edition = buildPowerRatingEdition({
    teams: seeded,
    games,
    season: 2026,
    week: 2,
    cutoffAt,
  })
  assert.ok(
    edition.ratings.filter((r) => !r.published).every((r) => r.power < -20),
  )
})

test('sparse FCS opponents shrink to observed subdivision strength, not average FBS', () => {
  const edition = buildPowerRatingEdition({
    teams,
    games,
    season: 2026,
    week: 2,
    cutoffAt,
  })
  assert.ok(
    edition.ratings.filter((r) => !r.published).every((r) => r.power < -20),
  )
  assert.ok(
    edition.ratings
      .filter((r) => r.published)
      .every((r) => Math.abs(r.power) < 1),
  )
})

test('an unobserved FCS opponent inherits the subdivision estimate', () => {
  const edition = buildPowerRatingEdition({
    teams: [...teams, { id: 'unseen', name: 'Unseen', classification: 'fcs' }],
    games,
    season: 2026,
    week: 2,
    cutoffAt,
  })
  assert.ok(edition.ratings.find((r) => r.teamId === 'unseen').power < -20)
})

test('a missing imported season preserves and ages transition history', () => {
  const edition = buildPowerRatingEdition({
    teams,
    games,
    season: 2026,
    week: 2,
    cutoffAt,
  })
  const history = new Map()
  rememberPowerSeason(history, 2024, edition.ratings)
  rememberPowerSeason(history, 2025, [])
  const prior = historicalPowerPrior(
    { id: 'fcs0', classification: 'fbs' },
    2026,
    history,
  )
  assert.ok(prior.power < -20)
  assert.equal(prior.effectiveGames, 2)
  assert.ok(prior.sources.includes('historical_coverage_gap'))
  assert.ok(prior.sources.includes('subdivision_transition'))
  const unknown = historicalPowerPrior(
    { id: 'new', classification: 'fbs' },
    2026,
    history,
  )
  assert.equal(unknown.power, 0)
  assert.equal(unknown.effectiveGames, 8)
})

test('transition strength follows evidence without a team-name or rank ceiling', () => {
  const rating = buildPowerRatingEdition({
    teams,
    games,
    season: 2026,
    week: 2,
    cutoffAt,
  }).ratings.find((r) => r.teamId === 'fcs0')
  const history = new Map([
    [
      'fcs0',
      {
        season: 2025,
        rating: {
          ...rating,
          power: 15,
          offense: 8,
          defense: 7,
          gamesPlayed: 12,
        },
      },
    ],
  ])
  assert.equal(
    historicalPowerPrior({ id: 'fcs0', classification: 'fbs' }, 2026, history)
      .power,
    15,
  )
  const future = new Map([['fcs0', { season: 2027, rating }]])
  assert.equal(
    historicalPowerPrior({ id: 'fcs0', classification: 'fbs' }, 2026, future)
      .power,
    0,
  )
})

test('historical replay retains a transition through an absent season and cached fits', () => {
  const historicalGames = games.map((g) => ({
    ...g,
    season: 2024,
    kickoffAt: Date.UTC(2024, 8, 1),
    homeClassification: 'fbs',
    awayClassification: 'fcs',
  }))
  const transitionGame = {
    ...games[0],
    homeTeamId: 'fcs0',
    awayTeamId: 'fbs0',
    homeClassification: 'fbs',
    awayClassification: 'fbs',
    homePoints: 33,
    awayPoints: 7,
  }
  const input = {
    teams,
    games: [...historicalGames, transitionGame],
    season: 2026,
    cutoffAt,
    week: 2,
    policy: POWER_POLICIES.find((p) => p.version === 'cfb26-power-v2'),
  }
  const cache = new Map()
  const first = fitHistoricalPower(input, cache)
  const second = fitHistoricalPower(input, cache)
  assert.deepEqual(first, second)
  const newcomer = first.ratings.find((r) => r.teamId === 'fcs0')
  assert.ok(newcomer.dataSources.includes('historical_coverage_gap'))
  assert.ok(newcomer.dataSources.includes('subdivision_transition'))
  assert.ok(newcomer.priorWeight > 0.5 && newcomer.priorWeight < 0.8)
})
