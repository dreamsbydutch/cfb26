/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { internal } from './_generated/api'
import schema from './schema'
import {
  easternRunAt,
  parseHockeyBox,
  parseHockeySchedule,
} from './hockeyResultModel'
import { hockeyScheduleUrl } from './hockeyScheduleFields'
import type { Infer } from 'convex/values'
import type { hockeyGame } from './hockeyScheduleFields'
import type { hockeyPlayerResult } from './hockeyResultFields'

const modules = import.meta.glob('./**/*.ts')
const game: Infer<typeof hockeyGame> = {
  sourceGameId: '30478',
  date: '2026-10-23',
  endDate: null,
  time: '7 PM',
  opponentId: '8',
  opponent: 'Western Michigan',
  opponentPrefix: '',
  location: 'Ann Arbor',
  venue: 'home',
  exhibition: false,
  conference: false,
  status: 'scheduled',
  result: null,
  michiganScore: null,
  opponentScore: null,
  note: '',
  tournament: '',
  recapUrl: null,
  boxScoreUrl:
    'https://mgoblue.com/sports/mens-ice-hockey/stats/2026-27/western-michigan/boxscore/30478',
}
const final: Infer<typeof hockeyGame> = {
  ...game,
  status: 'final',
  result: 'W',
  michiganScore: 3,
  opponentScore: 2,
}
const players: Array<Infer<typeof hockeyPlayerResult>> = Array.from(
  { length: 6 },
  (_, i) => ({
    sourcePlayerId: String(i + 1),
    name: `Player ${i + 1}`,
    jersey: String(i + 1),
    played: true,
    started: false,
    goals: i === 0 ? 3 : 0,
    assists: 0,
    shots: i === 0 ? 3 : 0,
    penaltyMinutes: 0,
    plusMinus: 0,
    blockedShots: 0,
    goalie: i === 5 ? { seconds: 3600, saves: 20, goalsAgainst: 2 } : null,
  }),
)
const sources = [
  { url: hockeyScheduleUrl(2026), sha256: 'a'.repeat(64) },
  { url: game.boxScoreUrl!, sha256: 'b'.repeat(64) },
]

// Encode realistic Nuxt reference arrays without depending on a live website.
function page(domain: string, value: unknown) {
  const values: Array<unknown> = []
  function encode(input: unknown): number {
    const i = values.length
    values.push(null)
    values[i] = Array.isArray(input)
      ? input.map(encode)
      : input && typeof input === 'object'
        ? Object.fromEntries(
            Object.entries(input).map(([k, v]) => [k, encode(v)]),
          )
        : input
    return i
  }
  encode({ pinia: { [domain]: value } })
  return `<script id="__NUXT_DATA__" type="application/json">${JSON.stringify(values)}</script>`
}

afterEach(() => vi.useRealTimers())
async function setup() {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-24T07:05:00Z'))
  const t = convexTest(schema, modules)
  const gameId = await t.run(async (ctx) => {
    for (const row of players)
      await ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2026,
        values: {
          name: row.name,
          jersey: row.jersey,
          position: row.goalie ? 'G' : 'F',
        },
        updatedAt: Date.now(),
      })
    return ctx.db.insert('hockeyScheduleGames', { ...game, season: 2026 })
  })
  const lease = await t.mutation(internal.hockeyResults.claim, { gameId })
  return {
    t,
    gameId,
    args: {
      gameId,
      token: lease!.token,
      expectedGame: game,
      game: final,
      players,
      sources,
      issues: [],
    },
  }
}

