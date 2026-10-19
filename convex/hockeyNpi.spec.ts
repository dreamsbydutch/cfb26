/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import type { NpiTeam } from './hockeyNpiModel'

const modules = import.meta.glob('./**/*.ts')
const teams: Array<NpiTeam> = Array.from({ length: 40 }, (_, i) => ({
  sourceTeamId: String(i + 1),
  team: i === 30 ? 'Michigan' : `Team ${i + 1}`,
  teamKey: i === 30 ? 'michigan' : `team${i + 1}`,
  rank: i + 1,
  npi: 55,
}))
const hash = 'a'.repeat(64)
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
function clock(date = '2026-10-19T13:00:00Z') {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(date))
}

describe('latest and final hockey NPI', () => {
  test('failed network requests retry only twice and never save an empty table', async () => {
    clock()
    const t = convexTest(schema, modules)
    const fetch = vi.fn().mockRejectedValue(new Error('HTTP unavailable'))
    vi.stubGlobal('fetch', fetch)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(
      await t.action(internal.hockeyNpi.refresh, { season: 2026 }),
    ).toEqual({ saved: 0, failed: 1 })
    await t.finishAllScheduledFunctions(vi.runAllTimers)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(
      (await t.query(api.hockeyNpi.forSchedule, { season: 2026 })).latest,
    ).toBeNull()
    expect(
      (await t.query(api.hockeyNpi.forSchedule, { season: 2026 }))
        .refreshFailed,
    ).toBe(true)
  })

  test('weekly refresh replaces one season record, skips duplicates, and preserves last valid on failure', async () => {
    clock()
    const t = convexTest(schema, modules)
    const first = await t.mutation(internal.hockeyNpi.claim, { season: 2026 })
    expect(first).not.toBeNull()
    expect(
      await t.mutation(internal.hockeyNpi.claim, { season: 2026 }),
    ).toBeNull()
    await t.mutation(internal.hockeyNpi.finish, {
      season: 2026,
      token: first!.token,
      teams,
      sourceSha256: hash,
    })
    expect(
      await t.mutation(internal.hockeyNpi.claim, { season: 2026 }),
    ).toBeNull()
    vi.setSystemTime(new Date('2026-10-26T13:00:00Z'))
    const next = await t.mutation(internal.hockeyNpi.claim, { season: 2026 })
    await t.mutation(internal.hockeyNpi.finish, {
      season: 2026,
      token: next!.token,
      error: 'HTTP 503',
    })
    const preserved = await t.query(api.hockeyNpi.forSchedule, { season: 2026 })
    expect(preserved.refreshFailed).toBe(true)
    expect(preserved.latest?.michiganRank).toBe(31)
    const retry = await t.mutation(internal.hockeyNpi.claim, { season: 2026 })
    const changed = teams.map((team) => ({ ...team, npi: 56 }))
    await t.mutation(internal.hockeyNpi.finish, {
      season: 2026,
      token: retry!.token,
      teams: changed,
      sourceSha256: hash,
    })
    expect(
      (await t.query(api.hockeyNpi.forSchedule, { season: 2026 })).latest
        ?.teams[0].npi,
    ).toBe(56)
    expect(
      await t.run((ctx) => ctx.db.query('hockeyNpiSeasons').take(10)),
    ).toHaveLength(1)
  })

  test('only archived final rankings survive into historical seasons and are immutable', async () => {
    clock()
    const t = convexTest(schema, modules)
    const claim = await t.mutation(internal.hockeyNpi.claim, { season: 2025 })
    expect(claim?.sourceUrl).toBe(
      'https://www.collegehockeynews.com/ratings/npi/2026',
    )
    expect(claim?.final).toBe(true)
    await t.mutation(internal.hockeyNpi.finish, {
      season: 2025,
      token: claim!.token,
      teams,
      sourceSha256: hash,
    })
    expect(
      (await t.query(api.hockeyNpi.forSchedule, { season: 2025 })).latest
        ?.final,
    ).toBe(true)
    expect(
      (await t.query(api.hockeyNpi.forSchedule, { season: 2026 })).latest,
    ).toBeNull()
    vi.setSystemTime(new Date('2027-10-01T00:00:00Z'))
    expect(
      await t.mutation(internal.hockeyNpi.claim, { season: 2025 }),
    ).toBeNull()
    await expect(
      t.query(api.hockeyNpi.forSchedule, { season: 2024 }),
    ).rejects.toThrow('begin')
  })

  test('stale workers and malformed tables cannot overwrite a good ranking', async () => {
    clock()
    const t = convexTest(schema, modules)
    const first = await t.mutation(internal.hockeyNpi.claim, { season: 2026 })
    vi.setSystemTime(new Date('2026-10-19T13:06:00Z'))
    const next = await t.mutation(internal.hockeyNpi.claim, { season: 2026 })
    expect(
      await t.mutation(internal.hockeyNpi.finish, {
        season: 2026,
        token: first!.token,
        teams,
        sourceSha256: hash,
      }),
    ).toBe(false)
    await expect(
      t.mutation(internal.hockeyNpi.finish, {
        season: 2026,
        token: next!.token,
        teams: [],
        sourceSha256: hash,
      }),
    ).rejects.toThrow('40')
    expect(
      (await t.query(api.hockeyNpi.forSchedule, { season: 2026 })).latest,
    ).toBeNull()
  })
})
