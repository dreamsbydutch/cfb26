import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  env,
  internalAction,
  internalMutation,
  query,
} from './_generated/server'
import { resolveProgram } from './programIdentity'
import type { ActionCtx } from './_generated/server'

const CFBD_BASE_URL = 'https://api.collegefootballdata.com'
const DEFAULT_HISTORY_START_SEASON = 2000
const DETAILED_SEASON_COUNT = 5
const BATCH_SIZE = 40

type SourceRow = Record<string, unknown>
type RatingSyncResult = {
  acceptedRows: number
  configured: boolean
  rejectedRows: number
}
type BackfillResult = {
  endSeason: number
  games: number
  ratings: number
  startSeason: number
  stats: number
  statsStartSeason: number | null
}
type CurrentSyncResult = {
  configured: boolean
  games: number
  ratings: number
  stats: number
}
type SeasonWeeks = { season: number; weeks: Array<number> }

const seasonTypeValidator = v.union(
  v.literal('regular'),
  v.literal('postseason'),
)

const homeAwayValidator = v.union(v.literal('home'), v.literal('away'))

const gameRowValidator = v.object({
  attendance: v.optional(v.number()),
  awayClassification: v.optional(v.string()),
  awayConference: v.optional(v.string()),
  awayLineScores: v.optional(v.array(v.number())),
  awayName: v.string(),
  awayPoints: v.optional(v.number()),
  awayPostgameElo: v.optional(v.number()),
  awayPregameElo: v.optional(v.number()),
  awaySourceId: v.number(),
  completed: v.boolean(),
  conferenceGame: v.boolean(),
  excitementIndex: v.optional(v.number()),
  homeClassification: v.optional(v.string()),
  homeConference: v.optional(v.string()),
  homeLineScores: v.optional(v.array(v.number())),
  homeName: v.string(),
  homePoints: v.optional(v.number()),
  homePostgameElo: v.optional(v.number()),
  homePregameElo: v.optional(v.number()),
  homeSourceId: v.number(),
  neutralSite: v.boolean(),
  notes: v.optional(v.string()),
  season: v.number(),
  seasonType: seasonTypeValidator,
  sourceGameId: v.number(),
  sourceKey: v.string(),
  startTime: v.number(),
  startTimeTbd: v.boolean(),
  tvOutlets: v.optional(v.array(v.string())),
  venue: v.optional(v.string()),
  venueId: v.optional(v.number()),
  week: v.number(),
})

const teamStatRowValidator = v.object({
  conference: v.optional(v.string()),
  homeAway: homeAwayValidator,
  opponentName: v.string(),
  points: v.optional(v.number()),
  programName: v.string(),
  season: v.number(),
  sourceGameId: v.number(),
  sourceKey: v.string(),
  sourceTeamId: v.number(),
  stats: v.array(v.object({ category: v.string(), value: v.string() })),
})

function sourceRows(value: unknown, endpoint: string): Array<SourceRow> {
  if (!Array.isArray(value)) {
    throw new Error(`${endpoint} returned a non-array JSON document.`)
  }
  return value.map((row, index) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`${endpoint} row ${index + 1} is not an object.`)
    }
    return row as SourceRow
  })
}

function requiredString(row: SourceRow, field: string) {
  const value = row[field]
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Invalid or missing ${field}.`)
  }
  return value.trim()
}

function optionalString(row: SourceRow, field: string) {
  const value = row[field]
  if (value === null || value === undefined || value === '') return undefined
  if (typeof value !== 'string') throw new Error(`Invalid ${field}.`)
  return value.trim() || undefined
}

function requiredNumber(row: SourceRow, field: string) {
  const value = row[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid or missing ${field}.`)
  }
  return value
}

