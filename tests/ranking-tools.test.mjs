import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPlayoffProjection,
  classifyQuadrant,
  moveBallotEntry,
} from '../convex/rankingTools.ts'

test('ballot movement uses insertion ordering', () => {
  assert.deepEqual(moveBallotEntry(['a', 'b', 'c', 'd'], 'd', 2), [
    'a',
    'd',
    'b',
    'c',
  ])
  assert.deepEqual(moveBallotEntry(['a', 'b', 'c', 'd'], 'a', 4), [
    'b',
    'c',
    'd',
    'a',
  ])
})

test('quadrants follow the selected edition Power order', () => {
  assert.equal(classifyQuadrant(1), 'Q1')
  assert.equal(classifyQuadrant(35), 'Q1')
  assert.equal(classifyQuadrant(36), 'Q2')
  assert.equal(classifyQuadrant(70), 'Q2')
  assert.equal(classifyQuadrant(71), 'Q3')
  assert.equal(classifyQuadrant(105), 'Q3')
  assert.equal(classifyQuadrant(106), 'Q4')
  assert.equal(classifyQuadrant(null), null)
})

test('playoff selection uses actual champions then fills at-large spots', () => {
  const projection = buildPlayoffProjection({
    rules: { byeCount: 4, championBidCount: 2, fieldSize: 4 },
    teams: [
      { conference: 'A', programKey: 'a1', resumeRank: 1 },
      {
        conference: 'B',
        conferenceChampion: true,
        programKey: 'b2',
        resumeRank: 5,
      },
      { conference: 'B', programKey: 'b1', resumeRank: 2 },
      { conference: 'C', programKey: 'c1', resumeRank: 3 },
      { conference: 'D', programKey: 'd1', resumeRank: 4 },
    ],
  })

  assert.deepEqual(
    projection.field.map(({ bid, programKey, seed }) => ({
      bid,
      programKey,
      seed,
    })),
    [
      { bid: 'automatic', programKey: 'a1', seed: 1 },
      { bid: 'at_large', programKey: 'b1', seed: 2 },
      { bid: 'at_large', programKey: 'c1', seed: 3 },
      { bid: 'automatic', programKey: 'b2', seed: 4 },
    ],
  )
  assert.equal(projection.firstTeamOut, 'd1')
})
