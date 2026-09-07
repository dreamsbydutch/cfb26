import assert from 'node:assert/strict'
import test from 'node:test'

import { buildSeasonRatings } from '../convex/ratingModel.ts'

test('composite ratings include every scheduled FBS program when source coverage is partial', () => {
  const season = 2026
  const programs = ['alpha', 'beta', 'gamma'].map((key) => ({
    _id: key,
    key,
    name: key[0].toUpperCase() + key.slice(1),
  }))
  const ratings = buildSeasonRatings(
    {
      draft: [],
      elo: [
        {
          conference: 'A',
          programId: 'alpha',
          rating: 1600,
          season,
          sourceProgramName: 'Alpha',
        },
      ],
      games: [
        {
          awayClassification: 'fbs',
          awayProgramId: 'gamma',
          completed: false,
          homeClassification: 'fbs',
          homeProgramId: 'beta',
          season,
        },
      ],
      inputs: [],
      programs,
      recruiting: [],
      standings: [],
      stats: [],
    },
    season,
    1,
  )

  assert.deepEqual(ratings.map((rating) => rating.programKey).sort(), [
    'alpha',
    'beta',
    'gamma',
  ])
  assert.deepEqual(
    ratings.map((rating) => rating.rank),
    [1, 2, 3],
  )
})