function optionalNumber(row: SourceRow, field: string) {
  const value = row[field]
  if (value === null || value === undefined) return undefined
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Invalid ${field}.`)
  }
  return value
}

function requiredBoolean(row: SourceRow, field: string) {
  const value = row[field]
  if (typeof value !== 'boolean') throw new Error(`Invalid ${field}.`)
  return value
}

function optionalNumberArray(row: SourceRow, field: string) {
  const value = row[field]
  if (value === null || value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw new Error(`Invalid ${field}.`)
  }
  return value.map((item) => {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new Error(`Invalid ${field}.`)
    }
    return item
  })
}

function parseSeasonType(row: SourceRow): 'regular' | 'postseason' {
  const value = requiredString(row, 'seasonType')
  if (value === 'regular' || value === 'spring_regular') return 'regular'
  if (value === 'postseason' || value === 'spring_postseason') {
    return 'postseason'
  }
  throw new Error(`Invalid seasonType: ${value}.`)
}

function parseMedia(rows: Array<SourceRow>) {
  const outlets = new Map<number, Array<string>>()
  for (const row of rows) {
    if (requiredString(row, 'mediaType') !== 'tv') continue
    const gameId = requiredNumber(row, 'id')
    const outlet = requiredString(row, 'outlet')
    const existing = outlets.get(gameId) ?? []
    if (!existing.includes(outlet)) existing.push(outlet)
    outlets.set(gameId, existing)
  }
  return outlets
}

function parseGames(
  rows: Array<SourceRow>,
  mediaByGame?: ReadonlyMap<number, Array<string>>,
) {
  return rows.map((row) => {
    const sourceGameId = requiredNumber(row, 'id')
    const startDate = requiredString(row, 'startDate')
    const startTime = Date.parse(startDate)
    if (!Number.isFinite(startTime)) {
      throw new Error(`Game ${sourceGameId} has an invalid startDate.`)
    }
    return {
      attendance: optionalNumber(row, 'attendance'),
      awayClassification: optionalString(row, 'awayClassification'),
      awayConference: optionalString(row, 'awayConference'),
      awayLineScores: optionalNumberArray(row, 'awayLineScores'),
      awayName: requiredString(row, 'awayTeam'),
      awayPoints: optionalNumber(row, 'awayPoints'),
      awayPostgameElo: optionalNumber(row, 'awayPostgameElo'),
      awayPregameElo: optionalNumber(row, 'awayPregameElo'),
      awaySourceId: requiredNumber(row, 'awayId'),
      completed: requiredBoolean(row, 'completed'),
      conferenceGame: requiredBoolean(row, 'conferenceGame'),
      excitementIndex: optionalNumber(row, 'excitementIndex'),
      homeClassification: optionalString(row, 'homeClassification'),
      homeConference: optionalString(row, 'homeConference'),
      homeLineScores: optionalNumberArray(row, 'homeLineScores'),
      homeName: requiredString(row, 'homeTeam'),
      homePoints: optionalNumber(row, 'homePoints'),
      homePostgameElo: optionalNumber(row, 'homePostgameElo'),
      homePregameElo: optionalNumber(row, 'homePregameElo'),
      homeSourceId: requiredNumber(row, 'homeId'),
      neutralSite: requiredBoolean(row, 'neutralSite'),
      notes: optionalString(row, 'notes'),
      season: requiredNumber(row, 'season'),
      seasonType: parseSeasonType(row),
      sourceGameId,
      sourceKey: `cfbd:game:${sourceGameId}`,
      startTime,
      startTimeTbd: requiredBoolean(row, 'startTimeTBD'),
      tvOutlets: mediaByGame
        ? (mediaByGame.get(sourceGameId) ?? [])
        : undefined,
      venue: optionalString(row, 'venue'),
      venueId: optionalNumber(row, 'venueId'),
      week: requiredNumber(row, 'week'),
    }
  })
}

function parseStats(rows: Array<SourceRow>, season: number) {
  return rows.flatMap((row) => {
    const sourceGameId = requiredNumber(row, 'id')
    const teams = row.teams
    if (!Array.isArray(teams) || teams.length !== 2) {
      throw new Error(
        `Game ${sourceGameId} does not contain exactly two teams.`,
      )
    }
    const parsedTeams = sourceRows(teams, `games/teams ${sourceGameId}`)
    return parsedTeams.map((team, index) => {
      const opponent = parsedTeams[index === 0 ? 1 : 0]
      const sourceTeamId = requiredNumber(team, 'teamId')
      const rawHomeAway = requiredString(team, 'homeAway')
      if (rawHomeAway !== 'home' && rawHomeAway !== 'away') {
        throw new Error(
          `Game ${sourceGameId} has invalid homeAway ${rawHomeAway}.`,
        )
      }
      const homeAway: 'home' | 'away' = rawHomeAway
      const rawStats = team.stats
      if (!Array.isArray(rawStats)) {
        throw new Error(`Game ${sourceGameId} has invalid team stats.`)
      }
      const stats = sourceRows(
        rawStats,
        `games/teams ${sourceGameId} stats`,
      ).map((stat) => ({
        category: requiredString(stat, 'category'),
        value: requiredString(stat, 'stat'),
      }))
      return {
        conference: optionalString(team, 'conference'),
        homeAway,
        opponentName: requiredString(opponent, 'team'),
        points: optionalNumber(team, 'points'),
        programName: requiredString(team, 'team'),
        season,
        sourceGameId,
        sourceKey: `cfbd:game-stats:${sourceGameId}:${sourceTeamId}`,
        sourceTeamId,
        stats,
      }
    })
  })
}

async function fetchCfbd(key: string, path: string) {
  const response = await fetch(`${CFBD_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!response.ok) {
    throw new Error(`CFBD ${path} failed with HTTP ${response.status}.`)
  }
  return response.json() as Promise<unknown>
}

