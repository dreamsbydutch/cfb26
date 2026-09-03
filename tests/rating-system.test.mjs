import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildPowerRatingEdition,
  buildResumeRatingEdition,
  projectPowerMatchup,
} from '../convex/ratingSystem.ts'

const cutoffAt = Date.UTC(2025, 9, 1)

function game(id, homeTeamId, awayTeamId, homePoints, awayPoints, extras = {}) {
  return {
    awayPoints,
    awayTeamId,
    completed: true,
    homePoints,
    homeTeamId,
    id,
    kickoffAt: cutoffAt - 86_400_000,
    neutralSite: false,
    overtimePeriods: 0,
    season: 2025,
    week: 5,
    ...extras,
  }
}

const teams = [
  { classification: 'fbs', id: 'alpha', name: 'Alpha' },
  { classification: 'fbs', id: 'beta', name: 'Beta' },
  { classification: 'fbs', id: 'gamma', name: 'Gamma' },
  { classification: 'fcs', id: 'delta', name: 'Delta' },
]

test('Power Rating measures neutral strength in points and keeps FCS opponents hidden', () => {
  const edition = buildPowerRatingEdition({
    cutoffAt,
    games: [
      game('1', 'alpha', 'beta', 31, 20),
      game('2', 'beta', 'alpha', 17, 30),
      game('3', 'alpha', 'gamma', 28, 14),
      game('4', 'gamma', 'beta', 24, 21),
      game('5', 'delta', 'alpha', 10, 35),
    ],
    season: 2025,
    teams,
    week: 6,
  })

  const alpha = edition.ratings.find((rating) => rating.teamId === 'alpha')
  const beta = edition.ratings.find((rating) => rating.teamId === 'beta')
  const delta = edition.ratings.find((rating) => rating.teamId === 'delta')

  assert.equal(edition.modelVersion, 'cfb26-power-v1')
  assert.ok(alpha.power > beta.power)
  assert.equal(alpha.rank, 1)
  assert.equal(delta.published, false)
  assert.equal(delta.rank, undefined)
  assert.ok(Math.abs(alpha.power) < 30)
  assert.ok(alpha.homeFieldAdvantage >= 0)

  const neutral = projectPowerMatchup(edition, 'alpha', 'beta', 'neutral')
  const atAlpha = projectPowerMatchup(edition, 'alpha', 'beta', 'team_a')
  assert.ok(neutral.projectedMargin > 0)
  assert.ok(atAlpha.projectedMargin > neutral.projectedMargin)
  assert.ok(neutral.teamAWinProbability > 0.5)
})

test('Power Rating fades priors and gives current-season games equal weight', () => {
  const priorTeams = teams.slice(0, 2).map((team, index) => ({
    ...team,
    prior: {
      effectiveGames: 8,
      power: index === 0 ? 10 : 0,
      sources: ['multi_season_performance', 'talent'],
    },
  }))
  const preseason = buildPowerRatingEdition({
    cutoffAt,
    games: [],
    season: 2025,
    teams: priorTeams,
    week: 0,
  })
  const results = Array.from({ length: 8 }, (_, index) =>
    game(
      String(index),
      index % 2 === 0 ? 'alpha' : 'beta',
      index % 2 === 0 ? 'beta' : 'alpha',
      24,
      24,
      { week: index + 1 },
    ),
  )
  const inSeason = buildPowerRatingEdition({
    cutoffAt,
    games: results,
    season: 2025,
    teams: priorTeams,
    week: 9,
  })
  const reversed = buildPowerRatingEdition({
    cutoffAt,
    games: [...results].reverse(),
    season: 2025,
    teams: priorTeams,
    week: 9,
  })
  const preseasonGap = preseason.ratings[0].power - preseason.ratings[1].power
  const inSeasonGap =
    inSeason.ratings.find((row) => row.teamId === 'alpha').power -
    inSeason.ratings.find((row) => row.teamId === 'beta').power

  assert.ok(Math.abs(inSeasonGap) < Math.abs(preseasonGap))
  assert.equal(
    inSeason.ratings.find((row) => row.teamId === 'alpha').priorWeight,
    0.5,
  )
  assert.deepEqual(inSeason.ratings, reversed.ratings)
})

