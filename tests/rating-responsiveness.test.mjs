import assert from 'node:assert/strict'
import test from 'node:test'
import {
  historicalPowerPrior,
  POWER_CARRYOVER,
  rememberPowerSeason,
} from '../convex/powerHistory.ts'
import {
  fitHistoricalPower,
  POWER_POLICIES,
  PUBLISHED_POWER_POLICY,
} from '../convex/powerResearch.ts'
import {
  buildPowerRatingEdition,
  buildResumeRatingEdition,
  POWER_FIT_POLICY,
} from '../convex/ratingSystem.ts'

const season = 2026
const cutoffAt = Date.UTC(season, 8, 12)
const teams = Array.from({ length: 138 }, (_, i) => ({
  id: String(i),
  name: `Team ${i}`,
  classification: 'fbs',
}))
const history = new Map(
  teams.map((team, i) => [
    team.id,
    {
      season: 2025,
      rating: {
        ...team,
        teamId: team.id,
        power: i === 0 ? -18 : i === 1 ? 18 : 0,
        offense: i === 0 ? -9 : i === 1 ? 9 : 0,
        defense: i === 0 ? -9 : i === 1 ? 9 : 0,
        gamesPlayed: 12,
        specialTeams: 0,
      },
    },
  ]),
)

function fit(priorGames, seasonRetention, games = [], fitPolicy = {}) {
  return buildPowerRatingEdition({
    ...fitPolicy,
    season,
    cutoffAt,
    week: 2,
    games,
    teams: teams.map((team) => ({
      ...team,
      prior: historicalPowerPrior(team, season, history, {
        priorGames,
        seasonRetention,
      }),
    })),
  })
}

test('lighter carryover responds faster to improvement and decline across the full field', () => {
  const games = [
    {
      id: 'up',
      homeTeamId: '0',
      awayTeamId: '2',
      homePoints: 37,
      awayPoints: 21,
    },
    {
      id: 'down',
      homeTeamId: '1',
      awayTeamId: '3',
      homePoints: 21,
      awayPoints: 37,
    },
  ].map((game) => ({
    ...game,
    season,
    week: 1,
    kickoffAt: cutoffAt - 86400000,
    completed: true,
    neutralSite: true,
    overtimePeriods: 0,
  }))
  const before = fit(
    POWER_CARRYOVER.priorGames,
    POWER_CARRYOVER.seasonRetention,
    [],
    POWER_FIT_POLICY,
  )
  const after = fit(
    POWER_CARRYOVER.priorGames,
    POWER_CARRYOVER.seasonRetention,
    games,
    POWER_FIT_POLICY,
  )
  const oldBefore = fit(8, 1)
  const oldAfter = fit(8, 1, games)
  for (const [id, direction] of [
    ['0', 1],
    ['1', -1],
  ]) {
    const value = (edition) =>
      edition.ratings.find((r) => r.teamId === id).power
    assert.ok(
      direction * (value(after) - value(before)) >
        direction * (value(oldAfter) - value(oldBefore)),
    )
  }
  assert.equal(after.ratings.filter((r) => r.published).length, 138)
  assert.deepEqual(
    after.ratings.map((r) => r.rank).sort((a, b) => a - b),
    Array.from({ length: 138 }, (_, i) => i + 1),
  )
  assert.equal(history.get('0').rating.power, -18)
  const merit = (e) =>
    buildResumeRatingEdition({ games, powerEdition: e, week: 7 })
      .ratings.map((r) => [r.teamId, r.resume, r.resumeRank, r.expectedWins])
      .sort((a, b) => a[0].localeCompare(b[0]))
  assert.deepEqual(merit(oldAfter), merit(after))
})

