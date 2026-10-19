import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSeasonCoach,
  getSeasonHistory,
} from '../src/features/teams/seasonHistory.ts'
import {
  seasonContributors,
  seasonHonors,
  seasonLeaders,
  seasonRecord,
  seasonResults,
} from '../src/features/teams/teamSeasonModel.ts'

const game = (overrides = {}) => ({
  sourceGameId: '1',
  date: '2024-01-01',
  time: '',
  endDate: null,
  opponentId: '2',
  opponent: 'Opponent',
  opponentPrefix: '',
  location: '',
  venue: 'home',
  exhibition: false,
  conference: true,
  status: 'final',
  result: 'W',
  michiganScore: 4,
  opponentScore: 2,
  note: '',
  tournament: '',
  recapUrl: null,
  boxScoreUrl: null,
  ...overrides,
})
const player = (id, values) => ({ _id: id, values: { name: id, ...values } })

test('season records exclude exhibitions and unplayed games, preserve hockey ties, and separate conference games', () => {
  const games = [
    game(),
    game({ result: 'L', venue: 'away', michiganScore: 1, opponentScore: 3 }),
    game({
      result: 'T',
      venue: 'neutral',
      michiganScore: 2,
      opponentScore: 2,
      note: 'Shootout win',
    }),
    game({ conference: false, tournament: 'Big Ten Tournament' }),
    game({ exhibition: true, michiganScore: 12 }),
    game({
      status: 'scheduled',
      result: null,
      michiganScore: null,
      opponentScore: null,
    }),
    game({
      status: 'cancelled',
      result: null,
      michiganScore: null,
      opponentScore: null,
      tournament: 'NCAA Tournament',
    }),
  ]
  const result = seasonResults('hockey', games)
  assert.equal(result.record, '2–1–1')
  assert.equal(result.conference, '1–1–1')
  assert.equal(result.home, '2–0–0')
  assert.equal(result.scoringFor, 2.75)
  assert.equal(result.scoringAgainst, 2.25)
  assert.equal(result.postseason.length, 2)
  assert.equal(
    seasonRecord('basketball', [game(), game({ result: 'L' })]),
    '1–1',
  )
})

test('future postseason placeholders never establish participation and missing tournament labels can use an explicit Frozen Four recap', () => {
  const result = seasonResults('hockey', [
    game({
      tournament: 'NCAA Frozen Four',
      status: 'scheduled',
      result: null,
      michiganScore: null,
      opponentScore: null,
    }),
    game({
      recapUrl:
        'https://mgoblue.com/news/2024/4/11/ice-hockey-loss-in-frozen-four-semifinal',
    }),
  ])
  assert.equal(result.postseason.length, 1)
  assert.equal(result.postseason[0].status, 'final')
  assert.equal(seasonResults('hockey', []).scoringFor, null)
})

test('contributors require recorded appearances, retain departed players, and keep unknown minutes behind measured totals', () => {
  const rows = [
    player('Departed', { games: 10, minutes: 200, status: 'Departed' }),
    player('Unknown', { games: null, minutes: null }),
    player('Zero', { games: 0, minutes: 0 }),
    player('Unmeasured', { games: 2, minutes: null, points: 1000 }),
    player('Measured', { games: 2, minutes: 20 }),
  ]
  assert.deepEqual(
    seasonContributors('basketball', rows).map((p) => p._id),
    ['Departed', 'Measured', 'Unmeasured'],
  )
  assert.equal(rows[0]._id, 'Departed')
})

test('leaders retain ties, do not treat missing components as zero, and preserve confirmed zero', () => {
  const rows = [
    player('A', { goals: 4, assists: 6 }),
    player('B', { goals: 7, assists: 3 }),
    player('Incomplete', { goals: 99, assists: null }),
  ]
  assert.deepEqual(seasonLeaders(rows, ['goals', 'assists']), {
    total: 10,
    names: ['A', 'B'],
  })
  assert.equal(seasonLeaders([rows[2]], ['goals', 'assists']), null)
  assert.equal(
    seasonLeaders([player('Zero', { points: 0 })], ['points']).total,
    0,
  )
})

test('honors use published finishes rather than the last game result or postseason placement', () => {
  assert.deepEqual(seasonHonors(getSeasonHistory('hockey', 2005)), [])
  assert.deepEqual(seasonHonors(getSeasonHistory('basketball', 2011)), [
    'Big Ten regular-season co-champions',
  ])
  assert.deepEqual(seasonHonors(getSeasonHistory('basketball', 2025)), [
    'National champions',
    'Big Ten regular-season champions',
  ])
  assert.deepEqual(seasonHonors(undefined), [])
})

test('history preserves CCHA affiliation, reconciles tournament round names, and records COVID exceptions without inventing future finishes', () => {
  assert.equal(getSeasonHistory('hockey', 2012).conference, 'CCHA')
  assert.equal(getSeasonHistory('hockey', 2013).conference, 'Big Ten')
  assert.equal(getSeasonCoach('basketball', 2026).name, 'Mike Boynton Jr.')
  assert.equal(getSeasonCoach('hockey', 2026).name, 'Brandon Naurato')
  assert.equal(getSeasonCoach('basketball', 2027), undefined)
  assert.equal(
    getSeasonHistory('basketball', 2010).postseason,
    'NCAA Round of 32',
  )
  assert.equal(
    getSeasonHistory('basketball', 2011).postseason,
    'NCAA Round of 64',
  )
  assert.match(
    getSeasonHistory('hockey', 2020).postseason,
    /unable to participate/,
  )
  for (const sport of ['basketball', 'hockey']) {
    assert.match(getSeasonHistory(sport, 2019).postseason, /cancelled/)
    assert.equal(getSeasonHistory(sport, 2026), undefined)
    for (let year = 2005; year <= 2025; year++) {
      const history = getSeasonHistory(sport, year)
      assert.equal(history.season, year)
      assert.match(history.overall, /^\d+–\d+(?:–\d+)?$/)
      assert.match(history.conferenceRecord, /^\d+–\d+(?:–\d+)?$/)
    }
  }
})
