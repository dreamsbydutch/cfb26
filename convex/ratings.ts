import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  env,
  internalAction,
  internalMutation,
  query,
} from './_generated/server'
import { resolveProgram } from './programIdentity'

const CFBD_ELO_URL = 'https://api.collegefootballdata.com/ratings/elo'
const BATCH_SIZE = 50
const DAY_MS = 24 * 60 * 60 * 1000
const HOME_FIELD_ADVANTAGE = 55

type SourceRow = Record<string, unknown>

const ratingRowValidator = v.object({
  conference: v.optional(v.string()),
  rating: v.number(),
  season: v.number(),
  sourceKey: v.string(),
  sourceProgramName: v.string(),
})

function sourceRows(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error('CFBD /ratings/elo returned a non-array JSON document.')
  }
  return value.map((row, index) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`CFBD rating row ${index + 1} is not an object.`)
    }
    return row as SourceRow
  })
}

function requiredString(row: SourceRow, field: string) {
  const value = row[field]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid or missing rating ${field}.`)
  }
  return value.trim()
}

function optionalString(row: SourceRow, field: string) {
  const value = row[field]
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`Invalid rating ${field}.`)
  return value.trim() || undefined
}

function requiredNumber(row: SourceRow, field: string) {
  const value = row[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid or missing rating ${field}.`)
  }
  return value
}

function parseRatings(rows: Array<SourceRow>) {
  const accepted = []
  let rejected = 0
  for (const row of rows) {
    if (row.elo === null || row.elo === undefined) {
      rejected += 1
      continue
    }
    const season = requiredNumber(row, 'year')
    const sourceProgramName = requiredString(row, 'team')
    accepted.push({
      conference: optionalString(row, 'conference'),
      rating: requiredNumber(row, 'elo'),
      season,
      sourceKey: `cfbd:rating:${season}:${sourceProgramName.toLowerCase()}`,
      sourceProgramName,
    })
  }
  return { accepted, rejected }
}