test('published and research policies reconstruct identical year-to-year ratings', () => {
  const field = teams.slice(0, 4)
  const games = [2025, 2026].flatMap((year) =>
    field.slice(0, 2).map((team, i) => ({
      id: `${year}-${i}`,
      homeTeamId: team.id,
      awayTeamId: field[i + 2].id,
      homePoints: year === 2025 ? 7 : 37,
      awayPoints: 21,
      season: year,
      week: 1,
      kickoffAt: Date.UTC(year, 8, 1),
      completed: true,
      neutralSite: true,
      overtimePeriods: 0,
    })),
  )
  const replay = fitHistoricalPower({
    teams: field,
    games,
    season,
    week: 2,
    cutoffAt,
    policy: PUBLISHED_POWER_POLICY,
  })
  const retained = new Map()
  let published
  for (let year = 2022; year <= season; year++) {
    published = buildPowerRatingEdition({
      ...POWER_FIT_POLICY,
      teams: field.map((team) => ({
        ...team,
        prior: historicalPowerPrior(team, year, retained, POWER_CARRYOVER),
      })),
      games: games.filter((g) => g.season === year),
      season: year,
      week: year === season ? 2 : 30,
      cutoffAt: year === season ? cutoffAt : Date.UTC(year + 1, 2, 1),
    })
    rememberPowerSeason(retained, year, published.ratings)
  }
  assert.deepEqual(replay, published)
})

test('offseason regression preserves subdivision scale and rejects invalid policies', () => {
  const fcs = new Map([
    [
      'x',
      {
        season: 2025,
        rating: {
          ...history.get('0').rating,
          classification: 'fcs',
          power: -24,
        },
      },
    ],
  ])
  const prior = historicalPowerPrior(
    { id: 'x', classification: 'fbs' },
    season,
    fcs,
    { priorGames: 4, seasonRetention: 0.9 },
  )
  assert.equal(prior.power, -24)
  assert.equal(prior.effectiveGames, 2)
  for (const [games, retention] of [
    [NaN, 1],
    [-1, 1],
    [4, Infinity],
    [4, -0.1],
    [4, 1.1],
  ])
    assert.throws(() =>
      historicalPowerPrior(teams[0], season, history, {
        priorGames: games,
        seasonRetention: retention,
      }),
    )
})

test('full-result fitting responds to surprise while preserving score caps', () => {
  const input = {
    teams: teams.map((team) => ({
      ...team,
      prior: historicalPowerPrior(team, season, history, {
        priorGames: 4,
        seasonRetention: 0.9,
      }),
    })),
    season,
    week: 2,
    cutoffAt,
    games: [
      {
        id: 'surprise',
        homeTeamId: '0',
        awayTeamId: '2',
        homePoints: 56,
        awayPoints: 0,
        season,
        week: 1,
        kickoffAt: cutoffAt - 86400000,
        completed: true,
        neutralSite: true,
        overtimePeriods: 0,
      },
    ],
  }
  const old = buildPowerRatingEdition(input)
  const full = buildPowerRatingEdition({ ...input, fullWeightResults: true })
  const value = (e) => e.ratings.find((r) => r.teamId === '0').power
  assert.ok(value(full) > value(old))
  assert.equal(
    value(full),
    value(
      buildPowerRatingEdition({
        ...input,
        fullWeightResults: true,
        games: input.games.map((g) => ({ ...g, homePoints: 100 })),
      }),
    ),
  )
  const unchanged = buildPowerRatingEdition(input)
  assert.deepEqual(old, unchanged)
})

test('subdivision-adjusted research applies carryover settings and cannot reuse another policy cache', () => {
  const policy = POWER_POLICIES.find((p) => p.version === 'cfb26-power-v2')
  const game = {
    id: 'past',
    homeTeamId: '0',
    awayTeamId: '1',
    homePoints: 7,
    awayPoints: 35,
    season: 2025,
    week: 1,
    kickoffAt: Date.UTC(2025, 8, 1),
    completed: true,
    neutralSite: true,
    overtimePeriods: 0,
  }
  const input = {
    teams: teams.slice(0, 2),
    games: [game],
    season,
    week: 1,
    cutoffAt,
    policy,
  }
  const original = fitHistoricalPower(input)
  const alternative = { ...policy, priorGames: 4, seasonRetention: 0.9 }
  const cache = new Map()
  fitHistoricalPower(input, cache)
  const changed = fitHistoricalPower({ ...input, policy: alternative }, cache)
  assert.deepEqual(
    changed,
    fitHistoricalPower({ ...input, policy: alternative }),
  )
  assert.notDeepEqual(original.ratings, changed.ratings)
})
