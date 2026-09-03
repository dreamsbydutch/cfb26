import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import { resolveProgram, slug } from './programIdentity'
import { buildMatchupProjection, buildSeasonRatings } from './ratingModel'
import {
  POWER_MODEL_VERSION,
  buildPowerRatingEdition,
  buildResumeRatingEdition,
  projectPowerMatchup,
  scoreWeeklyMatchup,
} from './ratingSystem'
import type { Doc, Id } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'
import type { LogisticMarginCalibration } from './ratingBacktest'
import type {
  PowerRatingEdition,
  PowerRatingGame,
  PowerRatingTeam,
  PowerTeamRating,
  ResumeTeamRating,
} from './ratingSystem'

const CFBD_ELO_URL = 'https://api.collegefootballdata.com/ratings/elo'
const BATCH_SIZE = 50
const DAY_MS = 24 * 60 * 60 * 1000
const HOME_FIELD_ADVANTAGE = 55
const COMPOSITE_BATCH_SIZE = 40
const MAX_MODEL_ROWS = 250

type SourceRow = Record<string, unknown>
type PowerModelData = {
  games: Array<Doc<'collegeGames'>>
  programs: Array<Doc<'programs'>>
  seasons: Array<number>
}
type StoredEditionResult = {
  editionId: Id<'ratingEditions'>
  inserted: boolean
  rows: number
}

const ratingRowValidator = v.object({
  conference: v.optional(v.string()),
  rating: v.number(),
  season: v.number(),
  sourceKey: v.string(),
  sourceProgramName: v.string(),
})

const ratingDimensionsValidator = v.object({
  continuity: v.number(),
  defense: v.number(),
  form: v.number(),
  offense: v.number(),
  passingDefense: v.number(),
  passingOffense: v.number(),
  power: v.number(),
  resume: v.number(),
  rushingDefense: v.number(),
  rushingOffense: v.number(),
  situationalDefense: v.number(),
  situationalOffense: v.number(),
  specialTeams: v.number(),
  talent: v.number(),
  tempo: v.number(),
  volatility: v.number(),
})

const compositeRatingValidator = v.object({
  confidence: v.number(),
  conference: v.optional(v.string()),
  dataSources: v.array(v.string()),
  dimensions: ratingDimensionsValidator,
  generatedAt: v.number(),
  modelVersion: v.string(),
  overall: v.number(),
  programId: v.id('programs'),
  programKey: v.string(),
  rank: v.number(),
  season: v.number(),
  signalCount: v.number(),
  sourceProgramName: v.string(),
})

const editionTypeValidator = v.union(
  v.literal('nightly'),
  v.literal('official'),
  v.literal('amendment'),
  v.literal('research'),
)

const ratingClassificationValidator = v.union(
  v.literal('fbs'),
  v.literal('fcs'),
  v.literal('transitioning'),
)

const probabilityCalibrationValidator = v.object({
  fitCount: v.number(),
  intercept: v.number(),
  maximumProbability: v.number(),
  minimumProbability: v.number(),
  slope: v.number(),
  trainingSeasons: v.array(v.number()),
  version: v.literal('logistic-margin-v1'),
})

