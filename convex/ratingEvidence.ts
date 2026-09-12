import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { createCfbdClient } from './cfbdClient'
import { gameEvidenceValidator } from './evidenceFields'
import { aggregateCompetitiveDrives } from './gameEvidence'
import schema from './schema'
import type { EfficiencyUnit, GameEvidence } from './gameEvidence'

function unit(row: Record<string, unknown>): EfficiencyUnit | undefined {
  const { ppa, successRate, plays, drives } = row
  if (
    typeof ppa !== 'number' ||
    typeof successRate !== 'number' ||
    typeof plays !== 'number' ||
    typeof drives !== 'number' ||
    ![ppa, successRate, plays, drives].every(Number.isFinite) ||
    Math.abs(ppa) > 5 ||
    successRate < 0 ||
    successRate > 1 ||
    plays <= 0 ||
    drives < 0
  )
    return undefined
  return { ppa, successRate, plays, drives }
}

export const seasonData = internalQuery({
  args: { season: v.number() },
  returns: v.object({
    games: v.array(schema.doc('collegeGames')),
    profiles: v.array(schema.doc('teamSeasonProfiles')),
    programs: v.array(schema.doc('programs')),
  }),
  handler: async (ctx, args) => {
    const [games, profiles, programs] = await Promise.all([
      ctx.db
        .query('collegeGames')
        .withIndex('by_season_and_startTime', (q) =>
          q.eq('season', args.season),
        )
        .take(2501),
      ctx.db
        .query('teamSeasonProfiles')
        .withIndex('by_season_and_recruitingRank', (q) =>
          q.eq('season', args.season),
        )
        .take(601),
      ctx.db.query('programs').withIndex('by_key').take(1001),
    ])
    if (games.length > 2500 || profiles.length > 600 || programs.length > 1000)
      throw new Error('Research slice exceeds its bound.')
    return { games, profiles, programs }
  },
})

/** Complete both opponent schedules and game evidence before the ratings cron. */
export const syncCurrentSeason = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const season = new Date().getUTCFullYear()
    await ctx.runAction(internal.games.syncFcsSeason, { season })
    await ctx.runAction(internal.ratingEvidence.syncSeason, { season })
    return null
  },
})

export const writeBatch = internalMutation({
  args: {
    rows: v.array(
      v.object({ sourceGameId: v.number(), evidence: gameEvidenceValidator }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    if (args.rows.length > 40)
      throw new Error('Evidence batch exceeds its bound.')
    let count = 0
    for (const row of args.rows) {
      const game = await ctx.db
        .query('collegeGames')
        .withIndex('by_sourceKey', (q) =>
          q.eq('sourceKey', `cfbd:game:${row.sourceGameId}`),
        )
        .unique()
      if (!game?.completed || game.startTime >= row.evidence.observedAt)
        continue
      if ((game.ratingEvidence?.observedAt ?? 0) > row.evidence.observedAt)
        continue
      await ctx.db.patch('collegeGames', game._id, {
        ratingEvidence: row.evidence,
      })
      count++
    }
    return count
  },
})

export const sourceAccess = internalAction({
  args: {},
  returns: v.object({
    remaining: v.union(v.number(), v.null()),
    limit: v.union(v.number(), v.null()),
  }),
  handler: async () => {
    if (!env.CFBD_API_KEY) throw new Error('CFBD is not configured.')
    const response = await fetch('https://api.collegefootballdata.com/info', {
      headers: { Authorization: `Bearer ${env.CFBD_API_KEY}` },
    })
    if (!response.ok)
      throw new Error(`CFBD quota check failed (${response.status}).`)
    const info: unknown = await response.json()
    if (typeof info !== 'object' || !info)
      throw new Error('Invalid CFBD quota response.')
    const data = info as Record<string, unknown>
    return {
      remaining:
        typeof data.remainingCalls === 'number' ? data.remainingCalls : null,
      limit: typeof data.monthlyLimit === 'number' ? data.monthlyLimit : null,
    }
  },
})

export const syncSeason = internalAction({
  args: { season: v.number(), week: v.optional(v.number()) },
  returns: v.object({
    games: v.number(),
    advancedRows: v.number(),
    drives: v.number(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ games: number; advancedRows: number; drives: number }> => {
    if (
      !Number.isInteger(args.season) ||
      args.season < 2000 ||
      args.season > new Date().getUTCFullYear()
    )
      throw new Error('Invalid season.')
    if (
      args.week !== undefined &&
      (!Number.isInteger(args.week) || args.week < 1 || args.week > 30)
    )
      throw new Error('Invalid week.')
    if (!env.CFBD_API_KEY) throw new Error('CFBD is not configured.')
    const startedAt = Date.now(),
      client = createCfbdClient({ apiKey: env.CFBD_API_KEY })
    await ctx.runMutation(internal.teamData.beginSync, {
      source: 'rating_inputs',
      startedAt,
    })
    try {
      const data = await ctx.runQuery(internal.ratingEvidence.seasonData, {
        season: args.season,
      })
      const [advanced, drives] = await Promise.all([
        client.getAdvancedGameStats(args),
        client.getDrives(args),
      ])
      if (!advanced.length || !drives.length)
        throw new Error(
          'Game evidence feed is empty; retaining last valid inputs.',
        )
      const competitive = aggregateCompetitiveDrives(drives)
      const gamesById = new Map(data.games.map((g) => [g.sourceGameId, g]))
      const evidence = new Map<number, GameEvidence>()
      for (const row of advanced) {
        const game = gamesById.get(row.gameId)
        if (!game?.completed || row.season !== args.season) continue
        const side =
          row.team === game.homeSourceName
            ? 'home'
            : row.team === game.awaySourceName
              ? 'away'
              : undefined
        if (!side)
          throw new Error(
            `Advanced evidence team does not match game ${row.gameId}.`,
          )
        const parsed = unit(row.offense)
        if (!parsed) continue
        const entry = evidence.get(row.gameId) ?? {
          version: 'competitive-v1',
          observedAt: startedAt,
          ...competitive.get(row.gameId),
        }
        if (entry[side])
          throw new Error(
            `Duplicate advanced team/game evidence ${row.gameId}.`,
          )
        entry[side] = parsed
        evidence.set(row.gameId, entry)
      }
      const rows = [...evidence].map(([sourceGameId, entry]) => ({
        sourceGameId,
        evidence: entry,
      }))
      let count = 0
      for (let i = 0; i < rows.length; i += 40)
        count += await ctx.runMutation(internal.ratingEvidence.writeBatch, {
          rows: rows.slice(i, i + 40),
        })
      if (!count) throw new Error('No game evidence matched completed games.')
      await ctx.runMutation(internal.teamData.completeSync, {
        source: 'rating_inputs',
        completedAt: Date.now(),
        fetchedRows: advanced.length,
        acceptedRows: count,
        rejectedRows: 0,
      })
      return {
        games: count,
        advancedRows: advanced.length,
        drives: drives.length,
      }
    } catch (error) {
      await ctx.runMutation(internal.teamData.failSync, {
        source: 'rating_inputs',
        completedAt: Date.now(),
        error:
          error instanceof Error
            ? error.message
            : 'Game evidence synchronization failed.',
      })
      throw error
    }
  },
})
