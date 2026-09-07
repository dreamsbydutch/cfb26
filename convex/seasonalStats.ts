import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { normalizePlayerGame, summarizePhaseGrades } from './playerDomain'
import { requireOwnerSession } from './rosterAdmin'
import type { Id } from './_generated/dataModel'

const nullableNumber = v.union(v.number(), v.null())
const phasePerformance = v.object({
  grade: nullableNumber,
  snaps: nullableNumber,
})
const sourceLink = v.object({ label: v.string(), url: v.string() })
const statistics = v.array(
  v.object({ category: v.string(), value: v.number() }),
)
const playerGameInput = {
  dataQuality: v.union(
    v.literal('owner_verified'),
    v.literal('source_verified'),
    v.literal('needs_review'),
  ),
  defense: phasePerformance,
  gameId: v.id('collegeGames'),
  offense: phasePerformance,
  playerId: v.id('players'),
  sourceLinks: v.array(sourceLink),
  specialTeams: phasePerformance,
  statistics,
}

function validateInput(args: {
  defense: { grade: number | null; snaps: number | null }
  offense: { grade: number | null; snaps: number | null }
  specialTeams: { grade: number | null; snaps: number | null }
  statistics: Array<{ category: string; value: number }>
}) {
  const categories = new Set<string>()
  for (const statistic of args.statistics) {
    const category = statistic.category.trim()
    if (!category || category.length > 80) {
      throw new Error('Statistic categories must be 1–80 characters.')
    }
    if (!Number.isFinite(statistic.value)) {
      throw new Error('Statistic values must be finite.')
    }
    if (categories.has(category)) {
      throw new Error(`Duplicate statistic category: ${category}.`)
    }
    categories.add(category)
  }
  return {
    defense: normalizePlayerGame(args.defense),
    offense: normalizePlayerGame(args.offense),
    specialTeams: normalizePlayerGame(args.specialTeams),
    statistics: args.statistics.map((statistic) => ({
      category: statistic.category.trim(),
      value: statistic.value,
    })),
  }
}

export const listBySeason = query({
  args: {
    programKey: v.optional(v.string()),
    season: v.number(),
  },
  handler: async (ctx, args) => {
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', args.programKey ?? 'michigan'))
      .unique()
    if (!program) return []
    const games = await ctx.db
      .query('playerGames')
      .withIndex('by_programId_and_season', (q) =>
        q.eq('programId', program._id).eq('season', args.season),
      )
      .take(500)
    const byPlayer = new Map<Id<'players'>, typeof games>()
    for (const game of games) {
      const rows = byPlayer.get(game.playerId) ?? []
      rows.push(game)
      byPlayer.set(game.playerId, rows)
    }
    return Promise.all(
      [...byPlayer.entries()].map(async ([playerId, rows]) => ({
        phases: {
          defense: summarizePhaseGrades(rows.map((row) => row.defense)),
          offense: summarizePhaseGrades(rows.map((row) => row.offense)),
          specialTeams: summarizePhaseGrades(
            rows.map((row) => row.specialTeams),
          ),
        },
        player: await ctx.db.get('players', playerId),
        playerGames: rows,
      })),
    )
  },
})

export const listGame = query({
  args: { gameId: v.id('collegeGames') },
  handler: async (ctx, args) => {
    const game = await ctx.db.get('collegeGames', args.gameId)
    if (!game) return null
    const rows = await ctx.db
      .query('playerGames')
      .withIndex('by_gameId_and_playerId', (q) => q.eq('gameId', args.gameId))
      .take(200)
    return {
      game,
      players: await Promise.all(
        rows.map(async (row) => ({
          player: await ctx.db.get('players', row.playerId),
          record: row,
        })),
      ),
    }
  },
})