const editionRowValidator = v.object({
  actualWins: v.optional(v.number()),
  classification: ratingClassificationValidator,
  conference: v.optional(v.string()),
  dataSources: v.array(v.string()),
  defense: v.number(),
  disagreementReasons: v.array(v.string()),
  dominanceComponent: v.optional(v.number()),
  expectedWins: v.optional(v.number()),
  gamesPlayed: v.number(),
  homeFieldAdvantage: v.number(),
  limitedSample: v.boolean(),
  offense: v.number(),
  power: v.number(),
  powerRank: v.optional(v.number()),
  priorWeight: v.number(),
  programId: v.id('programs'),
  programKey: v.string(),
  published: v.boolean(),
  rankDifference: v.optional(v.number()),
  resume: v.optional(v.number()),
  resumeRank: v.optional(v.number()),
  scheduleComponent: v.optional(v.number()),
  sourceProgramName: v.string(),
  specialTeams: v.number(),
  specialTeamsAvailable: v.boolean(),
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

async function preferredWeeklyEdition(
  ctx: Pick<QueryCtx, 'db'>,
  season: number,
  week: number,
) {
  for (const editionType of ['amendment', 'official', 'nightly'] as const) {
    const edition = await ctx.db
      .query('ratingEditions')
      .withIndex('by_season_week_type_revision', (q) =>
        q.eq('season', season).eq('week', week).eq('editionType', editionType),
      )
      .order('desc')
      .first()
    if (edition) return edition
  }
  return null
}

async function latestPublishedEdition(
  ctx: Pick<QueryCtx, 'db'>,
  season: number,
) {
  const editions = await ctx.db
    .query('ratingEditions')
    .withIndex('by_season_and_cutoffAt', (q) => q.eq('season', season))
    .order('desc')
    .take(30)
  return editions.find((edition) => edition.editionType !== 'research') ?? null
}

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

export const loadSeasonModelData = internalQuery({
  args: { season: v.number() },
  handler: async (ctx, args) => {
    const season = Math.floor(args.season)
    const modelSeasons = Array.from({ length: 5 }, (_, index) => season - index)
    const [
      programs,
      elo,
      inputs,
      standingsBySeason,
      gamesBySeason,
      stats,
      recruitingBySeason,
      draftByYear,
    ] = await Promise.all([
      ctx.db.query('programs').withIndex('by_key').take(500),
      ctx.db
        .query('teamSeasonRatings')
        .withIndex('by_season_and_rating', (q) => q.eq('season', season))
        .take(MAX_MODEL_ROWS),
      ctx.db
        .query('teamSeasonRatingInputs')
        .withIndex('by_season', (q) => q.eq('season', season))
        .take(MAX_MODEL_ROWS),
      Promise.all(
        modelSeasons.map((modelSeason) =>
          ctx.db
            .query('teamSeasonStandings')
            .withIndex('by_season_and_wins', (q) => q.eq('season', modelSeason))
            .take(MAX_MODEL_ROWS),
        ),
      ),
      Promise.all(
        modelSeasons.map((modelSeason) =>
          ctx.db
            .query('collegeGames')
            .withIndex('by_season_and_startTime', (q) =>
              q.eq('season', modelSeason),
            )
            .take(2_000),
        ),
      ),
      ctx.db
        .query('teamGameStats')
        .withIndex('by_season', (q) => q.eq('season', season))
        .take(3_000),
      Promise.all(
        modelSeasons.map((recruitingSeason) =>
          ctx.db
            .query('teamRecruitingClasses')
            .withIndex('by_season_and_rank', (q) =>
              q.eq('season', recruitingSeason),
            )
            .take(MAX_MODEL_ROWS),
        ),
      ),
      Promise.all(
        modelSeasons.map((year) =>
          ctx.db
            .query('teamDraftSelections')
            .withIndex('by_year_and_pick', (q) => q.eq('year', year))
            .take(300),
        ),
      ),
    ])
    return {
      draft: draftByYear.flat(),
      elo,
      games: gamesBySeason.flat(),
      inputs,
      programs,
      recruiting: recruitingBySeason.flat(),
      standings: standingsBySeason.flat(),
      stats,
    }
  },
})

export const clearCompositeSeason = internalMutation({
  args: { season: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('teamCompositeRatings')
      .withIndex('by_season_and_overall', (q) => q.eq('season', args.season))
      .take(MAX_MODEL_ROWS)
    await Promise.all(
      rows.map((row) => ctx.db.delete('teamCompositeRatings', row._id)),
    )
  },
})

export const upsertCompositeBatch = internalMutation({
  args: { rows: v.array(compositeRatingValidator) },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const existing = await ctx.db
        .query('teamCompositeRatings')
        .withIndex('by_programId_and_season', (q) =>
          q.eq('programId', row.programId).eq('season', row.season),
        )
        .unique()
      if (existing)
        await ctx.db.replace('teamCompositeRatings', existing._id, row)
      else await ctx.db.insert('teamCompositeRatings', row)
    }
  },
})

export const rebuildSeason = internalAction({
  args: { season: v.number() },
  handler: async (ctx, args): Promise<{ ratings: number; season: number }> => {
    const season = Math.floor(args.season)
    const data = await ctx.runQuery(internal.ratings.loadSeasonModelData, {
      season,
    })
    const ratings = buildSeasonRatings(data, season, Date.now())
    await ctx.runMutation(internal.ratings.clearCompositeSeason, { season })
    for (
      let offset = 0;
      offset < ratings.length;
      offset += COMPOSITE_BATCH_SIZE
    ) {
      await ctx.runMutation(internal.ratings.upsertCompositeBatch, {
        rows: ratings.slice(offset, offset + COMPOSITE_BATCH_SIZE),
      })
    }
    return { ratings: ratings.length, season }
  },
})

export const rebuildRange = internalAction({
  args: { endSeason: v.number(), startSeason: v.number() },
  handler: async (ctx, args): Promise<{ ratings: number; seasons: number }> => {
    const startSeason = Math.floor(args.startSeason)
    const endSeason = Math.floor(args.endSeason)
    if (endSeason < startSeason || endSeason - startSeason >= 5) {
      throw new Error(
        'Composite rebuild must include between one and five seasons.',
      )
    }
    let ratings = 0
    for (let season = startSeason; season <= endSeason; season += 1) {
      const result = await ctx.runAction(internal.ratings.rebuildSeason, {
        season,
      })
      ratings += result.ratings
    }
    return { ratings, seasons: endSeason - startSeason + 1 }
  },
})

export const refreshSeason = internalAction({
  args: { season: v.number() },
  handler: async (
    ctx,
    args,
  ): Promise<{
    inputs: {
      acceptedRows: number
      configured: boolean
      fetchedRows: number
      rejectedRows: number
      warnings: Array<string>
    }
    ratings: number
    season: number
  }> => {
    const season = Math.floor(args.season)
    const inputs = await ctx.runAction(internal.ratingInputs.syncSeason, {
      season,
    })
    const rebuilt = await ctx.runAction(internal.ratings.rebuildSeason, {
      season,
    })
    return { inputs, ratings: rebuilt.ratings, season }
  },
})

