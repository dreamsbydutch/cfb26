import { v } from 'convex/values'
import { internal } from './_generated/api'
import { easternRunAt, parseHockeySchedule } from './hockeyResultModel'
import { fetchOfficial } from './hockeyResults'
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import schema from './schema'
import {
  basketballGame,
  basketballScheduleUrl,
  validateBasketballGames,
  validateBasketballSeason,
} from './basketballScheduleFields'
import { requireOwnerSession } from './rosterAdmin'
import type { Doc } from './_generated/dataModel'
import type { Infer } from 'convex/values'

export const list = query({
  args: { season: v.number() },
  returns: v.object({
    revision: v.number(),
    sourceUrl: v.union(v.string(), v.null()),
    importedAt: v.union(v.number(), v.null()),
    games: v.array(schema.doc('basketballScheduleGames')),
  }),
  handler: async (ctx, { season }) => {
    validateBasketballSeason(season)
    const latest = await ctx.db
      .query('basketballScheduleImports')
      .withIndex('by_season', (q) => q.eq('season', season))
      .order('desc')
      .first()
    const games = await ctx.db
      .query('basketballScheduleGames')
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
    games: v.array(basketballGame),
  },
  returns: v.object({
    revision: v.number(),
    saved: v.number(),
    unchanged: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    validateBasketballGames(args.season, args.games)
    if (!/^[a-f0-9]{64}$/.test(args.sourceSha256))
      throw new Error('Source SHA-256 is required.')
    const latest = await ctx.db
      .query('basketballScheduleImports')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .order('desc')
      .first()
    if ((latest?.revision ?? 0) !== args.expectedRevision)
      throw new Error('Schedule changed. Reload before importing.')
    const existing = await ctx.db
      .query('basketballScheduleGames')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .take(81)
    if (
      existing.some(
        (game) =>
          !args.games.some((row) => row.sourceGameId === game.sourceGameId),
      )
    )
      throw new Error('Import cannot remove previously recorded games.')
    const sameGame = (
      game: (typeof existing)[number],
      row: Infer<typeof basketballGame>,
    ) =>
      Object.keys(basketballGame.fields).every(
        (key) => game[key as keyof typeof row] === row[key as keyof typeof row],
      )
    if (
      latest?.sourceSha256 === args.sourceSha256 &&
      existing.length === args.games.length &&
      args.games.every((row) => existing.some((game) => sameGame(game, row)))
    )
      return { revision: latest.revision, saved: 0, unchanged: true }
    for (const row of args.games) {
      const current = existing.find(
        (game) => game.sourceGameId === row.sourceGameId,
      )
      if (current)
        await ctx.db.patch('basketballScheduleGames', current._id, row)
      else
        await ctx.db.insert('basketballScheduleGames', {
          ...row,
          season: args.season,
        })
    }
    const revision = args.expectedRevision + 1
    await ctx.db.insert('basketballScheduleImports', {
      season: args.season,
      revision,
      sourceSha256: args.sourceSha256,
      sourceUrl: basketballScheduleUrl(args.season),
      gameCount: args.games.length,
      importedAt: Date.now(),
      sessionId: session._id,
    })
    return { revision, saved: args.games.length, unchanged: false }
  },
})

// Same overnight window as hockey. Fetch once per season, never once per viewer.
export const refresh = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const run = easternRunAt(Date.now())
    if (run.hour < 3 || run.hour > 6) return null
    for (const season of [run.season, run.season - 1]) {
      const saved = await ctx.runQuery(
        internal.basketballSchedules.refreshSnapshot,
        { season },
      )
      const earliest = new Date(
        Date.parse(`${run.today}T00:00:00Z`) - 14 * 86400000,
      )
        .toISOString()
        .slice(0, 10)
      const candidates = saved.games.filter(
        (g) =>
          g.date >= earliest &&
          g.date <= run.yesterday &&
          !['cancelled', 'no_contest'].includes(g.status),
      )
      if (!candidates.length) continue
      try {
        const source = await fetchOfficial(basketballScheduleUrl(season))
        const games: Array<Infer<typeof basketballGame>> = []
        for (const current of candidates) {
          const next = parseHockeySchedule(
            source.html,
            season,
            current.sourceGameId,
            'basketball',
          )
          if (
            next.status !== 'final' ||
            next.result === 'T' ||
            next.result === null
          )
            continue
          if (
            next.date !== current.date ||
            next.opponentId !== current.opponentId ||
            next.exhibition !== current.exhibition
          )
            continue
          games.push({ ...next, result: next.result })
        }
        if (games.length)
          await ctx.runMutation(internal.basketballSchedules.applyResults, {
            season,
            expectedRevision: saved.revision,
            games,
            sourceSha256: source.source.sha256,
          })
      } catch (error) {
        // Preserve saved observations; the next hourly run retries delayed sources.
        console.warn(
          'Basketball result refresh failed',
          season,
          error instanceof Error ? error.message : 'Unknown error',
        )
      }
    }
    return null
  },
})

export const refreshSnapshot = internalQuery({
  args: { season: v.number() },
  handler: async (
    ctx,
    { season },
  ): Promise<{
    revision: number
    games: Array<Doc<'basketballScheduleGames'>>
  }> => {
    const latest = await ctx.db
      .query('basketballScheduleImports')
      .withIndex('by_season', (q) => q.eq('season', season))
      .order('desc')
      .first()
    const games = await ctx.db
      .query('basketballScheduleGames')
      .withIndex('by_season', (q) => q.eq('season', season))
      .take(81)
    return { revision: latest?.revision ?? 0, games }
  },
})

export const applyResults = internalMutation({
  args: {
    season: v.number(),
    expectedRevision: v.number(),
    games: v.array(basketballGame),
    sourceSha256: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    validateBasketballGames(args.season, args.games)
    if (!/^[a-f0-9]{64}$/.test(args.sourceSha256))
      throw new Error('Invalid source hash.')
    const latest = await ctx.db
      .query('basketballScheduleImports')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .order('desc')
      .first()
    if ((latest?.revision ?? 0) !== args.expectedRevision) return false
    const existing = await ctx.db
      .query('basketballScheduleGames')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .take(81)
    let changed = false
    for (const row of args.games) {
      const current = existing.find((g) => g.sourceGameId === row.sourceGameId)
      if (
        !current ||
        row.status !== 'final' ||
        current.date !== row.date ||
        current.opponentId !== row.opponentId ||
        current.exhibition !== row.exhibition
      )
        throw new Error('Result identity changed.')
      if (
        Object.keys(basketballGame.fields).every(
          (key) =>
            current[key as keyof typeof row] === row[key as keyof typeof row],
        )
      )
        continue
      await ctx.db.patch('basketballScheduleGames', current._id, row)
      changed = true
    }
    if (changed)
      await ctx.db.insert('basketballScheduleImports', {
        season: args.season,
        revision: args.expectedRevision + 1,
        sourceSha256: args.sourceSha256,
        sourceUrl: basketballScheduleUrl(args.season),
        gameCount: existing.length,
        importedAt: Date.now(),
        automated: true,
      })
    return changed
  },
})