async function syncGamesForYears(
  ctx: ActionCtx,
  key: string,
  startSeason: number,
  endSeason: number,
) {
  const startedAt = Date.now()
  await ctx.runMutation(internal.teamData.beginSync, {
    source: 'games',
    startedAt,
  })
  let acceptedRows = 0
  const seasonWeeks: Array<SeasonWeeks> = []
  try {
    for (let season = startSeason; season <= endSeason; season += 1) {
      let mediaByGame: Map<number, Array<string>> | undefined
      try {
        mediaByGame = parseMedia(
          sourceRows(
            await fetchCfbd(
              key,
              `/games/media?year=${season}&seasonType=both&mediaType=tv&classification=fbs`,
            ),
            '/games/media',
          ),
        )
      } catch (error) {
        console.warn(
          `CFBD television metadata was unavailable for ${season}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
      const rows = parseGames(
        sourceRows(
          await fetchCfbd(key, `/games?year=${season}&classification=fbs`),
          '/games',
        ),
        mediaByGame,
      )
      for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
        await ctx.runMutation(internal.games.upsertGamesBatch, {
          rows: rows.slice(offset, offset + BATCH_SIZE),
          sourceUpdatedAt: startedAt,
        })
      }
      acceptedRows += rows.length
      seasonWeeks.push({
        season,
        weeks: [
          ...new Set(
            rows.filter((row) => row.completed).map((row) => row.week),
          ),
        ].sort((left, right) => left - right),
      })
    }
    await ctx.runMutation(internal.teamData.completeSync, {
      acceptedRows,
      completedAt: Date.now(),
      fetchedRows: acceptedRows,
      rejectedRows: 0,
      source: 'games',
    })
    return { acceptedRows, seasonWeeks }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await ctx.runMutation(internal.teamData.failSync, {
      completedAt: Date.now(),
      error: message,
      source: 'games',
    })
    throw error
  }
}

async function syncStatsForYears(
  ctx: ActionCtx,
  key: string,
  seasonWeeks: Array<SeasonWeeks>,
  retentionEndSeason: number,
) {
  const startedAt = Date.now()
  await ctx.runMutation(internal.teamData.beginSync, {
    source: 'game_stats',
    startedAt,
  })
  let acceptedRows = 0
  try {
    for (const { season, weeks } of seasonWeeks) {
      for (const week of weeks) {
        const rows = parseStats(
          sourceRows(
            await fetchCfbd(
              key,
              `/games/teams?year=${season}&week=${week}&seasonType=both&classification=fbs`,
            ),
            '/games/teams',
          ),
          season,
        )
        for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
          await ctx.runMutation(internal.games.upsertStatsBatch, {
            rows: rows.slice(offset, offset + BATCH_SIZE),
            sourceUpdatedAt: startedAt,
          })
        }
        acceptedRows += rows.length
      }
    }

    const beforeSeason = retentionEndSeason - DETAILED_SEASON_COUNT + 1
    let deleted = 0
    do {
      deleted = await ctx.runMutation(internal.games.pruneStatsBatch, {
        beforeSeason,
      })
    } while (deleted > 0)

    await ctx.runMutation(internal.teamData.completeSync, {
      acceptedRows,
      completedAt: Date.now(),
      fetchedRows: acceptedRows,
      rejectedRows: 0,
      source: 'game_stats',
    })
    return acceptedRows
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await ctx.runMutation(internal.teamData.failSync, {
      completedAt: Date.now(),
      error: message,
      source: 'game_stats',
    })
    throw error
  }
}

export const upsertGamesBatch = internalMutation({
  args: { rows: v.array(gameRowValidator), sourceUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const { awayName, homeName, ...fields } = row
      const [awayProgramId, homeProgramId] = await Promise.all([
        resolveProgram(ctx, 'games', awayName),
        resolveProgram(ctx, 'games', homeName),
      ])
      const matchupKey = [awayProgramId, homeProgramId].sort().join(':')
      const existing = await ctx.db
        .query('collegeGames')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', row.sourceKey))
        .unique()
      const document = {
        ...fields,
        awayProgramId,
        awaySourceName: awayName,
        homeProgramId,
        homeSourceName: homeName,
        matchupKey,
        sourceUpdatedAt: args.sourceUpdatedAt,
        tvOutlets: fields.tvOutlets ?? existing?.tvOutlets,
      }
      if (existing) await ctx.db.replace('collegeGames', existing._id, document)
      else await ctx.db.insert('collegeGames', document)
    }
  },
})

export const upsertStatsBatch = internalMutation({
  args: { rows: v.array(teamStatRowValidator), sourceUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const { opponentName, programName, ...fields } = row
      const game = await ctx.db
        .query('collegeGames')
        .withIndex('by_sourceKey', (q) =>
          q.eq('sourceKey', `cfbd:game:${row.sourceGameId}`),
        )
        .unique()
      if (!game) {
        throw new Error(`Missing game ${row.sourceGameId} for team stats.`)
      }
      const [opponentProgramId, programId] = await Promise.all([
        resolveProgram(ctx, 'game_stats', opponentName),
        resolveProgram(ctx, 'game_stats', programName),
      ])
      const existing = await ctx.db
        .query('teamGameStats')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', row.sourceKey))
        .unique()
      const document = {
        ...fields,
        gameId: game._id,
        opponentProgramId,
        programId,
        sourceProgramName: programName,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }
      if (existing)
        await ctx.db.replace('teamGameStats', existing._id, document)
      else await ctx.db.insert('teamGameStats', document)
    }
  },
})

export const pruneStatsBatch = internalMutation({
  args: { beforeSeason: v.number() },
  handler: async (ctx, args) => {
    const stale = await ctx.db
      .query('teamGameStats')
      .withIndex('by_season', (q) => q.lt('season', args.beforeSeason))
      .take(100)
    await Promise.all(
      stale.map((row) => ctx.db.delete('teamGameStats', row._id)),
    )
    return stale.length
  },
})

export const backfill = internalAction({
  args: {
    endSeason: v.optional(v.number()),
    startSeason: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<BackfillResult> => {
    const key = env.CFBD_API_KEY
    if (!key) throw new Error('CFBD_API_KEY is not configured.')
    const currentSeason = new Date().getUTCFullYear()
    const endSeason = Math.floor(args.endSeason ?? currentSeason)
    const startSeason = Math.floor(args.startSeason ?? endSeason)
    if (
      startSeason < DEFAULT_HISTORY_START_SEASON ||
      endSeason < startSeason ||
      endSeason > currentSeason ||
      endSeason - startSeason >= DETAILED_SEASON_COUNT
    ) {
      throw new Error(
        `Backfill range must be between ${DEFAULT_HISTORY_START_SEASON} and ${currentSeason} and include at most ${DETAILED_SEASON_COUNT} seasons.`,
      )
    }
    const statsStartSeason = Math.max(
      startSeason,
      currentSeason - DETAILED_SEASON_COUNT + 1,
    )
    const gameSync = await syncGamesForYears(ctx, key, startSeason, endSeason)
    const ratings: RatingSyncResult = await ctx.runAction(
      internal.ratings.syncRange,
      {
        endSeason,
        startSeason,
      },
    )
    const stats =
      statsStartSeason <= endSeason
        ? await syncStatsForYears(
            ctx,
            key,
            gameSync.seasonWeeks.filter(
              ({ season }) => season >= statsStartSeason,
            ),
            endSeason,
          )
        : 0
    return {
      endSeason,
      games: gameSync.acceptedRows,
      ratings: ratings.acceptedRows,
      startSeason,
      stats,
      statsStartSeason: statsStartSeason <= endSeason ? statsStartSeason : null,
    }
  },
})

export const syncCurrentSeason = internalAction({
  args: {},
  handler: async (ctx): Promise<CurrentSyncResult> => {
    const key = env.CFBD_API_KEY
    if (!key) return { configured: false, games: 0, ratings: 0, stats: 0 }
    const season = new Date().getUTCFullYear()
    const gameSync = await syncGamesForYears(ctx, key, season, season)
    const ratings: RatingSyncResult = await ctx.runAction(
      internal.ratings.syncRange,
      {
        endSeason: season,
        startSeason: season,
      },
    )
    const recentWeeks = gameSync.seasonWeeks.map((entry) => ({
      ...entry,
      weeks: entry.weeks.slice(-2),
    }))
    const stats = await syncStatsForYears(ctx, key, recentWeeks, season)
    return {
      configured: true,
      games: gameSync.acceptedRows,
      ratings: ratings.acceptedRows,
      stats,
    }
  },
})

const boundedLimit = (limit: number | undefined, fallback: number) =>
  Math.min(Math.max(Math.floor(limit ?? fallback), 1), 500)

export const listSeasonWeek = query({
  args: {
    limit: v.optional(v.number()),
    season: v.number(),
    week: v.number(),
  },
  handler: async (ctx, args) =>
    ctx.db
      .query('collegeGames')
      .withIndex('by_season_and_week_and_startTime', (q) =>
        q.eq('season', args.season).eq('week', args.week),
      )
      .take(boundedLimit(args.limit, 200)),
})

export const listProgramGames = query({
  args: {
    fromSeason: v.number(),
    limit: v.optional(v.number()),
    programKey: v.string(),
    toSeason: v.number(),
  },
  handler: async (ctx, args) => {
    const fromSeason = Math.floor(args.fromSeason)
    const toSeason = Math.floor(args.toSeason)
    if (toSeason < fromSeason || toSeason - fromSeason > 50) {
      throw new Error(
        'Season range must be ordered and no wider than 50 years.',
      )
    }
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', args.programKey))
      .unique()
    if (!program) return null
    const limit = boundedLimit(args.limit, 200)
    const [home, away] = await Promise.all([
      ctx.db
        .query('collegeGames')
        .withIndex('by_homeProgramId_and_season', (q) =>
          q
            .eq('homeProgramId', program._id)
            .gte('season', fromSeason)
            .lte('season', toSeason),
        )
        .take(limit),
      ctx.db
        .query('collegeGames')
        .withIndex('by_awayProgramId_and_season', (q) =>
          q
            .eq('awayProgramId', program._id)
            .gte('season', fromSeason)
            .lte('season', toSeason),
        )
        .take(limit),
    ])
    const games = [...home, ...away]
      .sort((left, right) => right.startTime - left.startTime)
      .slice(0, limit)
    return { games, program }
  },
})

export const listMatchup = query({
  args: {
    limit: v.optional(v.number()),
    programKeyA: v.string(),
    programKeyB: v.string(),
  },
  handler: async (ctx, args) => {
    const [programA, programB] = await Promise.all([
      ctx.db
        .query('programs')
        .withIndex('by_key', (q) => q.eq('key', args.programKeyA))
        .unique(),
      ctx.db
        .query('programs')
        .withIndex('by_key', (q) => q.eq('key', args.programKeyB))
        .unique(),
    ])
    if (!programA || !programB) return null
    const matchupKey = [programA._id, programB._id].sort().join(':')
    const games = await ctx.db
      .query('collegeGames')
      .withIndex('by_matchupKey_and_startTime', (q) =>
        q.eq('matchupKey', matchupKey),
      )
      .order('desc')
      .take(boundedLimit(args.limit, 100))
    return { games, programs: [programA, programB] }
  },
})

export const getGame = query({
  args: { sourceGameId: v.number() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query('collegeGames')
      .withIndex('by_sourceKey', (q) =>
        q.eq('sourceKey', `cfbd:game:${Math.floor(args.sourceGameId)}`),
      )
      .unique()
    if (!game) return null
    const stats = await ctx.db
      .query('teamGameStats')
      .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
      .take(2)
    return { game, stats }
  },
})
