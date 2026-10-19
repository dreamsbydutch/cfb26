/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'
import { validateTeamScheduleGames } from './teamScheduleFields'
import type { Infer } from 'convex/values'
import type { basketballGame } from './basketballScheduleFields'

const modules = import.meta.glob('./**/*.ts')
const token = 'basketball-schedule-test-session-not-a-real-credential'
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
const game: Infer<typeof basketballGame> = {
  sourceGameId: '1',
  date: '2026-11-02',
  endDate: null,
  time: '6:00 PM',
  opponentId: '10',
  opponent: 'Oakland',
  opponentPrefix: '',
  location: 'Ann Arbor, Mich.',
  venue: 'home',
  exhibition: false,
  conference: false,
  status: 'final',
  result: 'W',
  michiganScore: 137,
  opponentScore: 100,
  note: '(2OT)',
  tournament: '',
  recapUrl: null,
  boxScoreUrl: null,
}
const args = {
  season: 2026,
  sessionToken: token,
  expectedRevision: 0,
  sourceSha256: 'b'.repeat(64),
  games: [game],
}
describe('Michigan basketball schedules', () => {
  test('supports basketball scores, requires owner auth, and isolates hockey, seasons, and roster stats', async () => {
    const t = await setup()
    await t.mutation(api.teamRosters.save, {
      sessionToken: token,
      sport: 'basketball',
      season: 2026,
      expectedRevision: 0,
      rows: [{ values: { name: 'Existing guard', games: 10, points: 120 } }],
    })
    const roster = await t.query(api.teamRosters.list, {
      sport: 'basketball',
      season: 2026,
    })
    await expect(
      t.mutation(api.basketballSchedules.importSeason, {
        ...args,
        sessionToken: 'invalid',
      }),
    ).rejects.toThrow('session')
    await t.mutation(api.basketballSchedules.importSeason, args)
    expect(
      (await t.query(api.basketballSchedules.list, { season: 2026 })).games[0]
        .michiganScore,
    ).toBe(137)
    expect(
      (await t.query(api.basketballSchedules.list, { season: 2025 })).games,
    ).toEqual([])
    expect(
      (await t.query(api.hockeySchedules.list, { season: 2026 })).games,
    ).toEqual([])
    await expect(
      t.mutation(api.hockeySchedules.importSeason, args),
    ).rejects.toThrow('Scores')
    expect(
      await t.query(api.teamRosters.list, {
        sport: 'basketball',
        season: 2026,
      }),
    ).toEqual(roster)
  })
  test('rejects stale writes and silent deletion while repeat imports and corrections preserve identity', async () => {
    const t = await setup()
    await t.mutation(api.basketballSchedules.importSeason, args)
    const before = await t.query(api.basketballSchedules.list, { season: 2026 })
    await expect(
      t.mutation(api.basketballSchedules.importSeason, args),
    ).rejects.toThrow('changed')
    expect(
      await t.mutation(api.basketballSchedules.importSeason, {
        ...args,
        expectedRevision: 1,
      }),
    ).toEqual({ revision: 1, saved: 0, unchanged: true })
    await t.mutation(api.basketballSchedules.importSeason, {
      ...args,
      expectedRevision: 1,
      games: [{ ...game, michiganScore: 138 }],
    })
    const after = await t.query(api.basketballSchedules.list, { season: 2026 })
    expect(after.games[0]._id).toBe(before.games[0]._id)
    expect(after.games[0].michiganScore).toBe(138)
    await expect(
      t.mutation(api.basketballSchedules.importSeason, {
        ...args,
        expectedRevision: 2,
        games: [{ ...game, sourceGameId: '2' }],
      }),
    ).rejects.toThrow('remove')
  })
  test('unplayed games remain scoreless; invalid results abort the complete batch', async () => {
    const t = await setup()
    expect(() =>
      validateTeamScheduleGames('basketball', 2026, [
        { ...game, result: 'T', michiganScore: 100 },
      ]),
    ).toThrow('tie')
    for (const games of [
      [{ ...game, michiganScore: 100, result: 'W' as const }],
      [{ ...game, michiganScore: 301 }],
      [{ ...game, status: 'scheduled' as const }],
      [game, { ...game, sourceGameId: '2', opponentScore: null }],
    ])
      await expect(
        t.mutation(api.basketballSchedules.importSeason, { ...args, games }),
      ).rejects.toThrow()
    expect(
      (await t.query(api.basketballSchedules.list, { season: 2026 })).games,
    ).toEqual([])
    const upcoming = {
      ...game,
      status: 'scheduled' as const,
      result: null,
      michiganScore: null,
      opponentScore: null,
      note: '',
    }
    await t.mutation(api.basketballSchedules.importSeason, {
      ...args,
      games: [upcoming],
    })
    const before = await t.query(api.basketballSchedules.list, { season: 2026 })
    expect(before.games[0].michiganScore).toBeNull()
    await t.mutation(api.basketballSchedules.importSeason, {
      ...args,
      expectedRevision: 1,
    })
    expect(
      (await t.query(api.basketballSchedules.list, { season: 2026 })).games[0]
        ._id,
    ).toBe(before.games[0]._id)
  })
})