test('Power Rating caps overtime and blowout margins and shrinks special teams', () => {
  const twoTeams = teams.slice(0, 2)
  const overtimeA = buildPowerRatingEdition({
    cutoffAt,
    games: [game('ot-a', 'alpha', 'beta', 60, 58, { overtimePeriods: 4 })],
    season: 2025,
    teams: twoTeams,
    week: 2,
  })
  const overtimeB = buildPowerRatingEdition({
    cutoffAt,
    games: [game('ot-b', 'alpha', 'beta', 28, 21, { overtimePeriods: 1 })],
    season: 2025,
    teams: twoTeams,
    week: 2,
  })
  const blowout = buildPowerRatingEdition({
    cutoffAt,
    games: [
      game('big', 'alpha', 'beta', 84, 0, {
        homeSpecialTeamsValue: 14,
      }),
    ],
    season: 2025,
    teams: twoTeams,
    week: 2,
  })

  const overtimeGap = (edition) =>
    edition.ratings.find((row) => row.teamId === 'alpha').power -
    edition.ratings.find((row) => row.teamId === 'beta').power
  const alpha = blowout.ratings.find((row) => row.teamId === 'alpha')
  assert.ok(
    Math.abs(overtimeGap(overtimeA)) <= Math.abs(overtimeGap(overtimeB)),
  )
  assert.ok(overtimeGap(blowout) < 35)
  assert.ok(alpha.specialTeams > 0)
  assert.ok(alpha.specialTeams < 2)
})

test('Power Rating learns team-specific home field without adding it to neutral rank', () => {
  const edition = buildPowerRatingEdition({
    cutoffAt,
    games: [
      game('neutral-1', 'alpha', 'beta', 24, 24, { neutralSite: true }),
      game('neutral-2', 'beta', 'alpha', 24, 24, { neutralSite: true }),
      game('alpha-home', 'alpha', 'beta', 31, 17),
      game('beta-home', 'beta', 'alpha', 24, 24),
    ],
    season: 2025,
    teams: teams.slice(0, 2),
    week: 5,
  })
  const alpha = edition.ratings.find((row) => row.teamId === 'alpha')
  const beta = edition.ratings.find((row) => row.teamId === 'beta')
  const neutral = projectPowerMatchup(edition, 'alpha', 'beta', 'neutral')
  const atAlpha = projectPowerMatchup(edition, 'alpha', 'beta', 'team_a')

  assert.ok(alpha.homeFieldAdvantage > beta.homeFieldAdvantage)
  assert.equal(
    atAlpha.projectedMargin,
    Math.round((neutral.projectedMargin + alpha.homeFieldAdvantage) * 10) / 10,
  )
})

test('Résumé Rating starts in Week 7 and rewards the harder achieved record', () => {
  const powerEdition = {
    cutoffAt,
    leagueAveragePoints: 28,
    modelVersion: 'cfb26-power-v1',
    ratings: [
      { teamId: 'hard', name: 'Hard', power: 0, rank: 3 },
      { teamId: 'easy', name: 'Easy', power: 0, rank: 4 },
      { teamId: 'strong', name: 'Strong', power: 12, rank: 1 },
      { teamId: 'weak', name: 'Weak', power: -12, rank: 4 },
    ].map((rating) => ({
      classification: 'fbs',
      dataSources: ['games'],
      defense: rating.power / 2,
      gamesPlayed: 5,
      homeFieldAdvantage: 2.5,
      limitedSample: false,
      offense: rating.power / 2,
      priorWeight: 0,
      published: true,
      specialTeams: 0,
      specialTeamsAvailable: false,
      ...rating,
    })),
    season: 2025,
    week: 7,
  }
  const resumeGames = [
    game('hard-win', 'strong', 'hard', 20, 24),
    game('easy-win', 'easy', 'weak', 24, 20),
  ]
  const provisional = buildResumeRatingEdition({
    games: resumeGames,
    powerEdition,
    week: 6,
  })
  const published = buildResumeRatingEdition({
    games: resumeGames,
    powerEdition,
    week: 7,
  })

  assert.equal(provisional.visible, false)
  assert.equal(published.visible, true)
  assert.ok(
    published.ratings.find((row) => row.teamId === 'hard').resume >
      published.ratings.find((row) => row.teamId === 'easy').resume,
  )
  assert.equal(
    published.ratings.find((row) => row.teamId === 'hard').limitedSample,
    true,
  )
  assert.ok(
    published.ratings
      .find((row) => row.teamId === 'hard')
      .disagreementReasons.includes('schedule_strength'),
  )
})

test('Résumé Rating counts an overtime win fully and caps its dominance', () => {
  const powerEdition = buildPowerRatingEdition({
    cutoffAt,
    games: [],
    season: 2025,
    teams: teams.slice(0, 2),
    week: 7,
  })
  const resumeForMargin = (margin) =>
    buildResumeRatingEdition({
      games: [
        game('ot', 'alpha', 'beta', 30 + margin, 30, {
          overtimePeriods: 2,
        }),
      ],
      powerEdition,
      week: 7,
    }).ratings.find((row) => row.teamId === 'alpha')

  const sevenPoint = resumeForMargin(7)
  const twentyPoint = resumeForMargin(20)
  assert.equal(sevenPoint.actualWins, 1)
  assert.equal(twentyPoint.actualWins, 1)
  assert.equal(twentyPoint.dominanceComponent, sevenPoint.dominanceComponent)
  assert.equal(twentyPoint.resume, sevenPoint.resume)
})
