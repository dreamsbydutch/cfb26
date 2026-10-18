/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { metricValues } from '../src/features/teams/teamRosterModel'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.ts')
const token = 'team-roster-test-session-not-a-real-credential'
async function setup() {
  const t = convexTest(schema, modules)
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  await t.run((ctx) =>
    ctx.db.insert('ownerSessions', {
      tokenHash: Array.from(new Uint8Array(hash), (byte) =>
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
const args = {
  sessionToken: token,
  sport: 'basketball' as const,
  season: 2026,
  expectedRevision: 0,
}
describe('Michigan team rosters', () => {
  test('starts empty, requires owner auth, isolates sports and seasons, and rejects cross-sport edits', async () => {
    const t = await setup()
    expect(
      (
        await t.query(api.teamRosters.list, {
          sport: 'basketball',
          season: 2026,
        })
      ).entries,
    ).toEqual([])
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        sessionToken: 'invalid',
        rows: [{ values: { name: 'Guard' } }],
      }),
    ).rejects.toThrow('session')
    await t.mutation(api.teamRosters.save, {
      ...args,
      rows: [
        { values: { name: 'Guard', position: 'PG', games: '2', points: '30' } },
      ],
    })
    const data = await t.query(api.teamRosters.list, {
      sport: 'basketball',
      season: 2026,
    })
    expect(data.entries[0].values.points).toBe(30)
    expect(
      (await t.query(api.teamRosters.list, { sport: 'hockey', season: 2026 }))
        .entries,
    ).toEqual([])
    expect(
      (
        await t.query(api.teamRosters.list, {
          sport: 'basketball',
          season: 2027,
        })
      ).entries,
    ).toEqual([])
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        sport: 'hockey',
        rows: [
          { id: data.entries[0]._id, values: { name: 'Guard', position: 'C' } },
        ],
      }),
    ).rejects.toThrow('belong')
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        season: 2027,
        rows: [{ id: data.entries[0]._id, values: data.entries[0].values }],
      }),
    ).rejects.toThrow('belong')
  })
  test('saves atomically, rejects invalid stats and stale revisions, and preserves unknowns and zero', async () => {
    const t = await setup()
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        rows: [
          { values: { name: 'Valid' } },
          { values: { name: 'Bad', fgPct: 101 } },
        ],
      }),
    ).rejects.toThrow('FG%')
    expect(
      (
        await t.query(api.teamRosters.list, {
          sport: 'basketball',
          season: 2026,
        })
      ).revision,
    ).toBe(0)
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        rows: [{ values: { name: 'Bad', position: 'LW' } }],
      }),
    ).rejects.toThrow('Position')
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        rows: [{ values: { name: 'Bad', points: -1 } }],
      }),
    ).rejects.toThrow('Points')
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        rows: [{ values: { name: 'Bad', games: 1, starts: 2 } }],
      }),
    ).rejects.toThrow('Starts')
    await t.mutation(api.teamRosters.save, {
      ...args,
      rows: [{ values: { name: 'Guard', points: 0, assists: null } }],
    })
    const data = await t.query(api.teamRosters.list, {
      sport: 'basketball',
      season: 2026,
    })
    expect(data.entries[0].values).toMatchObject({ points: 0, assists: null })
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        rows: [{ values: { name: 'Stale' } }],
      }),
    ).rejects.toThrow('another session')
    await t.mutation(api.teamRosters.save, {
      ...args,
      expectedRevision: 1,
      rows: [
        {
          id: data.entries[0]._id,
          values: { ...data.entries[0].values, points: '' },
        },
      ],
    })
    expect(
      (
        await t.query(api.teamRosters.list, {
          sport: 'basketball',
          season: 2026,
        })
      ).entries[0].values.points,
    ).toBeNull()
  })
  test('hockey enforces goalie fields and calculates separate skater and goalie metrics', async () => {
    const t = await setup()
    await expect(
      t.mutation(api.teamRosters.save, {
        ...args,
        sport: 'hockey',
        rows: [{ values: { name: 'Skater', position: 'D', saves: 10 } }],
      }),
    ).rejects.toThrow('Goalie')
    await t.mutation(api.teamRosters.save, {
      ...args,
      sport: 'hockey',
      rows: [
        {
          values: {
            name: 'Goalie',
            position: 'G',
            saves: 90,
            goalsAgainst: 10,
            goalieMinutes: 120,
          },
        },
      ],
    })
    const data = await t.query(api.teamRosters.list, {
      sport: 'hockey',
      season: 2026,
    })
    expect(metricValues('hockey', true, data.entries[0].values)).toEqual([
      '—',
      '0.900',
      '5.00',
      '—',
    ])
    expect(metricValues('hockey', false, { goals: 2, assists: 3 })).toEqual([
      2,
      3,
      5,
      '—',
      '—',
    ])
    expect(metricValues('basketball', false, { games: 2, points: 30 })).toEqual(
      ['—', '15.0', '—', '—', '—', '—', '—'],
    )
    expect(metricValues('basketball', false, { games: 0, points: 0 })[1]).toBe(
      '—',
    )
  })
})
