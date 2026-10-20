/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import type { Infer } from 'convex/values'
import type { hockeyGame } from './hockeyScheduleFields'

const modules = import.meta.glob('./**/*.ts')
const token = 'hockey-schedule-test-session-not-a-real-credential'
async function setup() {
  const t = convexTest(schema, modules)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  await t.run((ctx) =>
    ctx.db.insert('ownerSessions', {
      tokenHash: Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      expiresAt: Date.now() + 600000,
      revokedAt: null,
    }),
  )
  return t
}
const game: Infer<typeof hockeyGame> = {
  sourceGameId: '1',
  date: '2026-10-17',
  endDate: null,
  time: '6:00 PM MT',
  opponentId: '10',
  opponent: 'Denver',
  opponentPrefix: '#1',
  location: 'Denver, Colo.',
  venue: 'away',
  exhibition: false,
  conference: false,
  status: 'final',
  result: 'W',
  michiganScore: 4,
  opponentScore: 3,
  note: '',
  tournament: '',
  recapUrl: null,
  boxScoreUrl: null,
}
const args = {
  season: 2026,
  sessionToken: token,
  expectedRevision: 0,
  sourceSha256: 'a'.repeat(64),
  games: [game],
}

describe('Michigan hockey schedules', () => {
  test('discards listed poll ranks and retries ranked source rows without changing saved games', async () => {
    const t = await setup()
    const rankedArgs = {
      ...args,
      games: [{ ...game, opponent: '#1/2 Denver' }],
    }
    await t.mutation(api.hockeySchedules.importSeason, rankedArgs)
    const before = await t.query(api.hockeySchedules.list, { season: 2026 })
    expect(before.games[0]).toMatchObject({
      ...game,
      opponent: 'Denver',
      opponentPrefix: '',
    })
    expect(
      await t.mutation(api.hockeySchedules.importSeason, {
        ...rankedArgs,
        expectedRevision: 1,
        games: [{ ...game, opponent: '#3 Denver', opponentPrefix: '#4' }],
      }),
    ).toEqual({ revision: 1, saved: 0, unchanged: true })
    expect(await t.query(api.hockeySchedules.list, { season: 2026 })).toEqual(
      before,
    )
  })

  test('requires owner authorization, rejects stale imports, and leaves roster data isolated', async () => {
    const t = await setup()
    await t.mutation(api.teamRosters.save, {
      sport: 'hockey',
      season: 2026,
      sessionToken: token,
      expectedRevision: 0,
      rows: [
        { values: { name: 'Existing goalie', position: 'G', saves: 100 } },
      ],
    })
    const roster = await t.query(api.teamRosters.list, {
      sport: 'hockey',
      season: 2026,
    })
    await expect(
      t.mutation(api.hockeySchedules.importSeason, {
        ...args,
        sessionToken: 'invalid',
      }),
    ).rejects.toThrow('session')
    await t.mutation(api.hockeySchedules.importSeason, args)
    await expect(
      t.mutation(api.hockeySchedules.importSeason, args),
    ).rejects.toThrow('changed')
    expect(
      (await t.query(api.hockeySchedules.list, { season: 2025 })).games,
    ).toEqual([])
    expect(
      await t.query(api.teamRosters.list, { sport: 'hockey', season: 2026 }),
    ).toEqual(roster)
  })

  test('retries are idempotent; corrections retain the official game identity and cannot drop games', async () => {
    const t = await setup()
    await t.mutation(api.hockeySchedules.importSeason, args)
    const before = await t.query(api.hockeySchedules.list, { season: 2026 })
    expect(
      await t.mutation(api.hockeySchedules.importSeason, {
        ...args,
        expectedRevision: 1,
      }),
    ).toEqual({ revision: 1, saved: 0, unchanged: true })
    await t.mutation(api.hockeySchedules.importSeason, {
      ...args,
      expectedRevision: 1,
      games: [{ ...game, time: '7:00 PM MT' }],
    })
    const after = await t.query(api.hockeySchedules.list, { season: 2026 })
    expect(after.revision).toBe(2)
    expect(after.games[0]._id).toBe(before.games[0]._id)
    expect(after.games[0].time).toBe('7:00 PM MT')
    await expect(
      t.mutation(api.hockeySchedules.importSeason, {
        ...args,
        expectedRevision: 2,
        games: [{ ...game, sourceGameId: '2' }],
      }),
    ).rejects.toThrow('remove')
  })

  test('retains official ties and shootout notes and keeps unplayed games scoreless', async () => {
    const t = await setup()
    const variants: Array<Infer<typeof hockeyGame>> = [
      { ...game, result: 'T', michiganScore: 3, note: '(SO, W)' },
      {
        ...game,
        sourceGameId: '2',
        status: 'cancelled',
        result: null,
        michiganScore: null,
        opponentScore: null,
        note: 'Canceled',
      },
      {
        ...game,
        sourceGameId: '3',
        status: 'postponed',
        result: null,
        michiganScore: null,
        opponentScore: null,
      },
      {
        ...game,
        sourceGameId: '4',
        status: 'no_contest',
        result: null,
        michiganScore: null,
        opponentScore: null,
      },
      {
        ...game,
        sourceGameId: '5',
        status: 'scheduled',
        result: null,
        michiganScore: null,
        opponentScore: null,
        time: 'TBA',
      },
      {
        ...game,
        sourceGameId: '6',
        exhibition: true,
        result: null,
        michiganScore: null,
        opponentScore: null,
        note: 'White, 8-2',
      },
    ]
    await t.mutation(api.hockeySchedules.importSeason, {
      ...args,
      games: variants,
    })
    const saved = (await t.query(api.hockeySchedules.list, { season: 2026 }))
      .games
    expect(saved).toHaveLength(6)
    expect(saved[0].result).toBe('T')
    expect(saved[0].note).toBe('(SO, W)')
    expect(saved.slice(1).every((row) => row.michiganScore === null)).toBe(true)
  })

  test('rejects malformed dates, duplicate IDs, contradictory scores, and partial imports atomically', async () => {
    const t = await setup()
    for (const games of [
      [{ ...game, date: '2025-10-17' }],
      [{ ...game, date: '2027-02-30' }],
      [{ ...game, endDate: '2027-02-30' }],
      [game, game],
      [{ ...game, michiganScore: -1 }],
      [{ ...game, opponentScore: null }],
      [{ ...game, result: 'L' as const }],
      [{ ...game, status: 'scheduled' as const }],
      [game, { ...game, sourceGameId: '2', recapUrl: 'javascript:alert(1)' }],
    ])
      await expect(
        t.mutation(api.hockeySchedules.importSeason, { ...args, games }),
      ).rejects.toThrow()
    expect(
      (await t.query(api.hockeySchedules.list, { season: 2026 })).revision,
    ).toBe(0)
    expect(
      (await t.query(api.hockeySchedules.list, { season: 2026 })).games,
    ).toEqual([])
  })
})
