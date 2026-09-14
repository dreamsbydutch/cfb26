import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { replayElo } from '../scripts/lib/power-elo.mjs'
import { replayEfficiency } from '../scripts/lib/power-efficiency.mjs'
import { benchmarkVintage } from '../scripts/lib/benchmark-vintage.mjs'

const game = {
  id: 'old',
  season: 2025,
  homeTeamId: 'a',
  awayTeamId: 'b',
  homeClassification: 'fbs',
  awayClassification: 'fbs',
  kickoffAt: 1,
  homePoints: 21,
  awayPoints: 7,
  neutralSite: true,
  completed: true,
}
const request = {
  ...game,
  gameId: 'next',
  kickoffAt: 1e9,
  featureCutoffAt: 1e8,
}
test('Elo uses completed earlier results and is invariant to future outcomes and same-win margins', () => {
  const first = replayElo([game], [request])[0]
  assert.ok(first.homeWinProbability > 0.5)
  assert.deepEqual(
    replayElo([{ ...game, homePoints: 63 }], [request])[0],
    first,
  )
  assert.deepEqual(
    replayElo(
      [game, { ...game, id: 'future', kickoffAt: 1e9, awayPoints: 90 }],
      [request],
    )[0],
    first,
  )
  assert.equal(
    replayElo([game], [{ ...request, featureCutoffAt: 1000 }])[0]
      .homeWinProbability,
    0.5,
  )
  assert.throws(() => replayElo([game, game], [request]))
  assert.throws(() => replayElo([game], [{ ...request, featureCutoffAt: 1e9 }]))
})
test('neutral Elo projections reverse symmetrically and freeze all games at the same cutoff', () => {
  const [first, second] = replayElo(
    [game],
    [request, { ...request, gameId: 'z', homeTeamId: 'b', awayTeamId: 'a' }],
  )
  assert.equal(first.predictedMargin, -second.predictedMargin)
  assert.ok(
    Math.abs(first.homeWinProbability + second.homeWinProbability - 1) < 1e-12,
  )
})
test('a recently downloaded stale or unverified benchmark cannot qualify as current', () => {
  const snapshot = {
    season: 2026,
    observedAt: 100,
    rows: [],
    publisherEdition: {
      status: 'verified',
      season: 2026,
      throughWeek: 2,
      publishedAt: 90,
      verifiedAt: 101,
      url: 'https://www.espn.com/example',
      contentSha256: 'a'.repeat(64),
      snapshotRowsSha256: createHash('sha256').update('[]').digest('hex'),
    },
  }
  const at = { season: 2026, throughWeek: 2, cutoffAt: 110 }
  assert.equal(benchmarkVintage(snapshot, at).eligible, true)
  assert.equal(
    benchmarkVintage({ ...snapshot, publisherEdition: undefined }, at).eligible,
    false,
  )
  assert.equal(
    benchmarkVintage(snapshot, { ...at, throughWeek: 3 }).eligible,
    false,
  )
  assert.equal(
    benchmarkVintage(snapshot, { ...at, cutoffAt: 100 }).eligible,
    false,
  )
  assert.equal(
    benchmarkVintage({ ...snapshot, season: 2025 }, at).eligible,
    false,
  )
  assert.equal(
    benchmarkVintage(
      { ...snapshot, rows: [{ team: 'Clemson', rating: 1 }] },
      at,
    ).eligible,
    false,
  )
})

test('adjusted efficiency measures prior play quality independently of final scores', () => {
  const observed = {
    ...game,
    ratingEvidence: {
      home: { ppa: 0.5, plays: 60 },
      away: { ppa: -0.2, plays: 60 },
    },
  }
  const base = replayEfficiency([observed], [request])[0]
  assert.ok(base.predictedMargin > 0)
  assert.deepEqual(
    replayEfficiency(
      [{ ...observed, homePoints: 7, awayPoints: 63 }],
      [request],
    )[0],
    base,
  )
  assert.deepEqual(
    replayEfficiency(
      [
        observed,
        {
          ...observed,
          id: 'future',
          kickoffAt: 1e9,
          ratingEvidence: {
            home: { ppa: -4, plays: 60 },
            away: { ppa: 4, plays: 60 },
          },
        },
      ],
      [request],
    )[0],
    base,
  )
  assert.equal(
    replayEfficiency([observed], [{ ...request, featureCutoffAt: 1000 }])[0]
      .predictedMargin,
    0,
  )
  assert.ok(
    Math.abs(
      base.predictedMargin +
        replayEfficiency(
          [observed],
          [{ ...request, homeTeamId: 'b', awayTeamId: 'a' }],
        )[0].predictedMargin,
    ) < 1e-9,
  )
})

test('benchmark commands refuse the old unverified snapshot contract before writing outputs', () => {
  const dir = mkdtempSync(join(tmpdir(), 'cfb26-vintage-'))
  const snapshot = join(dir, 'snapshot.json'),
    data = join(dir, 'data.json'),
    output = join(dir, 'output.json')
  writeFileSync(
    snapshot,
    JSON.stringify({ season: 2026, observedAt: 1, rows: [], forecasts: [] }),
  )
  writeFileSync(data, JSON.stringify({ games: [], reports: [] }))
  for (const [script, args] of [
    ['scripts/freeze-sp-benchmark.mjs', [data, snapshot, output]],
    ['scripts/score-sp-benchmark.mjs', [snapshot, data, output]],
  ]) {
    assert.throws(
      () =>
        execFileSync(process.execPath, [script, ...args], { stdio: 'pipe' }),
      (error) => error.stderr.toString().includes('unverified'),
    )
    assert.equal(existsSync(output), false)
  }
})
