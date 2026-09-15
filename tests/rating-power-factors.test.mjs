import test from 'node:test'
import assert from 'node:assert/strict'
import {
  replaySurprise,
  replayUnitFactor,
  auditFactorCoverage,
} from '../scripts/lib/power-factor-replay.mjs'

const day = 86_400_000
function game(
  id,
  dayNumber,
  home,
  away,
  homePoints = 30,
  awayPoints = 20,
  season = 2020,
) {
  return {
    id,
    completed: true,
    season,
    kickoffAt: dayNumber * day,
    homeTeamId: home,
    awayTeamId: away,
    homeClassification: 'fbs',
    awayClassification: 'fbs',
    homePoints,
    awayPoints,
    overtimePeriods: 0,
    neutralSite: true,
    ratingEvidence: {
      observedAt: 1000 * day,
      home: { ppa: 0.4, successRate: 0.6, plays: 60 },
      away: { ppa: 0.1, successRate: 0.3, plays: 60 },
      homeDrives: { points: 30, possessions: 10 },
      awayDrives: { points: 20, possessions: 10 },
    },
  }
}
function request(g, predictedMargin = 0, featureCutoffAt = g.kickoffAt - 1) {
  return {
    ...g,
    gameId: g.id,
    featureCutoffAt,
    predictedMargin,
    actualMargin: g.homePoints - g.awayPoints,
  }
}

test('repeated surprise requires two available same-direction errors and cannot consume the next result', () => {
  const games = [
    game('one', 1, 'a', 'b'),
    game('two', 8, 'a', 'c'),
    game('three', 15, 'a', 'd'),
  ]
  const requests = games.map((g) => request(g))
  const policy = { window: 2 }
  const rows = replaySurprise(games, requests, policy)
  assert.deepEqual(
    rows.map((r) => r.predictedMargin),
    [0, 0, 10],
  )
  const changed = games.map((g) =>
    g.id === 'three' ? { ...g, homePoints: 100 } : g,
  )
  assert.deepEqual(replaySurprise(changed, requests, policy), rows)
  const mixed = games.map((g) =>
    g.id === 'two' ? { ...g, homePoints: 10 } : g,
  )
  assert.equal(replaySurprise(mixed, requests, policy)[2].predictedMargin, 0)
  const cutoff = requests.map((r) =>
    r.gameId === 'three'
      ? { ...r, featureCutoffAt: games[1].kickoffAt + 6 * 3_600_000 }
      : r,
  )
  assert.equal(replaySurprise(games, cutoff, policy)[2].predictedMargin, 0)
})

test('surprise treats a satisfied blowout bound as zero negative evidence and caps overtime', () => {
  const games = [
    game('one', 1, 'a', 'b', 60, 0),
    game('two', 8, 'a', 'c', 60, 0),
    game('three', 15, 'a', 'd'),
  ]
  const requests = games.map((g) => request(g, 45))
  assert.equal(
    replaySurprise(games, requests, { window: 2 })[2].predictedMargin,
    45,
  )
  const overtime = games.map((g) => ({ ...g, overtimePeriods: 1 }))
  assert.equal(
    replaySurprise(overtime, requests, { window: 2 })[2].predictedMargin,
    24,
  )
})

test('unit factors exclude future and unfinished evidence, freeze a slate, and preserve neutral symmetry', () => {
  const past = game('past', 1, 'a', 'b')
  const later = game('later', 8, 'a', 'c')
  const req = request(later)
  const policy = { metric: 'successRate' }
  const result = replayUnitFactor([past, later], [req], policy)[0]
    .predictedMargin
  assert.ok(result > 0)
  const contaminated = { ...later, ratingEvidence: past.ratingEvidence }
  assert.equal(
    replayUnitFactor([past, contaminated], [req], policy)[0].predictedMargin,
    result,
  )
  assert.equal(
    replayUnitFactor([{ ...past, completed: false }], [req], policy)[0]
      .predictedMargin,
    0,
  )
  const reverse = {
    ...req,
    gameId: 'reverse',
    homeTeamId: 'c',
    awayTeamId: 'a',
  }
  assert.equal(
    replayUnitFactor([past], [reverse], policy)[0].predictedMargin,
    -result,
  )
  const sameSlate = { ...req, gameId: 'same-slate', kickoffAt: 10 * day }
  assert.equal(
    replayUnitFactor([past, later], [sameSlate], policy)[0].predictedMargin,
    result,
  )
})

test('unit response and uncertainty policies actually change opponent-adjusted forecasts', () => {
  const games = [
    game('old', 1, 'a', 'b', 30, 20, 2019),
    game('new', 8, 'c', 'a'),
  ]
  const req = request(game('next', 15, 'a', 'b'))
  const run = (extra) =>
    replayUnitFactor(games, [req], { metric: 'ppa', ...extra })[0]
      .predictedMargin
  assert.notEqual(
    run({}),
    run({ offenseRetention: 0.25, defenseRetention: 0.75 }),
  )
  assert.notEqual(run({}), run({ uncertainty: true }))
  assert.throws(() => run({ offenseRetention: 0 }), /retention/)
  assert.throws(
    () =>
      replayUnitFactor(games, [{ ...req, featureCutoffAt: req.kickoffAt }], {
        metric: 'ppa',
      }),
    /pregame/,
  )
})

test('coverage distinguishes reconstructed evidence from contemporaneous availability and missing units', () => {
  const g = game('g', 1, 'a', 'b')
  g.ratingEvidence.observedAt = Date.UTC(2026, 8, 14)
  delete g.ratingEvidence.away.successRate
  const coverage = auditFactorCoverage({ games: [g] }, [2020])[0]
  assert.equal(coverage.ppa, 1)
  assert.equal(coverage.successRate, 0)
  assert.equal(coverage.pointsPerDrive, 1)
  assert.equal(coverage.contemporaneousEvidence, 0)
})
