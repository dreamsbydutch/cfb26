import assert from 'node:assert/strict'
import test from 'node:test'

import { buildFallbackPowerField } from '../convex/ratingFallback.ts'

test('fallback Power ranks the complete season-specific FBS field', () => {
  const programs = ['alpha', 'beta', 'gamma', 'delta', 'fcs'].map((key) => ({
    id: key,
    key,
    name: key.toUpperCase(),
  }))
  const rows = buildFallbackPowerField({
    currentComposite: [
      {
        confidence: 90,
        dataSources: ['games', 'elo'],
        defense: 60,
        modelVersion: 'cfb26-composite-v2',
        offense: 65,
        overall: 65,
        programId: 'alpha',
        signalCount: 18,
        sourceProgramName: 'Alpha',
        specialTeams: 50,
      },
    ],
    currentElo: [
      {
        programId: 'alpha',
        rating: 1600,
        sourceProgramName: 'Alpha',
      },
    ],
    games: [
      {
        awayClassification: 'fbs',
        awayProgramId: 'beta',
        awaySourceName: 'Beta',
        homeClassification: 'fbs',
        homeProgramId: 'alpha',
        homeSourceName: 'Alpha',
      },
      {
        awayClassification: 'fcs',
        awayProgramId: 'fcs',
        awaySourceName: 'FCS',
        homeClassification: 'transitioning',
        homeProgramId: 'gamma',
        homeSourceName: 'Gamma',
      },
      {
        awayClassification: 'fbs',
        awayProgramId: 'delta',
        awaySourceName: 'Delta',
        homeClassification: 'fcs',
        homeProgramId: 'fcs',
        homeSourceName: 'FCS',
      },
    ],
    previousComposite: [
      {
        confidence: 80,
        dataSources: ['games', 'game_stats'],
        defense: 55,
        modelVersion: 'cfb26-composite-v2',
        offense: 58,
        overall: 60,
        programId: 'beta',
        signalCount: 12,
        sourceProgramName: 'Beta',
        specialTeams: 51,
      },
    ],
    previousElo: [
      { programId: 'gamma', rating: 1450, sourceProgramName: 'Gamma' },
    ],
    previousSeason: 2025,
    programs,
  })

  assert.deepEqual(
    rows.map((row) => row.programKey),
    ['alpha', 'beta', 'delta', 'gamma'],
  )
  assert.deepEqual(
    rows.map((row) => row.powerRank),
    [1, 2, 3, 4],
  )
  assert.equal(
    rows.find((row) => row.programKey === 'alpha').rankingBasis,
    'season_composite',
  )
  assert.equal(
    rows.find((row) => row.programKey === 'beta').rankingBasis,
    'prior_season_composite',
  )
  assert.equal(
    rows.find((row) => row.programKey === 'delta').rankingBasis,
    'neutral_baseline',
  )
})