describe('overnight hockey results', () => {
  test('parses structured player rows and refuses incomplete goalie totals or contradictory participation', () => {
    const team = {
      name: 'Michigan',
      players: players.map((p) => ({
        rosterPlayerId: p.sourcePlayerId,
        playerFirstLastName: p.name,
        uniform: p.jersey,
        gamePlayed: p.played ? '1' : '0',
        gameStarted: '0',
        shotStats: {
          goals: String(p.goals),
          assists: '0',
          shots: String(p.shots),
        },
        miscStats: { plusMinus: '0', blocked: '0' },
        penaltyStats: { minutes: '0' },
        goalieStats: p.goalie
          ? {
              seconds: p.goalie.seconds,
              saves: String(p.goalie.saves),
              goalsAllowed: String(p.goalie.goalsAgainst),
            }
          : null,
      })),
      totals: {
        shotStats: { goals: '3', assists: '0', shots: '3' },
        goalieStats: { seconds: 3600, saves: '20', goalsAllowed: '2' },
      },
    }
    const box = {
      gameDate: '10/23/2026',
      thisTeamScore: '3',
      opponentTeamScore: '2',
      homeTeam: {
        ...team,
        players: [
          ...team.players,
          {
            name: 'TEAM',
            uniform: 'TM',
            rosterPlayerId: null,
            playerFirstLastName: null,
          },
        ],
      },
      visitingTeam: { name: 'Western Mich.', scoringSummary: { shots: '22' } },
    }
    const html = () => page('boxscore', { boxscore: { officialGame: box } })
    expect(parseHockeyBox(html(), final)).toEqual(players)
    team.totals.goalieStats.saves = '21'
    expect(() => parseHockeyBox(html(), final)).toThrow('do not match')
    team.totals.goalieStats.saves = '20'
    team.players[0].gamePlayed = '0'
    expect(() => parseHockeyBox(html(), final)).toThrow('participation')
  })

  test('uses 3 AM Eastern in both daylight and standard time and across year boundaries', () => {
    expect(easternRunAt(Date.parse('2026-10-24T07:05:00Z'))).toMatchObject({
      hour: 3,
      yesterday: '2026-10-23',
      season: 2026,
    })
    expect(easternRunAt(Date.parse('2026-12-24T08:05:00Z'))).toMatchObject({
      hour: 3,
      yesterday: '2026-12-23',
    })
    expect(easternRunAt(Date.parse('2027-01-01T08:05:00Z'))).toMatchObject({
      yesterday: '2026-12-31',
      season: 2026,
    })
    expect(easternRunAt(Date.parse('2026-11-01T08:05:00Z')).hour).toBe(3)
    expect(easternRunAt(Date.parse('2026-03-08T07:05:00Z')).hour).toBe(3)
  })

  test('selects the exact season game and treats official W/L/T as final despite stale SCHEDULED metadata', () => {
    const html = page('schedule', {
      schedules: {
        'schedules-mens-ice-hockey,2026-27': {
          games: [
            {
              id: 30478,
              date: '2026-10-23T19:00:00',
              time: '7 PM',
              location: 'Ann Arbor',
              location_indicator: 'H',
              type: 'R',
              conference: false,
              game_state_display: 'SCHEDULED',
              opponent: { id: 8, title: '#5 Western Michigan' },
              result: { status: 'W', team_score: '3', opponent_score: '2' },
            },
          ],
        },
      },
    })
    expect(parseHockeySchedule(html, 2026, '30478')).toMatchObject({
      status: 'final',
      michiganScore: 3,
      opponent: 'Western Michigan',
    })
    expect(() => parseHockeySchedule(html, 2025, '30478')).toThrow()
    expect(() => parseHockeySchedule(html, 2026, '999')).toThrow()
    expect(() =>
      parseHockeyBox(page('boxscore', { boxscore: {} }), final),
    ).toThrow()
  })

  test('claims once, applies clean results atomically, and leaves roster and football data untouched', async () => {
    const { t, gameId, args } = await setup()
    expect(
      await t.mutation(internal.hockeyResults.claim, { gameId }),
    ).toBeNull()
    expect(await t.mutation(internal.hockeyResults.finish, args)).toBe(true)
    expect(await t.mutation(internal.hockeyResults.finish, args)).toBe(false)
    await t.run(async (ctx) => {
      expect(
        (await ctx.db.get('hockeyScheduleGames', gameId))?.michiganScore,
      ).toBe(3)
      expect(
        await ctx.db
          .query('hockeyPlayerGames')
          .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
          .take(41),
      ).toHaveLength(6)
      expect(
        await ctx.db
          .query('hockeyResultReceipts')
          .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
          .take(30),
      ).toHaveLength(1)
      expect(
        await ctx.db
          .query('teamRosterEntries')
          .withIndex('by_sport_and_season', (q) =>
            q.eq('sport', 'hockey').eq('season', 2026),
          )
          .take(101),
      ).toHaveLength(6)
      expect(await ctx.db.query('collegeGames').take(1)).toEqual([])
    })
    expect(
      await t.query(internal.hockeyResults.candidates, { now: Date.now() }),
    ).toEqual([])
  })

  test('keeps ambiguous player imports pending while applying a validated score and retries delayed pages', async () => {
    const { t, gameId, args } = await setup()
    await t.run((ctx) =>
      ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2026,
        values: { name: 'Player 1', jersey: '1', position: 'F' },
        updatedAt: Date.now(),
      }),
    )
    expect(await t.mutation(internal.hockeyResults.finish, args)).toBe(false)
    await t.run(async (ctx) => {
      expect((await ctx.db.get('hockeyScheduleGames', gameId))?.status).toBe(
        'final',
      )
      expect(
        await ctx.db
          .query('hockeyPlayerGames')
          .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
          .take(41),
      ).toEqual([])
      const state = await ctx.db
        .query('hockeyResultState')
        .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
        .unique()
      expect(state?.status).toBe('pending')
    })
    vi.setSystemTime(new Date('2026-10-24T08:05:00Z'))
    expect(
      await t.query(internal.hockeyResults.candidates, { now: Date.now() }),
    ).toEqual([gameId])
  })

  test('replays completed observations without receipts and applies clean official corrections with history', async () => {
    const { t, gameId, args } = await setup()
    await t.mutation(internal.hockeyResults.finish, args)
    vi.setSystemTime(new Date('2026-10-25T07:05:00Z'))
    const replay = await t.mutation(internal.hockeyResults.claim, { gameId })
    await t.mutation(internal.hockeyResults.finish, {
      ...args,
      expectedGame: final,
      token: replay!.token,
    })
    expect(
      await t.run((ctx) =>
        ctx.db
          .query('hockeyResultReceipts')
          .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
          .take(30),
      ),
    ).toHaveLength(1)
    vi.setSystemTime(new Date('2026-10-26T07:05:00Z'))
    const correction = await t.mutation(internal.hockeyResults.claim, {
      gameId,
    })
    await t.mutation(internal.hockeyResults.finish, {
      ...args,
      expectedGame: final,
      token: correction!.token,
      game: { ...final, michiganScore: 4 },
      players: players.map((p, i) =>
        i === 0 ? { ...p, goals: 4, shots: 4 } : p,
      ),
      sources: sources.map((s) => ({ ...s, sha256: 'd'.repeat(64) })),
    })
    await t.run(async (ctx) => {
      const receipts = await ctx.db
        .query('hockeyResultReceipts')
        .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
        .order('desc')
        .take(30)
      expect(receipts).toHaveLength(2)
      expect(receipts[0]).toMatchObject({
        correction: true,
        status: 'complete',
        before: { michiganScore: 3 },
        after: { michiganScore: 4 },
      })
      expect(
        await ctx.db
          .query('hockeyPlayerGames')
          .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
          .take(41),
      ).toHaveLength(6)
    })
  })

  test('rejects stale leases and intervening owner schedule changes without overwriting', async () => {
    const { t, gameId, args } = await setup()
    await t.run((ctx) =>
      ctx.db.patch('hockeyScheduleGames', gameId, { time: '8 PM' }),
    )
    expect(await t.mutation(internal.hockeyResults.finish, args)).toBe(false)
    expect(
      (await t.run((ctx) => ctx.db.get('hockeyScheduleGames', gameId)))?.time,
    ).toBe('8 PM')
    expect(
      (await t.run((ctx) => ctx.db.get('hockeyScheduleGames', gameId)))?.status,
    ).toBe('scheduled')
    vi.setSystemTime(new Date('2026-10-24T08:05:00Z'))
    await t.mutation(internal.hockeyResults.claim, { gameId })
    expect(await t.mutation(internal.hockeyResults.finish, args)).toBe(false)
  })

  test('rechecks processed games, records official corrections, and preserves valid stats when a later page is incomplete', async () => {
    const { t, gameId, args } = await setup()
    await t.mutation(internal.hockeyResults.finish, args)
    vi.setSystemTime(new Date('2026-10-25T07:05:00Z'))
    expect(
      await t.query(internal.hockeyResults.candidates, { now: Date.now() }),
    ).toEqual([gameId])
    const lease = await t.mutation(internal.hockeyResults.claim, { gameId })
    await t.mutation(internal.hockeyResults.finish, {
      ...args,
      expectedGame: final,
      token: lease!.token,
      sources: [sources[0], { ...sources[1], sha256: 'c'.repeat(64) }],
      players: undefined,
      issues: ['Official goalie totals are incomplete.'],
    })
    await t.run(async (ctx) => {
      const receipts = await ctx.db
        .query('hockeyResultReceipts')
        .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
        .order('desc')
        .take(30)
      expect(receipts).toHaveLength(2)
      expect(receipts[0]).toMatchObject({
        correction: true,
        status: 'pending',
        previousReceiptId: receipts[1]._id,
      })
      expect(
        await ctx.db
          .query('hockeyPlayerGames')
          .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
          .take(41),
      ).toHaveLength(6)
    })
  })
})
