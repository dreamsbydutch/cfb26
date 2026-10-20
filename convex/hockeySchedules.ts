import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import schema from './schema'
import {
  hockeyGame,
  hockeyScheduleUrl,
  normalizeHockeyGame,
  validateHockeyGames,
  validateHockeySeason,
} from './hockeyScheduleFields'
import { requireOwnerSession } from './rosterAdmin'
import type { Infer } from 'convex/values'

export const list = query({
  args: { season: v.number() },
  returns: v.object({
    revision: v.number(),
    sourceUrl: v.union(v.string(), v.null()),
    importedAt: v.union(v.number(), v.null()),
    games: v.array(schema.doc('hockeyScheduleGames')),
  }),
  handler: async (ctx, { season }) => {
    validateHockeySeason(season)
    const latest = await ctx.db
      .query('hockeyScheduleImports')
      .withIndex('by_season', (q) => q.eq('season', season))
      .order('desc')
      .first()
    const games = await ctx.db
      .query('hockeyScheduleGames')
      .withIndex('by_season', (q) => q.eq('season', season))
      .take(81)
    return {
      revision: latest?.revision ?? 0,
      sourceUrl: latest?.sourceUrl ?? null,
      importedAt: latest?.importedAt ?? null,
      games: games.sort(
        (a, b) =>
          a.date.localeCompare(b.date) ||
          Number(a.sourceGameId) - Number(b.sourceGameId),
      ),
    }
  },
})

export const importSeason = mutation({
  args: {
    season: v.number(),
    sessionToken: v.string(),
    expectedRevision: v.number(),
    sourceSha256: v.string(),
    games: v.array(hockeyGame),
  },
  returns: v.object({
    revision: v.number(),
    saved: v.number(),
    unchanged: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    validateHockeyGames(args.season, args.games)
    const games = args.games.map(normalizeHockeyGame)
    validateHockeyGames(args.season, games)
    if (!/^[a-f0-9]{64}$/.test(args.sourceSha256))
      throw new Error('Source SHA-256 is required.')
    const latest = await ctx.db
      .query('hockeyScheduleImports')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .order('desc')
      .first()
    if ((latest?.revision ?? 0) !== args.expectedRevision)
      throw new Error('Schedule changed. Reload before importing.')
    const existing = await ctx.db
      .query('hockeyScheduleGames')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .take(81)
    if (
      existing.some(
        (game) => !games.some((row) => row.sourceGameId === game.sourceGameId),
      )
    )
      throw new Error('Import cannot remove previously recorded games.')
    const sameGame = (
      game: (typeof existing)[number],
      row: Infer<typeof hockeyGame>,
    ) =>
      Object.keys(hockeyGame.fields).every(
        (key) => game[key as keyof typeof row] === row[key as keyof typeof row],
      )
    if (
      latest?.sourceSha256 === args.sourceSha256 &&
      existing.length === games.length &&
      games.every((row) => existing.some((game) => sameGame(game, row)))
    )
      return { revision: latest.revision, saved: 0, unchanged: true }
    for (const row of games) {
      const current = existing.find(
        (game) => game.sourceGameId === row.sourceGameId,
      )
      if (current) await ctx.db.patch('hockeyScheduleGames', current._id, row)
      else
        await ctx.db.insert('hockeyScheduleGames', {
          ...row,
          season: args.season,
        })
    }
    const revision = args.expectedRevision + 1
    await ctx.db.insert('hockeyScheduleImports', {
      season: args.season,
      revision,
      sourceSha256: args.sourceSha256,
      sourceUrl: hockeyScheduleUrl(args.season),
      gameCount: games.length,
      importedAt: Date.now(),
      sessionId: session._id,
    })
    return { revision, saved: games.length, unchanged: false }
  },
})
