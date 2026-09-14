import test from 'node:test'
import assert from 'node:assert/strict'
import {
  accomplishmentsFromGames,
  programAccomplishmentCredit,
} from '../convex/programAccomplishments.ts'
import { historicalNationalTitles } from '../convex/programHonorsHistory.ts'
import { buildProgramRatings } from '../convex/programRating.ts'

const game = {
  homeTeamId: 'a',
  awayTeamId: 'b',
  homeClassification: 'fbs',
  awayClassification: 'fbs',
  homePoints: 24,
  awayPoints: 21,
  completed: true,
  kickoffAt: Date.UTC(2025, 11, 1),
  season: 2025,
}
const cutoff = Date.UTC(2026, 8, 1)
const honor = (playoffStage, season = 2025, conferenceChampion = false) => ({
  teamId: 'a',
  season,
  playoffStage,
  conferenceChampion,
})

test('conference winners earn titles; ordinary bowls, FCS trophies and future results do not', () => {
  assert.deepEqual(
    accomplishmentsFromGames(
      [{ ...game, notes: 'Dr Pepper Big 12 Championship' }],
      cutoff,
    ),
    [honor(0, 2025, true)],
  )
  for (const notes of [
    'Rose Bowl Game',
    'FCS Championship - Semifinals',
    'Celebration Bowl',
  ])
    assert.deepEqual(accomplishmentsFromGames([{ ...game, notes }], cutoff), [])
  assert.deepEqual(
    accomplishmentsFromGames(
      [{ ...game, homeClassification: 'fcs', notes: 'SEC Championship' }],
      cutoff,
    ),
    [],
  )
  assert.deepEqual(
    accomplishmentsFromGames(
      [{ ...game, notes: 'SEC Championship' }],
      game.kickoffAt + 6 * 3600000,
    ),
    [],
  )
  assert.deepEqual(
    accomplishmentsFromGames(
      [{ ...game, completed: false, notes: 'SEC Championship' }],
      cutoff,
    ),
    [],
  )
})

test('each playoff round credits both participants and advances the winner immediately', () => {
  for (const [name, stage] of [
    ['First Round', 1],
    ['Quarterfinal', 2],
    ['Semifinal', 3],
    ['National Championship', 4],
  ]) {
    const rows = accomplishmentsFromGames(
      [{ ...game, notes: `College Football Playoff ${name}` }],
      cutoff,
    )
    assert.equal(rows.find((row) => row.teamId === 'a').playoffStage, stage + 1)
    assert.equal(rows.find((row) => row.teamId === 'b').playoffStage, stage)
  }
  const semifinal = accomplishmentsFromGames(
    [
      {
        ...game,
        season: 2018,
        notes: 'College Football Playoff Semifinal at the Orange Bowl',
      },
    ],
    cutoff,
  )
  assert.equal(semifinal[0].playoffStage, 4)
})

test('deeper runs matter more, a title dominates, duplicate stages never inflate prestige', () => {
  const values = [0, 1, 2, 3, 4, 5].map(
    (stage) => programAccomplishmentCredit([honor(stage)], 2026).total,
  )
  for (let i = 1; i < values.length; i++) assert.ok(values[i] > values[i - 1])
  assert.ok(values[5] - values[4] > values[2] - values[1])
  const title = programAccomplishmentCredit([honor(5, 2025, true)], 2026)
  assert.deepEqual(
    title,
    programAccomplishmentCredit(
      [
        honor(0, 2025, true),
        honor(1),
        honor(2),
        honor(3),
        honor(4),
        honor(5),
        honor(5),
      ],
      2026,
    ),
  )
})

test('recent accomplishments count more while modern legacy survives the results decade', () => {
  const recent = programAccomplishmentCredit([honor(5)], 2026)
  const old = programAccomplishmentCredit([honor(5, 2000)], 2026)
  assert.ok(recent.total > old.total)
  assert.ok(old.legacyCredit > 0 && old.legacyCredit > old.recentCredit)
  assert.equal(
    programAccomplishmentCredit([honor(5, 1999), honor(5, 2027)], 2026).total,
    0,
  )
  const dynasty = programAccomplishmentCredit(
    Array.from({ length: 27 }, (_, i) => honor(5, 2000 + i, true)),
    2026,
  )
  assert.ok(dynasty.total < 30)
})

test('Program ranks equal-strength programs by earned honors without changing results', () => {
  const teams = Array.from({ length: 138 }, (_, i) => ({
    teamId: String(i),
    published: true,
  }))
  const evidence = teams.map(({ teamId }) => ({
    teamId,
    season: 2025,
    games: 12,
    performance: 75,
    acquisition: 70,
    development: 65,
  }))
  const ratings = buildProgramRatings({
    season: 2026,
    teams,
    evidence,
    accomplishments: [
      { ...honor(5, 2025, true), teamId: '1' },
      { ...honor(0, 2025, true), teamId: '2' },
    ],
  })
  assert.equal(ratings.length, 138)
  assert.equal(ratings[0].teamId, '1')
  assert.equal(ratings[1].teamId, '2')
  assert.ok(ratings[0].programRating - ratings[2].programRating > 15)
  assert.equal(ratings[0].programResults, ratings[2].programResults)
  assert.ok(
    ratings.every((row) => row.programRating >= 0 && row.programRating <= 100),
  )
})

test('audited historical titles preserve split recognition and cannot leak into unfinished seasons', () => {
  const teams = [
    'Oklahoma',
    'Miami',
    'Ohio State',
    'LSU',
    'USC',
    'Texas',
    'Florida',
    'Alabama',
    'Auburn',
    'Florida State',
    'Clemson',
    'Georgia',
    'Michigan',
    'Indiana',
  ].map((name) => ({ id: name, name }))
  const rows = historicalNationalTitles(teams, 2026, cutoff)
  assert.equal(rows.length, 27)
  assert.deepEqual(
    rows.filter((row) => row.season === 2003).map((row) => row.teamId),
    ['LSU', 'USC'],
  )
  assert.equal(
    historicalNationalTitles(teams, 2000, Date.UTC(2000, 11, 1)).length,
    0,
  )
  assert.throws(() => historicalNationalTitles([], 2026, cutoff), /Unresolved/)
})
