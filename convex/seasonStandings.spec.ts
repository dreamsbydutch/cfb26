/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, expect, test, vi } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.ts')
afterEach(() => vi.useRealTimers())

test('2026 standings use completed games when the separate snapshot is empty', async () => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-04T12:00:00Z'))
  const t = convexTest(schema, modules)
  const ids = await t.run(async (ctx) => {
    const michigan = await ctx.db.insert('programs', {
      key: 'michigan',
      name: 'Michigan',
      classification: 'fbs',
    })
    const indiana = await ctx.db.insert('programs', {
      key: 'indiana',
      name: 'Indiana',
      classification: 'fbs',
    })
    const fcs = await ctx.db.insert('programs', {
      key: 'fcs',
      name: 'FCS opponent',
      classification: 'fcs',
    })
    const base = {
      season: 2026,
      seasonType: 'regular' as const,
      homeProgramId: michigan,
      homeSourceId: 1,
      homeSourceName: 'Michigan',
      homeClassification: 'fbs',
      homeConference: 'Big Ten',
      awayProgramId: indiana,
      awaySourceId: 2,
      awaySourceName: 'Indiana',
      awayClassification: 'fbs',
      awayConference: 'Big Ten',
      conferenceGame: true,
      completed: true,
      neutralSite: false,
      sourceUpdatedAt: Date.now(),
      startTimeTbd: false,
      matchupKey: 'indiana:michigan',
    }
    await ctx.db.insert('collegeGames', {
      ...base,
      sourceKey: 'one',
      sourceGameId: 1,
      startTime: Date.parse('2026-10-24'),
      week: 9,
      homePoints: 24,
      awayPoints: 10,
    })
    await ctx.db.insert('collegeGames', {
      ...base,
      sourceKey: 'two',
      sourceGameId: 2,
      startTime: Date.parse('2026-10-31'),
      week: 10,
      awayProgramId: fcs,
      awaySourceName: 'FCS opponent',
      awayClassification: 'fcs',
      awayConference: 'FCS',
      conferenceGame: false,
      homePoints: 0,
      awayPoints: 7,
    })
    await ctx.db.insert('collegeGames', {
      ...base,
      sourceKey: 'live',
      sourceGameId: 3,
      startTime: Date.parse('2026-11-03'),
      week: 10,
      completed: false,
      homePoints: 3,
      awayPoints: 0,
    })
    await ctx.db.insert('collegeGames', {
      ...base,
      sourceKey: 'future',
      sourceGameId: 4,
      startTime: Date.parse('2026-11-14'),
      week: 12,
      homePoints: 0,
      awayPoints: 10,
    })
    await ctx.db.insert('collegeGames', {
      ...base,
      sourceKey: 'missing-score',
      sourceGameId: 5,
      startTime: Date.parse('2026-10-01'),
      week: 5,
    })
    return { michigan, indiana, fcs }
  })
  const rows = await t.query(api.teamData.listStandingsBySeason, {
    season: 2026,
  })
  expect(rows.find((row) => row.programId === ids.michigan)).toMatchObject({
    wins: 1,
    losses: 1,
    conferenceWins: 1,
    conferenceLosses: 0,
    conference: 'Big Ten',
    recordSource: 'completed_games',
    throughWeek: 10,
  })
  expect(rows.find((row) => row.programId === ids.indiana)).toMatchObject({
    wins: 0,
    losses: 1,
  })
  expect(rows.some((row) => row.programId === ids.fcs)).toBe(false)
  expect(
    await t.query(api.teamData.listStandingsBySeason, { season: 2025 }),
  ).toEqual([])
})

test('retains archived standings, conference records, and AP rank without game evidence', async () => {
  const t = convexTest(schema, modules)
  const unit = {
    firstDownsByPass: 0,
    firstDownsByPenalty: 0,
    firstDownsByRush: 0,
    firstDownsTotal: 0,
    interceptions: 0,
    passAttempts: 0,
    passCompletionPercentage: 0,
    passCompletions: 0,
    passingTouchdowns: 0,
    passingYards: 0,
    penalties: 0,
    penaltyYards: 0,
    plays: 0,
    points: 0,
    rushAttempts: 0,
    rushingTouchdowns: 0,
    rushingYards: 0,
    rushingYardsPerAttempt: 0,
    totalYards: 0,
    turnovers: 0,
    turnoversByFumble: 0,
    yardsPerPlay: 0,
  }
  await t.run(async (ctx) => {
    const programId = await ctx.db.insert('programs', {
      key: 'historical',
      name: 'Historical team',
      classification: 'fcs',
    })
    await ctx.db.insert('teamSeasonStandings', {
      programId,
      season: 2025,
      sourceKey: 'historical:2025',
      sourceId: 'historical',
      sourceProgramName: 'Historical team',
      sourceUpdatedAt: 1,
      conference: 'Saved conference',
      wins: 8,
      losses: 4,
      games: 12,
      winPercentage: 2 / 3,
      conferenceWins: 5,
      conferenceLosses: 3,
      conferenceWinPercentage: 5 / 8,
      apCurrentRank: 18,
      offense: unit,
      defense: unit,
      conferenceChampion: false,
      fourTeamPlayoff: false,
      twelveTeamPlayoff: false,
      nationalChampion: false,
      simpleRatingSystem: 0,
      strengthOfSchedule: 0,
    })
  })
  expect(
    await t.query(api.teamData.listStandingsBySeason, { season: 2025 }),
  ).toMatchObject([
    {
      sourceProgramName: 'Historical team',
      wins: 8,
      losses: 4,
      conferenceWins: 5,
      conferenceLosses: 3,
      apCurrentRank: 18,
      conference: 'Saved conference',
      recordSource: 'snapshot',
      throughWeek: null,
    },
  ])
})