export const refreshCurrentSeason = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<{
    inputs: {
      acceptedRows: number
      configured: boolean
      fetchedRows: number
      rejectedRows: number
      warnings: Array<string>
    }
    ratings: number
    season: number
  }> => {
    const season = new Date().getUTCFullYear()
    return ctx.runAction(internal.ratings.refreshSeason, { season })
  },
})

export const loadPowerModelData = internalQuery({
  args: { season: v.number() },
  handler: async (ctx, args) => {
    const season = Math.floor(args.season)
    const seasons = Array.from({ length: 5 }, (_, index) => season - 4 + index)
    const [programs, gamesBySeason] = await Promise.all([
      ctx.db.query('programs').withIndex('by_key').take(500),
      Promise.all(
        seasons.map((modelSeason) =>
          ctx.db
            .query('collegeGames')
            .withIndex('by_season_and_startTime', (q) =>
              q.eq('season', modelSeason),
            )
            .take(2_000),
        ),
      ),
    ])
    return { games: gamesBySeason.flat(), programs, seasons }
  },
})

export const nextEditionRevision = internalQuery({
  args: {
    editionType: editionTypeValidator,
    season: v.number(),
    week: v.number(),
  },
  handler: async (ctx, args) => {
    const latest = await ctx.db
      .query('ratingEditions')
      .withIndex('by_season_week_type_revision', (q) =>
        q
          .eq('season', Math.floor(args.season))
          .eq('week', Math.floor(args.week))
          .eq('editionType', args.editionType),
      )
      .order('desc')
      .first()
    return (latest?.revision ?? 0) + 1
  },
})

export const storeRatingEdition = internalMutation({
  args: {
    edition: v.object({
      calibrationFitCount: v.optional(v.number()),
      calibrationIntercept: v.optional(v.number()),
      calibrationMaximumProbability: v.optional(v.number()),
      calibrationMinimumProbability: v.optional(v.number()),
      calibrationSlope: v.optional(v.number()),
      calibrationTrainingSeasons: v.optional(v.array(v.number())),
      calibrationVersion: v.string(),
      cutoffAt: v.number(),
      editionType: editionTypeValidator,
      generatedAt: v.number(),
      leagueAveragePoints: v.number(),
      modelVersion: v.string(),
      resumeModelVersion: v.string(),
      resumeReferencePower: v.optional(v.number()),
      resumeVisible: v.boolean(),
      revision: v.number(),
      season: v.number(),
      sourceDataFingerprint: v.string(),
      sourceDataUpdatedAt: v.number(),
      sourceKey: v.string(),
      supersedesEditionId: v.optional(v.id('ratingEditions')),
      week: v.number(),
    }),
    rows: v.array(editionRowValidator),
  },
  handler: async (ctx, args) => {
    if (args.rows.length > 600) {
      throw new Error('A rating edition cannot contain more than 600 teams.')
    }
    if (
      args.edition.editionType === 'amendment' &&
      args.edition.supersedesEditionId === undefined
    ) {
      throw new Error('An amendment must identify the edition it supersedes.')
    }
    if (args.edition.editionType === 'official') {
      const official = await ctx.db
        .query('ratingEditions')
        .withIndex('by_season_week_type_revision', (q) =>
          q
            .eq('season', args.edition.season)
            .eq('week', args.edition.week)
            .eq('editionType', 'official'),
        )
        .first()
      if (official) {
        return { editionId: official._id, inserted: false, rows: 0 }
      }
    }
    if (args.edition.supersedesEditionId !== undefined) {
      const superseded = await ctx.db.get(
        'ratingEditions',
        args.edition.supersedesEditionId,
      )
      if (
        !superseded ||
        superseded.season !== args.edition.season ||
        superseded.week !== args.edition.week
      ) {
        throw new Error('An amendment must supersede the same season and week.')
      }
    }
    const existing = await ctx.db
      .query('ratingEditions')
      .withIndex('by_sourceKey', (q) =>
        q.eq('sourceKey', args.edition.sourceKey),
      )
      .unique()
    if (existing) {
      return { editionId: existing._id, inserted: false, rows: 0 }
    }
    const editionId = await ctx.db.insert('ratingEditions', args.edition)
    for (const row of args.rows) {
      await ctx.db.insert('teamRatingSnapshots', { ...row, editionId })
    }
    return { editionId, inserted: true, rows: args.rows.length }
  },
})

function normalizedClassification(value: string | undefined) {
  const classification = value?.toLowerCase()
  if (classification === 'fcs') return 'fcs' as const
  if (classification === 'transitioning') return 'transitioning' as const
  return 'fbs' as const
}

function overtimePeriods(
  homeLineScores: Array<number> | undefined,
  awayLineScores: Array<number> | undefined,
) {
  return Math.max(
    (homeLineScores?.length ?? 4) - 4,
    (awayLineScores?.length ?? 4) - 4,
    0,
  )
}

