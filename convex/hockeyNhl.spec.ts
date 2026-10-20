/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { api } from './_generated/api'
import schema from './schema'
import {
  candidateIds,
  matchesMichiganPlayer,
  normalizeNhlHistory,
} from './hockeyNhlModel'

const modules = import.meta.glob('./**/*.ts')
const college = {
  leagueAbbrev: 'NCAA',
  season: 20172018,
  teamName: { default: 'Univ. of Michigan' },
}
const nhl = {
  leagueAbbrev: 'NHL',
  season: 20232024,
  gameTypeId: 2,
  teamName: { default: 'Vancouver Canucks' },
  gamesPlayed: 82,
  goals: 17,
  assists: 75,
  points: 92,
}
const player = {
  playerId: 8480800,
  firstName: { default: 'Quinn' },
  lastName: { default: 'Hughes' },
  position: 'D',
  seasonTotals: [college, nhl],
  careerTotals: {
    regularSeason: { gamesPlayed: 365, goals: 43, assists: 290, points: 333 },
    playoffs: { gamesPlayed: 30, points: 26 },
  },
}
afterEach(() => vi.unstubAllGlobals())

describe('NHL career history', () => {
  test('matches full names and reviewed aliases, bounds ambiguity, and rejects malformed search', () => {
    expect(
      candidateIds(
        [
          { name: 'Joseph Cecconi', playerId: '123' },
          { name: 'Joe Smith', playerId: '456' },
        ],
        'Joe Cecconi',
      ),
    ).toEqual([123])
    expect(
      candidateIds(
        Array.from({ length: 4 }, (_, i) => ({
          name: 'Joe Cecconi',
          playerId: i + 1,
        })),
        'Joe Cecconi',
      ),
    ).toEqual([])
    expect(() => candidateIds({}, 'Joe Cecconi')).toThrow('Invalid NHL search')
  })
  test('requires Michigan attendance in the selected season, never Michigan State or a namesake', () => {
    expect(
      matchesMichiganPlayer(player, 8480800, 'Quinn Hughes', 2017, []),
    ).toBe(true)
    expect(
      matchesMichiganPlayer(
        {
          ...player,
          seasonTotals: [
            {
              ...college,
              leagueAbbrev: 'CCHA',
              teamName: { default: 'U. of Michigan' },
            },
          ],
        },
        8480800,
        'Quinn Hughes',
        2017,
        [],
      ),
    ).toBe(true)
    expect(
      matchesMichiganPlayer(player, 8480800, 'Quinn Hughes', 2026, []),
    ).toBe(false)
    expect(
      matchesMichiganPlayer(player, 8480801, 'Quinn Hughes', 2017, []),
    ).toBe(false)
    expect(
      matchesMichiganPlayer(
        {
          ...player,
          seasonTotals: [
            { ...college, teamName: { default: 'Michigan State Univ.' } },
          ],
        },
        8480800,
        'Quinn Hughes',
        2017,
        [],
      ),
    ).toBe(false)
  })
  test('can corroborate incoming players by a verified draft pick but rejects the wrong era', () => {
    const draft = {
      playerName: 'Quinn Hughes',
      year: 2018,
      round: 1,
      overallPick: 7,
      nhlTeam: 'Vancouver Canucks',
      priorToMichigan: false,
      sourceUrl: 'source',
      sourceSha256: 'hash',
    }
    const drafted = {
      ...player,
      draftDetails: { year: 2018, round: 1, overallPick: 7 },
      seasonTotals: [],
    }
    expect(
      matchesMichiganPlayer(drafted, 8480800, 'Quinn Hughes', 2017, [draft]),
    ).toBe(true)
    expect(
      matchesMichiganPlayer(drafted, 8480800, 'Quinn Hughes', 2027, [draft]),
    ).toBe(false)
    expect(
      matchesMichiganPlayer(
        { ...drafted, draftDetails: { year: 2018, round: 1, overallPick: 8 } },
        8480800,
        'Quinn Hughes',
        2017,
        [draft],
      ),
    ).toBe(false)
  })
  test('keeps NHL regular season and playoffs separate, retains traded clubs, uses official totals', () => {
    const data = normalizeNhlHistory(
      {
        ...player,
        seasonTotals: [
          college,
          nhl,
          { ...nhl, teamName: { default: 'Minnesota Wild' }, gamesPlayed: 10 },
          { ...nhl, teamName: { default: '2 Teams' }, gamesPlayed: 92 },
          { ...nhl, gameTypeId: 3, gamesPlayed: 13 },
          { ...nhl, leagueAbbrev: 'AHL' },
          { ...nhl, gameTypeId: 1 },
        ],
      },
      123,
    )
    expect(data.seasons).toHaveLength(3)
    expect(
      data.seasons.filter((row) => row.gameType === 2).map((row) => row.team),
    ).toEqual(['Minnesota Wild', 'Vancouver Canucks'])
    expect(data.regularSeason?.gamesPlayed).toBe(365)
    expect(data.playoffs?.gamesPlayed).toBe(30)
    expect(data.seasons[0].stats.pim).toBeNull()
    expect(data.fetchedAt).toBe(123)
  })
  test('retains goalie rate stats and confirmed zeros without inventing missing numbers', () => {
    const data = normalizeNhlHistory(
      {
        ...player,
        position: 'G',
        careerTotals: {
          regularSeason: {
            gamesPlayed: 1,
            wins: 0,
            savePctg: 1,
            goalsAgainstAvg: 0,
            shutouts: 0,
          },
        },
        seasonTotals: [college],
      },
      1,
    )
    expect(data.goalie).toBe(true)
    expect(data.regularSeason).toMatchObject({
      gamesPlayed: 1,
      wins: 0,
      savePctg: 1,
      goalsAgainstAvg: 0,
      points: null,
    })
    expect(data.playoffs).toBeNull()
    expect(() =>
      normalizeNhlHistory(
        { ...player, seasonTotals: [{ ...nhl, season: 20232025 }] },
        1,
      ),
    ).toThrow('Invalid NHL season')
  })
  test('looks up a saved roster identity with bounded requests, including undrafted alumni', async () => {
    const t = convexTest(schema, modules)
    const rosterId = await t.run((ctx) =>
      ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2017,
        values: { name: 'Quinn Hughes' },
        updatedAt: 1,
      }),
    )
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ name: 'Quinn Hughes', playerId: '8480800' }]),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(player)))
    vi.stubGlobal('fetch', fetchMock)
    const result = await t.action(api.hockeyNhl.forPlayer, { rosterId })
    expect(result.status).toBe('matched')
    expect(result.regularSeason?.points).toBe(333)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toContain('q=Hughes')
    expect(
      await t.run((ctx) => ctx.db.get('teamRosterEntries', rosterId)),
    ).toMatchObject({ values: { name: 'Quinn Hughes' }, updatedAt: 1 })
  })
  test('rejects other sports before any HTTP request and distinguishes no match from upstream failures', async () => {
    const t = convexTest(schema, modules)
    const [basketball, hockey] = await t.run(async (ctx) => [
      await ctx.db.insert('teamRosterEntries', {
        sport: 'basketball',
        season: 2017,
        values: { name: 'Quinn Hughes' },
        updatedAt: 1,
      }),
      await ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2017,
        values: { name: 'Quinn Hughes' },
        updatedAt: 1,
      }),
    ])
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      t.action(api.hockeyNhl.forPlayer, { rosterId: basketball }),
    ).rejects.toThrow('Hockey roster player not found')
    expect(fetchMock).not.toHaveBeenCalled()
    fetchMock.mockResolvedValueOnce(new Response('[]'))
    expect(
      await t.action(api.hockeyNhl.forPlayer, { rosterId: hockey }),
    ).toMatchObject({ status: 'unmatched', regularSeason: null, seasons: [] })
    fetchMock.mockResolvedValueOnce(new Response('down', { status: 503 }))
    await expect(
      t.action(api.hockeyNhl.forPlayer, { rosterId: hockey }),
    ).rejects.toThrow('temporarily unavailable')
  })
  test('does not choose between two corroborated profiles', async () => {
    const t = convexTest(schema, modules)
    const rosterId = await t.run((ctx) =>
      ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2017,
        values: { name: 'Quinn Hughes' },
        updatedAt: 1,
      }),
    )
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify([
              { name: 'Quinn Hughes', playerId: '8480800' },
              { name: 'Quinn Hughes', playerId: '8480801' },
            ]),
          ),
        )
        .mockResolvedValueOnce(new Response(JSON.stringify(player)))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ ...player, playerId: 8480801 })),
        ),
    )
    expect((await t.action(api.hockeyNhl.forPlayer, { rosterId })).status).toBe(
      'unmatched',
    )
  })
})