export const upsertPlayerGame = mutation({
  args: { ...playerGameInput, sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const [player, game, program] = await Promise.all([
      ctx.db.get('players', args.playerId),
      ctx.db.get('collegeGames', args.gameId),
      ctx.db
        .query('programs')
        .withIndex('by_key', (q) => q.eq('key', 'michigan'))
        .unique(),
    ])
    if (!player || !game || !program)
      throw new Error('Player or game was not found.')
    if (
      game.homeProgramId !== program._id &&
      game.awayProgramId !== program._id
    ) {
      throw new Error('Player Games are limited to Michigan games.')
    }
    const normalized = validateInput(args)
    const document = {
      dataQuality: args.dataQuality,
      defense: normalized.defense,
      gameId: game._id,
      offense: normalized.offense,
      playerId: player._id,
      programId: program._id,
      season: game.season,
      sourceLinks: args.sourceLinks,
      specialTeams: normalized.specialTeams,
      statistics: normalized.statistics,
      updatedAt: Date.now(),
    }
    const existing = await ctx.db
      .query('playerGames')
      .withIndex('by_playerId_and_gameId', (q) =>
        q.eq('playerId', player._id).eq('gameId', game._id),
      )
      .unique()
    if (existing) {
      await ctx.db.replace('playerGames', existing._id, document)
      return existing._id
    }
    return ctx.db.insert('playerGames', document)
  },
})

export const previewImport = query({
  args: {
    rows: v.array(v.object(playerGameInput)),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    if (args.rows.length > 200)
      throw new Error('Import is limited to 200 rows.')
    return args.rows.map((row, index) => {
      try {
        validateInput(row)
        return { errors: [], index, valid: true }
      } catch (error) {
        return {
          errors: [error instanceof Error ? error.message : 'Invalid row.'],
          index,
          valid: false,
        }
      }
    })
  },
})

export const applyImport = mutation({
  args: {
    backupManifestId: v.id('backupManifests'),
    rows: v.array(v.object(playerGameInput)),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    if (args.rows.length > 200)
      throw new Error('Import is limited to 200 rows.')
    if (!(await ctx.db.get('backupManifests', args.backupManifestId))) {
      throw new Error('A verified backup manifest is required.')
    }
    const operationId = await ctx.db.insert('operationRuns', {
      backupManifestId: args.backupManifestId,
      completedAt: null,
      errors: [],
      fingerprint: `player-game-import:${Date.now()}:${args.rows.length}`,
      kind: 'bulk_import',
      startedAt: Date.now(),
      status: 'running',
      warnings: [],
    })
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', 'michigan'))
      .unique()
    if (!program) throw new Error('Michigan was not found.')
    let upserted = 0
    for (const row of args.rows) {
      const [player, game] = await Promise.all([
        ctx.db.get('players', row.playerId),
        ctx.db.get('collegeGames', row.gameId),
      ])
      if (!player || !game) throw new Error('Import identity was not found.')
      if (
        game.homeProgramId !== program._id &&
        game.awayProgramId !== program._id
      ) {
        throw new Error('Player Games are limited to Michigan games.')
      }
      const normalized = validateInput(row)
      const document = {
        dataQuality: row.dataQuality,
        defense: normalized.defense,
        gameId: game._id,
        offense: normalized.offense,
        playerId: player._id,
        programId: program._id,
        season: game.season,
        sourceLinks: row.sourceLinks,
        specialTeams: normalized.specialTeams,
        statistics: normalized.statistics,
        updatedAt: Date.now(),
      }
      const existing = await ctx.db
        .query('playerGames')
        .withIndex('by_playerId_and_gameId', (q) =>
          q.eq('playerId', player._id).eq('gameId', game._id),
        )
        .unique()
      if (existing) await ctx.db.replace('playerGames', existing._id, document)
      else await ctx.db.insert('playerGames', document)
      upserted += 1
    }
    await ctx.db.patch('operationRuns', operationId, {
      completedAt: Date.now(),
      status: 'succeeded',
    })
    return { upserted }
  },
})
