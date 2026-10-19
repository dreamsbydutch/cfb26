/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import { api, internal } from './_generated/api'
import schema from './schema'
import { HOCKEY_DRAFT_SOURCE } from './hockeyDraftFields'

const modules = import.meta.glob('./**/*.ts')
const draft = {
  playerName: 'Joe Cecconi',
  year: 2015,
  round: 5,
  overallPick: 133,
  nhlTeam: 'Dallas Stars',
  priorToMichigan: true,
  sourceUrl: HOCKEY_DRAFT_SOURCE,
  sourceSha256: 'a'.repeat(64),
}

describe('sourced hockey NHL draft history', () => {
  test('one selection follows a player across seasons without changing roster fields or revisions', async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => {
      const a = await ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2015,
        values: { name: 'Joseph Cecconi', games: 10 },
        updatedAt: 1,
      })
      const b = await ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2016,
        values: { name: 'Joseph Cecconi', games: 30 },
        updatedAt: 1,
      })
      await ctx.db.insert('teamRosterEntries', {
        sport: 'basketball',
        season: 2015,
        values: { name: 'Joseph Cecconi' },
        updatedAt: 1,
      })
      return [a, b]
    })
    const before = await t.query(api.teamRosters.list, {
      sport: 'hockey',
      season: 2015,
    })
    expect(
      await t.mutation(internal.hockeyDrafts.importMatched, {
        rows: [{ draft, rosterIds: ids }],
      }),
    ).toEqual({ saved: 1, unchanged: 0, matchedRosterEntries: 2 })
    expect(
      await t.mutation(internal.hockeyDrafts.importMatched, {
        rows: [{ draft, rosterIds: ids }],
      }),
    ).toEqual({ saved: 0, unchanged: 1, matchedRosterEntries: 2 })
    expect(
      await t.query(api.teamRosters.list, { sport: 'hockey', season: 2015 }),
    ).toEqual(before)
    for (const season of [2015, 2016])
      expect(
        (await t.query(api.hockeyDrafts.forSeason, { season }))[0].selections,
      ).toEqual([draft])
    expect(await t.query(api.hockeyDrafts.forSeason, { season: 2017 })).toEqual(
      [],
    )
  })

  test('rejects unrelated, cross-sport, duplicate and malformed selections atomically', async () => {
    const t = convexTest(schema, modules)
    const [hockey, basketball] = await t.run(async (ctx) => [
      await ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2015,
        values: { name: 'Joseph Cecconi' },
        updatedAt: 1,
      }),
      await ctx.db.insert('teamRosterEntries', {
        sport: 'basketball',
        season: 2015,
        values: { name: 'Joe Cecconi' },
        updatedAt: 1,
      }),
    ])
    await expect(
      t.mutation(internal.hockeyDrafts.importMatched, {
        rows: [{ draft, rosterIds: [basketball] }],
      }),
    ).rejects.toThrow('match')
    await expect(
      t.mutation(internal.hockeyDrafts.importMatched, {
        rows: [
          {
            draft: { ...draft, playerName: 'Other player' },
            rosterIds: [hockey],
          },
        ],
      }),
    ).rejects.toThrow('match')
    await expect(
      t.mutation(internal.hockeyDrafts.importMatched, {
        rows: [
          { draft, rosterIds: [hockey] },
          { draft, rosterIds: [hockey] },
        ],
      }),
    ).rejects.toThrow('Duplicate')
    expect(
      await t.run((ctx) => ctx.db.query('hockeyDraftSelections').take(10)),
    ).toEqual([])
    await expect(
      t.mutation(internal.hockeyDrafts.importMatched, {
        rows: [{ draft: { ...draft, round: 8 }, rosterIds: [hockey] }],
      }),
    ).rejects.toThrow('Invalid')
  })

  test('unmatched roster players remain unknown and pick collisions fail', async () => {
    const t = convexTest(schema, modules)
    const ids = await t.run(async (ctx) => [
      await ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2015,
        values: { name: 'Joseph Cecconi' },
        updatedAt: 1,
      }),
      await ctx.db.insert('teamRosterEntries', {
        sport: 'hockey',
        season: 2015,
        values: { name: 'Other player' },
        updatedAt: 1,
      }),
    ])
    await t.mutation(internal.hockeyDrafts.importMatched, {
      rows: [{ draft, rosterIds: [ids[0]] }],
    })
    await expect(
      t.mutation(internal.hockeyDrafts.importMatched, {
        rows: [
          {
            draft: { ...draft, playerName: 'Other player' },
            rosterIds: [ids[1]],
          },
        ],
      }),
    ).rejects.toThrow('different player')
    expect(
      (await t.query(api.hockeyDrafts.forSeason, { season: 2015 })).find(
        (row) => row.playerKey === 'otherplayer',
      )?.selections,
    ).toEqual([])
  })
})