async function fetchRatings(key: string, season: number) {
  const response = await fetch(`${CFBD_ELO_URL}?year=${season}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!response.ok) {
    throw new Error(
      `CFBD /ratings/elo?year=${season} failed with HTTP ${response.status}.`,
    )
  }
  return sourceRows(await response.json())
}

export const upsertBatch = internalMutation({
  args: {
    rows: v.array(ratingRowValidator),
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const programId = await resolveProgram(
        ctx,
        'ratings',
        row.sourceProgramName,
      )
      const existing = await ctx.db
        .query('teamSeasonRatings')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', row.sourceKey))
        .unique()
      const document = {
        ...row,
        programId,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }
      if (existing)
        await ctx.db.replace('teamSeasonRatings', existing._id, document)
      else await ctx.db.insert('teamSeasonRatings', document)
    }
  },
})

export const syncRange = internalAction({
  args: { endSeason: v.number(), startSeason: v.number() },
  handler: async (ctx, args) => {
    const startSeason = Math.floor(args.startSeason)
    const endSeason = Math.floor(args.endSeason)
    if (endSeason < startSeason || endSeason - startSeason >= 5) {
      throw new Error('Rating sync must include between one and five seasons.')
    }
    const key = env.CFBD_API_KEY
    if (!key) return { acceptedRows: 0, configured: false, rejectedRows: 0 }

    const startedAt = Date.now()
    await ctx.runMutation(internal.teamData.beginSync, {
      source: 'ratings',
      startedAt,
    })
    let acceptedRows = 0
    let fetchedRows = 0
    let rejectedRows = 0
    try {
      for (let season = startSeason; season <= endSeason; season += 1) {
        const source = await fetchRatings(key, season)
        const parsed = parseRatings(source)
        fetchedRows += source.length
        rejectedRows += parsed.rejected
        for (
          let offset = 0;
          offset < parsed.accepted.length;
          offset += BATCH_SIZE
        ) {
          await ctx.runMutation(internal.ratings.upsertBatch, {
            rows: parsed.accepted.slice(offset, offset + BATCH_SIZE),
            sourceUpdatedAt: startedAt,
          })
        }
        acceptedRows += parsed.accepted.length
      }
      await ctx.runMutation(internal.teamData.completeSync, {
        acceptedRows,
        completedAt: Date.now(),
        fetchedRows,
        rejectedRows,
        source: 'ratings',
      })
      return { acceptedRows, configured: true, rejectedRows }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await ctx.runMutation(internal.teamData.failSync, {
        completedAt: Date.now(),
        error: message,
        source: 'ratings',
      })
      throw error
    }
  },
})

const boundedLimit = (limit: number | undefined, fallback: number) =>
  Math.min(Math.max(Math.floor(limit ?? fallback), 1), 200)

export const list = query({
  args: { limit: v.optional(v.number()), season: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('teamSeasonRatings')
      .withIndex('by_season_and_rating', (q) =>
        q.eq('season', Math.floor(args.season)),
      )
      .order('desc')
      .take(boundedLimit(args.limit, 150))
    return rows.map((row, index) => ({ ...row, rank: index + 1 }))
  },
})

function clampScore(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100)
}

function teamStrength(rating: number) {
  return Math.min(Math.max((rating - 1300) / 6, 0), 100)
}

function isBigTen(conference: string | undefined) {
  const normalized = conference?.toLowerCase().replace(/[^a-z0-9]/g, '')
  return normalized === 'bigten' || normalized === 'big10'
}

export const getWeeklyDashboard = query({
  args: {
    season: v.optional(v.number()),
    week: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const season = Math.floor(args.season ?? new Date().getUTCFullYear())
    let week = args.week === undefined ? undefined : Math.floor(args.week)
    if (week !== undefined && (week < 0 || week > 30)) {
      throw new Error('Week must be between 0 and 30.')
    }
    if (week === undefined) {
      const now = Date.now()
      const [previous, next] = await Promise.all([
        ctx.db
          .query('collegeGames')
          .withIndex('by_season_and_startTime', (q) =>
            q.eq('season', season).lte('startTime', now),
          )
          .order('desc')
          .first(),
        ctx.db
          .query('collegeGames')
          .withIndex('by_season_and_startTime', (q) =>
            q.eq('season', season).gte('startTime', now),
          )
          .first(),
      ])
      week =
        next && next.startTime - now <= 4 * DAY_MS
          ? next.week
          : (previous?.week ?? next?.week ?? 1)
    }

    const [games, ratingRows, michigan] = await Promise.all([
      ctx.db
        .query('collegeGames')
        .withIndex('by_season_and_week_and_startTime', (q) =>
          q.eq('season', season).eq('week', week),
        )
        .take(200),
      ctx.db
        .query('teamSeasonRatings')
        .withIndex('by_season_and_rating', (q) => q.eq('season', season))
        .order('desc')
        .take(200),
      ctx.db
        .query('programs')
        .withIndex('by_key', (q) => q.eq('key', 'michigan'))
        .unique(),
    ])

    const ratings = ratingRows.map((row, index) => ({
      ...row,
      rank: index + 1,
    }))
    const ratingByProgram = new Map(
      ratings.map((row) => [String(row.programId), row]),
    )
    const michiganOpponents = new Set<string>()
    if (michigan) {
      const [homeGames, awayGames] = await Promise.all([
        ctx.db
          .query('collegeGames')
          .withIndex('by_homeProgramId_and_season', (q) =>
            q.eq('homeProgramId', michigan._id).eq('season', season),
          )
          .take(30),
        ctx.db
          .query('collegeGames')
          .withIndex('by_awayProgramId_and_season', (q) =>
            q.eq('awayProgramId', michigan._id).eq('season', season),
          )
          .take(30),
      ])
      for (const game of homeGames)
        michiganOpponents.add(String(game.awayProgramId))
      for (const game of awayGames)
        michiganOpponents.add(String(game.homeProgramId))
    }

    const scoredGames = games.map((game) => {
      const homeRatingRow = ratingByProgram.get(String(game.homeProgramId))
      const awayRatingRow = ratingByProgram.get(String(game.awayProgramId))
      const homeRating =
        homeRatingRow?.rating ??
        game.homePregameElo ??
        game.homePostgameElo ??
        1500
      const awayRating =
        awayRatingRow?.rating ??
        game.awayPregameElo ??
        game.awayPostgameElo ??
        1500
      const bestStrength = Math.max(
        teamStrength(homeRating),
        teamStrength(awayRating),
      )
      const otherStrength = Math.min(
        teamStrength(homeRating),
        teamStrength(awayRating),
      )
      const quality = bestStrength * 0.65 + otherStrength * 0.35
      const adjustedHomeRating =
        homeRating + (game.neutralSite ? 0 : HOME_FIELD_ADVANTAGE)
      const closeness =
        100 - Math.min(Math.abs(adjustedHomeRating - awayRating) / 4, 100)
      const nationalImportance = clampScore(quality * 0.7 + closeness * 0.3)

      const isMichiganGame =
        michigan !== null &&
        (game.homeProgramId === michigan._id ||
          game.awayProgramId === michigan._id)
      const homeIsOpponent = michiganOpponents.has(String(game.homeProgramId))
      const awayIsOpponent = michiganOpponents.has(String(game.awayProgramId))
      const opponentCount = Number(homeIsOpponent) + Number(awayIsOpponent)
      let michiganRelation = 'National landscape'
      let michiganImportance = nationalImportance * 0.15
      if (isMichiganGame) {
        michiganRelation = 'Michigan game'
        michiganImportance = 100
      } else if (opponentCount === 2) {
        michiganRelation = 'Two Michigan opponents'
        michiganImportance = 75 + nationalImportance * 0.2
      } else if (opponentCount === 1) {
        michiganRelation = 'Michigan opponent'
        michiganImportance = 48 + nationalImportance * 0.35
      } else if (
        isBigTen(game.homeConference) ||
        isBigTen(game.awayConference)
      ) {
        michiganRelation = 'Big Ten race'
        michiganImportance = 25 + nationalImportance * 0.3
      }

      return {
        ...game,
        awayRank: awayRatingRow?.rank,
        awayRating,
        homeRank: homeRatingRow?.rank,
        homeRating,
        michiganImportance: clampScore(michiganImportance),
        michiganRelation,
        nationalImportance,
      }
    })

    return {
      games: scoredGames,
      generatedAt: Date.now(),
      ratingCount: ratings.length,
      ratings,
      season,
      week,
    }
  },
})
