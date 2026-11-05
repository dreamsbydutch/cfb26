/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, test, vi } from 'vitest'
import crons from './crons'
import schema from './schema'
import { api, internal } from './_generated/api'

const modules = import.meta.glob('./**/*.ts')
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function page(value: unknown) {
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
  encode({
    pinia: {
      schedule: {
        schedules: { 'schedules-mens-basketball,2026-27': { games: [value] } },
      },
    },
  })
  return `<script id="__NUXT_DATA__">${JSON.stringify(values)}</script>`
}
test.each([
  { exhibition: false, type: 'R', opponent: 'Oakland' },
  { exhibition: true, type: 'S', opponent: '#10 Houston (ex)' },
])(
  'overnight refresh publishes results: $opponent',
  async ({ exhibition, type, opponent }) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-04T08:05:00Z'))
    const t = convexTest(schema, modules)
    await t.run((ctx) =>
      ctx.db.insert('basketballScheduleGames', {
        season: 2026,
        sourceGameId: '1',
        date: '2026-11-03',
        endDate: null,
        time: '7 PM',
        opponentId: '10',
        opponent,
        opponentPrefix: '',
        location: 'Ann Arbor',
        venue: 'home',
        exhibition,
        conference: false,
        status: 'scheduled',
        result: null,
        michiganScore: null,
        opponentScore: null,
        note: '',
        tournament: '',
        recapUrl: null,
        boxScoreUrl: null,
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(
          new Response(
            page({
              id: 1,
              date: '2026-11-03T19:00:00',
              time: '7 PM',
              location: 'Ann Arbor',
              location_indicator: 'H',
              type,
              conference: false,
              game_state_display: 'SCHEDULED',
              opponent: { id: 10, title: opponent },
              result: { status: 'W', team_score: '90', opponent_score: '70' },
            }),
          ),
        ),
      ),
    )
    await t.action(
      makeFunctionReference<'action'>('basketballSchedules:refresh'),
      {},
    )
    const result = await t.query(api.basketballSchedules.list, { season: 2026 })
    expect(result.games[0]).toMatchObject({
      exhibition,
      status: 'final',
      result: 'W',
      michiganScore: 90,
      opponentScore: 70,
    })
    expect(result.revision).toBe(1)
    expect(
      (await t.query(api.hockeySchedules.list, { season: 2026 })).games,
    ).toEqual([])
    // Replaying a source creates no duplicate revision.
    await t.action(internal.basketballSchedules.refresh, {})
    expect(
      (await t.query(api.basketballSchedules.list, { season: 2026 })).revision,
    ).toBe(1)
    const corrected = { ...result.games[0], michiganScore: 91 }
    const {
      _id: ignoredId,
      _creationTime: ignoredTime,
      season: ignoredSeason,
      ...row
    } = corrected
    void ignoredId
    void ignoredTime
    void ignoredSeason
    expect(
      await t.mutation(internal.basketballSchedules.applyResults, {
        season: 2026,
        expectedRevision: 0,
        games: [row],
        sourceSha256: 'a'.repeat(64),
      }),
    ).toBe(false)
    expect(
      await t.mutation(internal.basketballSchedules.applyResults, {
        season: 2026,
        expectedRevision: 1,
        games: [row],
        sourceSha256: 'a'.repeat(64),
      }),
    ).toBe(true)
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('Unavailable', { status: 503 })),
      ),
    )
    await t.action(internal.basketballSchedules.refresh, {})
    expect(
      (await t.query(api.basketballSchedules.list, { season: 2026 })).games[0]
        .michiganScore,
    ).toBe(91)
    vi.setSystemTime(new Date('2026-11-04T16:05:00Z'))
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await t.action(internal.basketballSchedules.refresh, {})
    expect(fetcher).not.toHaveBeenCalled()
  },
)

test('registers the overnight basketball refresh alongside hockey', () => {
  // Convex exposes cron serialization at runtime but omits it from public types.
  const jobs = (crons as unknown as { export: () => string }).export()
  expect(jobs).toContain('basketballSchedules:refresh')
  expect(jobs).toContain('hockeyResults:refresh')
})