function gameDataFingerprint(
  games: ReadonlyArray<
    Pick<
      Doc<'collegeGames'>,
      | 'awayPoints'
      | 'awayProgramId'
      | 'completed'
      | 'homePoints'
      | 'homeProgramId'
      | 'sourceGameId'
      | 'startTime'
    >
  >,
  cutoffAt: number,
) {
  const value = games
    .map((game) => {
      const available = game.startTime < cutoffAt
      return `${game.sourceGameId}:${game.homeProgramId}:${game.awayProgramId}:${Number(available && game.completed)}:${available ? (game.homePoints ?? '') : ''}:${available ? (game.awayPoints ?? '') : ''}`
    })
    .sort()
    .join('|')
  let hash = 2_166_136_261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const buildRatingEdition = internalAction({
  args: {
    calibration: v.optional(probabilityCalibrationValidator),
    cutoffAt: v.number(),
    editionType: editionTypeValidator,
    revision: v.optional(v.number()),
    season: v.number(),
    supersedesEditionId: v.optional(v.id('ratingEditions')),
    week: v.number(),
  },
  handler: async (ctx, args): Promise<StoredEditionResult> => {
    const season = Math.floor(args.season)
    const week = Math.floor(args.week)
    if (week < 0 || week > 30) throw new Error('Week must be between 0 and 30.')
    const data: PowerModelData = await ctx.runQuery(
      internal.ratings.loadPowerModelData,
      { season },
    )
    const programById = new Map(
      data.programs.map((program) => [String(program._id), program]),
    )
    let priorByTeam = new Map<string, PowerTeamRating>()
    let powerEdition: PowerRatingEdition | undefined

    for (const modelSeason of data.seasons) {
      const modelCutoff =
        modelSeason === season ? args.cutoffAt : Date.UTC(modelSeason + 1, 2, 1)
      const seasonGames = data.games.filter(
        (game) => game.season === modelSeason && game.startTime < modelCutoff,
      )
      const seasonSchedule = data.games.filter(
        (game) => game.season === modelSeason,
      )
      const details = new Map<
        string,
        {
          classification: PowerRatingTeam['classification']
          conference?: string
        }
      >(
        [...priorByTeam].map(([teamId, prior]) => [
          teamId,
          {
            classification: prior.classification,
            conference: prior.conference,
          },
        ]),
      )
      for (const game of seasonSchedule) {
        details.set(String(game.homeProgramId), {
          classification: normalizedClassification(game.homeClassification),
          conference: game.homeConference,
        })
        details.set(String(game.awayProgramId), {
          classification: normalizedClassification(game.awayClassification),
          conference: game.awayConference,
        })
      }
      const teams: Array<PowerRatingTeam> = [...details].flatMap(
        ([teamId, detail]) => {
          const program = programById.get(teamId)
          if (!program) return []
          const prior = priorByTeam.get(teamId)
          return [
            {
              ...detail,
              id: teamId,
              name: program.name,
              prior:
                prior === undefined
                  ? undefined
                  : {
                      defense: prior.defense,
                      effectiveGames: Math.min(prior.gamesPlayed, 8),
                      offense: prior.offense,
                      power: prior.power,
                      sources: ['multi_season_performance'],
                      specialTeams: prior.specialTeams,
                    },
            },
          ]
        },
      )
      const modelGames: Array<PowerRatingGame> = seasonGames.flatMap((game) => {
        if (
          !game.completed ||
          game.homePoints === undefined ||
          game.awayPoints === undefined
        ) {
          return []
        }
        return [
          {
            awayPoints: game.awayPoints,
            awayTeamId: String(game.awayProgramId),
            completed: true,
            homePoints: game.homePoints,
            homeTeamId: String(game.homeProgramId),
            id: String(game.sourceGameId),
            kickoffAt: game.startTime,
            neutralSite: game.neutralSite,
            overtimePeriods: overtimePeriods(
              game.homeLineScores,
              game.awayLineScores,
            ),
            season: modelSeason,
            week: game.week,
          },
        ]
      })
      powerEdition = buildPowerRatingEdition({
        calibration: modelSeason === season ? args.calibration : undefined,
        cutoffAt: modelCutoff,
        games: modelGames,
        season: modelSeason,
        teams,
        week: modelSeason === season ? week : 30,
      })
      priorByTeam = new Map(
        powerEdition.ratings.map((rating) => [rating.teamId, rating]),
      )
    }
    if (!powerEdition || powerEdition.season !== season) {
      throw new Error('Unable to build the requested Power Rating edition.')
    }
    const currentGames: Array<PowerRatingGame> = data.games.flatMap((game) => {
      if (
        game.season !== season ||
        game.startTime >= args.cutoffAt ||
        !game.completed ||
        game.homePoints === undefined ||
        game.awayPoints === undefined
      ) {
        return []
      }
      return [
        {
          awayPoints: game.awayPoints,
          awayTeamId: String(game.awayProgramId),
          completed: true,
          homePoints: game.homePoints,
          homeTeamId: String(game.homeProgramId),
          id: String(game.sourceGameId),
          kickoffAt: game.startTime,
          neutralSite: game.neutralSite,
          overtimePeriods: overtimePeriods(
            game.homeLineScores,
            game.awayLineScores,
          ),
          season,
          week: game.week,
        },
      ]
    })
    const resumeEdition = buildResumeRatingEdition({
      games: currentGames,
      powerEdition,
      week,
    })
    const resumeByTeam = new Map(
      resumeEdition.ratings.map((rating) => [rating.teamId, rating]),
    )
    const revision =
      args.revision ??
      (await ctx.runQuery(internal.ratings.nextEditionRevision, {
        editionType: args.editionType,
        season,
        week,
      }))
    const generatedAt = Date.now()
    const sourceKey = [
      POWER_MODEL_VERSION,
      season,
      week,
      args.editionType,
      revision,
      args.cutoffAt,
    ].join(':')
    const sourceDataUpdatedAt = Math.max(
      0,
      ...data.games
        .filter(
          (game) => game.season === season && game.startTime < args.cutoffAt,
        )
        .map((game) => game.sourceUpdatedAt),
    )
    const sourceDataFingerprint = gameDataFingerprint(
      data.games.filter(
        (game) => game.season === season && game.startTime < args.cutoffAt,
      ),
      args.cutoffAt,
    )
    const rows = powerEdition.ratings.flatMap((power) => {
      const program = programById.get(power.teamId)
      if (!program) return []
      const resume: ResumeTeamRating | undefined = resumeByTeam.get(
        power.teamId,
      )
      return [
        {
          actualWins: resume?.actualWins,
          classification: power.classification,
          conference: power.conference,
          dataSources: power.dataSources,
          defense: power.defense,
          disagreementReasons: resume?.disagreementReasons ?? [],
          dominanceComponent: resume?.dominanceComponent,
          expectedWins: resume?.expectedWins,
          gamesPlayed: power.gamesPlayed,
          homeFieldAdvantage: power.homeFieldAdvantage,
          limitedSample: power.limitedSample,
          offense: power.offense,
          power: power.power,
          powerRank: power.rank,
          priorWeight: power.priorWeight,
          programId: program._id,
          programKey: program.key,
          published: power.published,
          rankDifference: resume?.rankDifference,
          resume: resume?.resume,
          resumeRank: resume?.resumeRank,
          scheduleComponent: resume?.scheduleComponent,
          sourceProgramName: power.name,
          specialTeams: power.specialTeams,
          specialTeamsAvailable: power.specialTeamsAvailable,
        },
      ]
    })
    return ctx.runMutation(internal.ratings.storeRatingEdition, {
      edition: {
        calibrationFitCount: args.calibration?.fitCount,
        calibrationIntercept: args.calibration?.intercept,
        calibrationMaximumProbability: args.calibration?.maximumProbability,
        calibrationMinimumProbability: args.calibration?.minimumProbability,
        calibrationSlope: args.calibration?.slope,
        calibrationTrainingSeasons: args.calibration?.trainingSeasons,
        calibrationVersion: args.calibration?.version ?? 'fixed-logistic-v1',
        cutoffAt: args.cutoffAt,
        editionType: args.editionType,
        generatedAt,
        leagueAveragePoints: powerEdition.leagueAveragePoints,
        modelVersion: powerEdition.modelVersion,
        resumeModelVersion: resumeEdition.modelVersion,
        resumeReferencePower: resumeEdition.referencePower,
        resumeVisible: resumeEdition.visible,
        revision,
        season,
        sourceDataFingerprint,
        sourceDataUpdatedAt,
        sourceKey,
        supersedesEditionId: args.supersedesEditionId,
        week,
      },
      rows,
    })
  },
})

export const resolveRatingWeek = internalQuery({
  args: { asOf: v.number(), season: v.number() },
  handler: async (ctx, args) => {
    const [previous, next, games] = await Promise.all([
      ctx.db
        .query('collegeGames')
        .withIndex('by_season_and_startTime', (q) =>
          q.eq('season', args.season).lte('startTime', args.asOf),
        )
        .order('desc')
        .first(),
      ctx.db
        .query('collegeGames')
        .withIndex('by_season_and_startTime', (q) =>
          q.eq('season', args.season).gt('startTime', args.asOf),
        )
        .first(),
      ctx.db
        .query('collegeGames')
        .withIndex('by_season_and_startTime', (q) =>
          q.eq('season', args.season),
        )
        .take(2_000),
    ])
    return {
      sourceDataFingerprint: gameDataFingerprint(
        games.filter((game) => game.startTime < args.asOf),
        args.asOf,
      ),
      sourceDataUpdatedAt: Math.max(
        0,
        ...games
          .filter((game) => game.startTime < args.asOf)
          .map((game) => game.sourceUpdatedAt),
      ),
      week: next?.week ?? Math.min((previous?.week ?? 0) + 1, 30),
    }
  },
})

export const latestNightlyEdition = internalQuery({
  args: { season: v.number(), week: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query('ratingEditions')
      .withIndex('by_season_week_type_revision', (q) =>
        q
          .eq('season', args.season)
          .eq('week', args.week)
          .eq('editionType', 'nightly'),
      )
      .order('desc')
      .first(),
})

function footballSeason(asOf: number) {
  const date = new Date(asOf)
  return date.getUTCMonth() < 2
    ? date.getUTCFullYear() - 1
    : date.getUTCFullYear()
}

export const refreshCurrentPowerRatings = internalAction({
  args: {},
  handler: async (ctx): Promise<StoredEditionResult> => {
    const cutoffAt = Date.now()
    const season = footballSeason(cutoffAt)
    const state: {
      sourceDataFingerprint: string
      sourceDataUpdatedAt: number
      week: number
    } = await ctx.runQuery(internal.ratings.resolveRatingWeek, {
      asOf: cutoffAt,
      season,
    })
    const latest = await ctx.runQuery(internal.ratings.latestNightlyEdition, {
      season,
      week: state.week,
    })
    if (latest?.sourceDataFingerprint === state.sourceDataFingerprint) {
      return { editionId: latest._id, inserted: false, rows: 0 }
    }
    return ctx.runAction(internal.ratings.buildRatingEdition, {
      cutoffAt,
      editionType: 'nightly',
      season,
      week: state.week,
    })
  },
})

export const publishCurrentWeeklyRatings = internalAction({
  args: {},
  handler: async (ctx): Promise<StoredEditionResult> => {
    const cutoffAt = Date.now()
    const season = footballSeason(cutoffAt)
    const state: {
      sourceDataFingerprint: string
      sourceDataUpdatedAt: number
      week: number
    } = await ctx.runQuery(internal.ratings.resolveRatingWeek, {
      asOf: cutoffAt,
      season,
    })
    return ctx.runAction(internal.ratings.buildRatingEdition, {
      cutoffAt,
      editionType: 'official',
      season,
      week: state.week,
    })
  },
})

export const listComposite = query({
  args: { limit: v.optional(v.number()), season: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query('teamCompositeRatings')
      .withIndex('by_season_and_overall', (q) =>
        q.eq('season', Math.floor(args.season)),
      )
      .order('desc')
      .take(boundedLimit(args.limit, 150)),
})

function clampScore(value: number) {
  return Math.min(Math.max(Math.round(value), 0), 100)
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

    const edition = await preferredWeeklyEdition(ctx, season, week)
    const [games, snapshotRows, compositeRows, ratingRows, michigan] =
      await Promise.all([
        ctx.db
          .query('collegeGames')
          .withIndex('by_season_and_week_and_startTime', (q) =>
            q.eq('season', season).eq('week', week),
          )
          .take(200),
        edition
          ? ctx.db
              .query('teamRatingSnapshots')
              .withIndex('by_edition_and_power', (q) =>
                q.eq('editionId', edition._id),
              )
              .order('desc')
              .take(600)
          : Promise.resolve([]),
        ctx.db
          .query('teamCompositeRatings')
          .withIndex('by_season_and_overall', (q) => q.eq('season', season))
          .order('desc')
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

    const ratings =
      snapshotRows.length > 0 && edition
        ? snapshotRows
            .filter((row) => row.published)
            .map((row) => ({
              ...row,
              calibrationVersion: edition.calibrationVersion,
              generatedAt: edition.generatedAt,
              modelVersion: edition.modelVersion,
              rank: row.powerRank ?? 999,
              rating: row.power,
            }))
        : compositeRows.length > 0
          ? compositeRows.map((row) => ({
              actualWins: undefined,
              calibrationVersion: 'fixed-logistic-v1',
              classification: 'fbs' as const,
              conference: row.conference,
              dataSources: row.dataSources,
              defense: (row.dimensions.defense - 50) * 0.3,
              disagreementReasons: [] as Array<string>,
              dominanceComponent: undefined,
              expectedWins: undefined,
              gamesPlayed: 0,
              generatedAt: row.generatedAt,
              homeFieldAdvantage: 2.5,
              limitedSample: true,
              modelVersion: row.modelVersion,
              offense: (row.dimensions.offense - 50) * 0.3,
              power: (row.overall - 50) * 0.3,
              powerRank: row.rank,
              priorWeight: 0,
              programId: row.programId,
              programKey: row.programKey,
              published: true,
              rank: row.rank,
              rankDifference: undefined,
              rating: (row.overall - 50) * 0.3,
              resume: undefined,
              resumeRank: undefined,
              scheduleComponent: undefined,
              sourceProgramName: row.sourceProgramName,
              specialTeams: (row.dimensions.specialTeams - 50) * 0.3,
              specialTeamsAvailable: row.dataSources.includes('game_stats'),
            }))
          : ratingRows.map((row, index) => {
              const power = (row.rating - 1500) / 25
              return {
                actualWins: undefined,
                calibrationVersion: 'elo-logistic-fallback-v1',
                classification: 'fbs' as const,
                conference: row.conference,
                dataSources: ['elo'],
                defense: power / 2,
                disagreementReasons: [] as Array<string>,
                dominanceComponent: undefined,
                expectedWins: undefined,
                gamesPlayed: 0,
                generatedAt: row.sourceUpdatedAt,
                homeFieldAdvantage: 2.5,
                limitedSample: true,
                modelVersion: 'elo-fallback',
                offense: power / 2,
                power,
                powerRank: index + 1,
                priorWeight: 0,
                programId: row.programId,
                programKey: slug(row.sourceProgramName),
                published: true,
                rank: index + 1,
                rankDifference: undefined,
                rating: power,
                resume: undefined,
                resumeRank: undefined,
                scheduleComponent: undefined,
                sourceProgramName: row.sourceProgramName,
                specialTeams: 0,
                specialTeamsAvailable: false,
              }
            })
    const ratingByProgram = new Map(
      ratings.map((row) => [String(row.programId), row]),
    )
    const eloByProgram = new Map(
      ratingRows.map((row) => [String(row.programId), row.rating]),
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
      const homeElo =
        eloByProgram.get(String(game.homeProgramId)) ??
        game.homePregameElo ??
        game.homePostgameElo ??
        1500
      const awayElo =
        eloByProgram.get(String(game.awayProgramId)) ??
        game.awayPregameElo ??
        game.awayPostgameElo ??
        1500
      const homeRating = homeRatingRow?.power ?? (homeElo - 1500) / 25
      const awayRating = awayRatingRow?.power ?? (awayElo - 1500) / 25
      const matchup = scoreWeeklyMatchup({
        awayPower: awayRating,
        awayPowerRank: awayRatingRow?.powerRank,
        awayResumeRank: edition?.resumeVisible
          ? awayRatingRow?.resumeRank
          : undefined,
        conferenceGame: game.conferenceGame,
        homeFieldAdvantage:
          homeRatingRow?.homeFieldAdvantage ?? HOME_FIELD_ADVANTAGE / 22,
        homePower: homeRating,
        homePowerRank: homeRatingRow?.powerRank,
        homeResumeRank: edition?.resumeVisible
          ? homeRatingRow?.resumeRank
          : undefined,
        neutralSite: game.neutralSite,
      })

      const isMichiganGame =
        michigan !== null &&
        (game.homeProgramId === michigan._id ||
          game.awayProgramId === michigan._id)
      const homeIsOpponent = michiganOpponents.has(String(game.homeProgramId))
      const awayIsOpponent = michiganOpponents.has(String(game.awayProgramId))
      const opponentCount = Number(homeIsOpponent) + Number(awayIsOpponent)
      let michiganRelation = 'National landscape'
      let michiganImportance = matchup.playoffImportance * 0.15
      if (isMichiganGame) {
        michiganRelation = 'Michigan game'
        michiganImportance = 100
      } else if (opponentCount === 2) {
        michiganRelation = 'Two Michigan opponents'
        michiganImportance = 75 + matchup.playoffImportance * 0.2
      } else if (opponentCount === 1) {
        michiganRelation = 'Michigan opponent'
        michiganImportance = 48 + matchup.playoffImportance * 0.35
      } else if (
        isBigTen(game.homeConference) ||
        isBigTen(game.awayConference)
      ) {
        michiganRelation = 'Big Ten race'
        michiganImportance = 25 + matchup.playoffImportance * 0.3
      }

      return {
        ...game,
        awayRank: awayRatingRow?.powerRank,
        awayRating,
        competitiveness: matchup.competitiveness,
        homeRank: homeRatingRow?.powerRank,
        homeRating,
        matchupQuality: clampScore(matchup.matchupQuality),
        michiganImportance: clampScore(michiganImportance),
        michiganRelation,
        nationalImportance: clampScore(matchup.playoffImportance),
        playoffImportance: clampScore(matchup.playoffImportance),
        playoffLeverage: clampScore(matchup.playoffLeverage),
        projectedMargin: matchup.projectedMargin,
      }
    })

    return {
      games: scoredGames,
      generatedAt: Date.now(),
      edition,
      ratingCount: ratings.length,
      ratings,
      resumeVisible: edition?.resumeVisible ?? false,
      season,
      week,
    }
  },
})

export const getMatchup = query({
  args: {
    programKeyA: v.string(),
    programKeyB: v.string(),
    season: v.number(),
    venue: v.union(
      v.literal('neutral'),
      v.literal('team_a'),
      v.literal('team_b'),
    ),
  },
  handler: async (ctx, args) => {
    if (args.programKeyA === args.programKeyB) {
      throw new Error('Choose two different teams for a matchup.')
    }
    const season = Math.floor(args.season)
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
    const edition = await latestPublishedEdition(ctx, season)
    const [snapshotA, snapshotB] = edition
      ? await Promise.all([
          ctx.db
            .query('teamRatingSnapshots')
            .withIndex('by_programId_and_edition', (q) =>
              q.eq('programId', programA._id).eq('editionId', edition._id),
            )
            .unique(),
          ctx.db
            .query('teamRatingSnapshots')
            .withIndex('by_programId_and_edition', (q) =>
              q.eq('programId', programB._id).eq('editionId', edition._id),
            )
            .unique(),
        ])
      : [null, null]
    const [legacyRatingA, legacyRatingB] = await Promise.all([
      ctx.db
        .query('teamCompositeRatings')
        .withIndex('by_programId_and_season', (q) =>
          q.eq('programId', programA._id).eq('season', season),
        )
        .unique(),
      ctx.db
        .query('teamCompositeRatings')
        .withIndex('by_programId_and_season', (q) =>
          q.eq('programId', programB._id).eq('season', season),
        )
        .unique(),
    ])
    if ((!snapshotA || !snapshotB) && (!legacyRatingA || !legacyRatingB)) {
      return null
    }

    const matchupKey = [programA._id, programB._id].sort().join(':')
    const history = (
      await ctx.db
        .query('collegeGames')
        .withIndex('by_matchupKey_and_startTime', (q) =>
          q.eq('matchupKey', matchupKey),
        )
        .order('desc')
        .take(50)
    ).filter(
      (game) =>
        game.completed &&
        game.season <= season &&
        game.homePoints !== undefined &&
        game.awayPoints !== undefined,
    )
    let teamAWins = 0
    let teamBWins = 0
    let ties = 0
    for (const game of history) {
      if (game.homePoints === game.awayPoints) {
        ties += 1
        continue
      }
      const homeWon = (game.homePoints ?? 0) > (game.awayPoints ?? 0)
      const winner = homeWon ? game.homeProgramId : game.awayProgramId
      if (winner === programA._id) teamAWins += 1
      else teamBWins += 1
    }

    if (edition && snapshotA && snapshotB) {
      const calibration: LogisticMarginCalibration | undefined =
        edition.calibrationVersion === 'logistic-margin-v1' &&
        edition.calibrationFitCount !== undefined &&
        edition.calibrationIntercept !== undefined &&
        edition.calibrationMaximumProbability !== undefined &&
        edition.calibrationMinimumProbability !== undefined &&
        edition.calibrationSlope !== undefined &&
        edition.calibrationTrainingSeasons !== undefined
          ? {
              fitCount: edition.calibrationFitCount,
              intercept: edition.calibrationIntercept,
              maximumProbability: edition.calibrationMaximumProbability,
              minimumProbability: edition.calibrationMinimumProbability,
              slope: edition.calibrationSlope,
              trainingSeasons: edition.calibrationTrainingSeasons,
              version: 'logistic-margin-v1',
            }
          : undefined
      const toPowerRating = (rating: typeof snapshotA): PowerTeamRating => ({
        classification: rating.classification,
        conference: rating.conference,
        dataSources: rating.dataSources,
        defense: rating.defense,
        gamesPlayed: rating.gamesPlayed,
        homeFieldAdvantage: rating.homeFieldAdvantage,
        limitedSample: rating.limitedSample,
        name: rating.sourceProgramName,
        offense: rating.offense,
        power: rating.power,
        priorWeight: rating.priorWeight,
        published: rating.published,
        rank: rating.powerRank,
        specialTeams: rating.specialTeams,
        specialTeamsAvailable: rating.specialTeamsAvailable,
        teamId: String(rating.programId),
      })
      const powerRatingA = toPowerRating(snapshotA)
      const powerRatingB = toPowerRating(snapshotB)
      const powerProjection = projectPowerMatchup(
        {
          calibration,
          cutoffAt: edition.cutoffAt,
          leagueAveragePoints: edition.leagueAveragePoints,
          modelVersion: POWER_MODEL_VERSION,
          ratings: [powerRatingA, powerRatingB],
          season,
          week: edition.week,
        },
        String(programA._id),
        String(programB._id),
        args.venue,
      )
      return {
        edition,
        history: {
          lastFive: history.slice(0, 5),
          meetings: history.length,
          teamAWins,
          teamBWins,
          ties,
        },
        programA,
        programB,
        projection: {
          confidence: Math.round(
            100 * (1 - Math.max(snapshotA.priorWeight, snapshotB.priorWeight)),
          ),
          probabilityCalibrationVersion:
            powerProjection.probabilityCalibrationVersion,
          projectedMargin: powerProjection.projectedMargin,
          projectedScore: powerProjection.projectedScore,
          teamAWinProbability: Math.round(
            powerProjection.teamAWinProbability * 100,
          ),
          teamBWinProbability: Math.round(
            powerProjection.teamBWinProbability * 100,
          ),
          unitMatchups: [
            {
              description: 'Expected points above an average FBS team',
              key: 'power',
              label: 'Power Rating',
              teamA: snapshotA.power,
              teamB: snapshotB.power,
            },
            {
              description: 'Opponent-adjusted scoring contribution',
              key: 'offense',
              label: 'Offense',
              teamA: snapshotA.offense,
              teamB: snapshotB.offense,
            },
            {
              description: 'Opponent-adjusted points prevented',
              key: 'defense',
              label: 'Defense',
              teamA: snapshotA.defense,
              teamB: snapshotB.defense,
            },
            {
              description: 'Strongly regularized special-teams contribution',
              key: 'specialTeams',
              label: 'Special teams',
              teamA: snapshotA.specialTeams,
              teamB: snapshotB.specialTeams,
            },
            {
              description: 'Team-specific value applied only at home',
              key: 'homeField',
              label: 'Home-field advantage',
              teamA: snapshotA.homeFieldAdvantage,
              teamB: snapshotB.homeFieldAdvantage,
            },
          ],
        },
        ratingA: snapshotA,
        ratingB: snapshotB,
        season,
        venue: args.venue,
      }
    }

    const ratingA = legacyRatingA!
    const ratingB = legacyRatingB!
    return {
      history: {
        lastFive: history.slice(0, 5),
        meetings: history.length,
        teamAWins,
        teamBWins,
        ties,
      },
      programA,
      programB,
      projection: buildMatchupProjection(ratingA, ratingB, args.venue),
      ratingA,
      ratingB,
      season,
      venue: args.venue,
    }
  },
})
