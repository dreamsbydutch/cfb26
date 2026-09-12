import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server'
import { resolveProgram } from './programIdentity'
import { buildFallbackPowerField } from './ratingFallback'
import { calibrateMargin } from './ratingBacktest'
import { publicationWeek } from './ratingCalendar'
import { cancellationEvidence, isFbsGame, isResolvedGame } from './gameStatus'
import { gameEvidenceValidator } from './evidenceFields'
import {
  POWER_CARRYOVER,
  historicalPowerPrior,
  offensiveReturningShare,
  rememberPowerSeason,
  withOffensiveContinuity,
} from './powerHistory'
import { calibratePowerEdition } from './powerCalibration'
import { POWER_RELEASE_CALIBRATION } from './powerRelease'
import { programSnapshotFields, rankingEditionFields } from './ratingFields'
import schema from './schema'
import {
  PROGRAM_MODEL_VERSION,
  acquisitionPercentiles,
  buildProgramRatings,
  developmentWithConversion,
  evidencePercentiles,
} from './programRating'
import { buildMatchupProjection, buildSeasonRatings } from './ratingModel'
import {
  POWER_FIT_POLICY,
  POWER_MODEL_VERSION,
  RESUME_MODEL_VERSION,
  buildPowerRatingEdition,
  buildResumeRatingEdition,
  projectPowerMatchup,
  scoreWeeklyMatchup,
} from './ratingSystem'
import {
  buildPlayoffProjection,
  classifyQuadrant,
  moveBallotEntry,
} from './rankingTools'
import { requireOwnerSession } from './rosterAdmin'
import type { PowerHistory } from './powerHistory'
import type { ProgramSeasonEvidence } from './programRating'
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
const MAX_MODEL_ROWS = 600
const MAX_PROGRAM_ROWS = 1_000

type SourceRow = Record<string, unknown>
type PowerModelData = {
  profiles: Array<Doc<'teamSeasonProfiles'>>
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
  ...programSnapshotFields,
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
): Promise<Doc<'ratingEditions'> | null> {
  const editions = []
  for (const editionType of ['amendment', 'official', 'nightly'] as const) {
    const edition = await ctx.db
      .query('ratingEditions')
      .withIndex('by_season_week_type_revision', (q) =>
        q.eq('season', season).eq('week', week).eq('editionType', editionType),
      )
      .order('desc')
      .first()
    if (edition) editions.push(edition)
  }
  return (
    editions.sort(
      (a, b) => b.cutoffAt - a.cutoffAt || b.generatedAt - a.generatedAt,
    )[0] ?? null
  )
}

export const getRatingField = query({
  args: {
    season: v.number(),
    week: v.number(),
    view: v.union(
      v.literal('current'),
      v.literal('weekly'),
      v.literal('selection'),
      v.literal('final'),
    ),
  },
  returns: v.union(
    v.null(),
    v.object({
      edition: schema.doc('ratingEditions'),
      rows: v.array(schema.doc('teamRatingSnapshots')),
    }),
  ),
  handler: async (ctx, args) => {
    if (
      !Number.isInteger(args.season) ||
      !Number.isInteger(args.week) ||
      args.week < 0 ||
      args.week > 30
    )
      throw new Error('Invalid rating season/week.')
    const edition =
      args.view === 'current'
        ? await preferredWeeklyEdition(ctx, args.season, args.week)
        : args.view === 'weekly'
          ? await ctx.db
              .query('ratingEditions')
              .withIndex('by_season_week_type_revision', (q) =>
                q
                  .eq('season', args.season)
                  .eq('week', args.week)
                  .eq('editionType', 'official'),
              )
              .first()
          : ((
              await ctx.db
                .query('ratingEditions')
                .withIndex('by_season_stage_cutoff', (q) =>
                  q
                    .eq('season', args.season)
                    .eq(
                      'rankingStage',
                      args.view === 'selection' ? 'selection' : 'final',
                    ),
                )
                .order('desc')
                .take(100)
            ).find((row) => row.editionType !== 'research') ?? null)
    if (!edition) return null
    const rows = await ctx.db
      .query('teamRatingSnapshots')
      .withIndex('by_edition_and_power', (q) => q.eq('editionId', edition._id))
      .take(601)
    if (rows.length > 600)
      throw new Error('Rating field exceeds publication bound.')
    return {
      edition,
      rows: rows
        .filter((row) => row.published)
        .map((row) =>
          edition.resumeVisible
            ? row
            : {
                ...row,
                recordDifficulty: undefined,
                recordProbability: undefined,
                resume: undefined,
                resumeRank: undefined,
                dominanceComponent: undefined,
                scheduleComponent: undefined,
              },
        ),
    }
  },
})

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
      ctx.db.query('programs').withIndex('by_key').take(MAX_PROGRAM_ROWS),
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
  returns: v.object({
    games: v.array(schema.doc('collegeGames')),
    profiles: v.array(schema.doc('teamSeasonProfiles')),
    programs: v.array(schema.doc('programs')),
    seasons: v.array(v.number()),
  }),
  handler: async (ctx, args) => {
    const season = Math.floor(args.season)
    const seasons = Array.from({ length: 5 }, (_, index) => season - 4 + index)
    const [programs, gamesBySeason, profilesBySeason] = await Promise.all([
      ctx.db
        .query('programs')
        .withIndex('by_key')
        .take(MAX_PROGRAM_ROWS + 1),
      Promise.all(
        seasons.map((modelSeason) =>
          ctx.db
            .query('collegeGames')
            .withIndex('by_season_and_startTime', (q) =>
              q.eq('season', modelSeason),
            )
            .take(2_001),
        ),
      ),
      Promise.all(
        seasons.map((modelSeason) =>
          ctx.db
            .query('teamSeasonProfiles')
            .withIndex('by_season_and_recruitingRank', (q) =>
              q.eq('season', modelSeason),
            )
            .take(601),
        ),
      ),
    ])
    if (
      programs.length > MAX_PROGRAM_ROWS ||
      gamesBySeason.some((games) => games.length > 2000) ||
      profilesBySeason.some((profiles) => profiles.length > 600)
    )
      throw new Error('Power source slice exceeds its bound.')
    return {
      games: gamesBySeason.flat(),
      profiles: profilesBySeason.flat(),
      programs,
      seasons,
    }
  },
})

export const loadProgramSeasonEvidence = internalQuery({
  args: { season: v.number(), cutoffAt: v.number() },
  returns: v.object({
    games: v.array(
      v.object({
        id: v.string(),
        ratingEvidence: v.optional(gameEvidenceValidator),
        homeTeamId: v.string(),
        awayTeamId: v.string(),
        homeClassification: ratingClassificationValidator,
        awayClassification: ratingClassificationValidator,
        homePoints: v.number(),
        awayPoints: v.number(),
        completed: v.boolean(),
        kickoffAt: v.number(),
        neutralSite: v.boolean(),
        overtimePeriods: v.number(),
        season: v.number(),
        week: v.number(),
      }),
    ),
    profiles: v.array(
      v.object({
        teamId: v.string(),
        talent: v.union(v.number(), v.null()),
        recruitingPoints: v.union(v.number(), v.null()),
        returningUsage: v.union(v.number(), v.null()),
      }),
    ),
    drafts: v.array(v.object({ teamId: v.string(), value: v.number() })),
    members: v.array(
      v.object({
        teamId: v.string(),
        conference: v.string(),
        classification: ratingClassificationValidator,
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const [games, profiles, drafts, affiliations] = await Promise.all([
      ctx.db
        .query('collegeGames')
        .withIndex('by_season_and_startTime', (q) =>
          q.eq('season', args.season).lt('startTime', args.cutoffAt),
        )
        .take(2001),
      ctx.db
        .query('teamSeasonProfiles')
        .withIndex('by_season_and_recruitingRank', (q) =>
          q.eq('season', args.season),
        )
        .take(601),
      ctx.db
        .query('teamDraftSelections')
        .withIndex('by_year_and_pick', (q) => q.eq('year', args.season))
        .take(601),
      ctx.db
        .query('programAffiliations')
        .withIndex('by_startSeason_and_conference', (q) =>
          q.eq('startSeason', args.season),
        )
        .take(601),
    ])
    if (
      games.length > 2000 ||
      profiles.length > 600 ||
      drafts.length > 600 ||
      affiliations.length > 600
    )
      throw new Error(
        'Rating source slice exceeds its bound; publication stopped rather than truncating evidence.',
      )
    const directoryAt = Math.max(
      0,
      ...affiliations.map((row) => row.sourceUpdatedAt ?? 0),
    )
    const directory = affiliations.filter(
      (row) =>
        row.sourceUpdatedAt === directoryAt && row.classification !== undefined,
    )
    const completeDirectory =
      directory.length > 0 &&
      directory.every((row) => row.directorySize === directory.length)
    return {
      games: games.flatMap((game) =>
        game.completed &&
        game.homePoints !== undefined &&
        game.awayPoints !== undefined
          ? [
              {
                id: String(game.sourceGameId),
                ratingEvidence:
                  game.ratingEvidence?.observedAt !== undefined &&
                  game.ratingEvidence.observedAt < args.cutoffAt
                    ? game.ratingEvidence
                    : undefined,
                homeTeamId: String(game.homeProgramId),
                awayTeamId: String(game.awayProgramId),
                homeClassification: normalizedClassification(
                  game.homeClassification,
                ),
                awayClassification: normalizedClassification(
                  game.awayClassification,
                ),
                homePoints: game.homePoints,
                awayPoints: game.awayPoints,
                completed: true,
                kickoffAt: game.startTime,
                neutralSite: game.neutralSite,
                overtimePeriods: overtimePeriods(
                  game.homeLineScores,
                  game.awayLineScores,
                ),
                season: game.season,
                week: game.week,
              },
            ]
          : [],
      ),
      // Mutable enrichment cannot be reconstructed as if it were observed earlier.
      profiles: profiles
        .filter((row) => row.sourceUpdatedAt < args.cutoffAt)
        .map((row) => ({
          teamId: String(row.programId),
          talent: row.talent,
          recruitingPoints: row.recruitingPoints,
          returningUsage: row.returningUsage,
        })),
      drafts: drafts
        .filter((row) => row.sourceUpdatedAt < args.cutoffAt)
        .map((row) => ({
          teamId: String(row.programId),
          value: 1 + (8 - Math.min(row.round, 7)) / 7,
        })),
      members: (completeDirectory ? directory : []).flatMap((row) =>
        row.classification
          ? [
              {
                teamId: String(row.programId),
                conference: row.conference,
                classification: row.classification,
              },
            ]
          : [],
      ),
    }
  },
})

export const ratingSourceVersion = internalQuery({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const states = await Promise.all(
      (
        ['games', 'programs', 'recruiting', 'draft', 'rating_inputs'] as const
      ).map((source) =>
        ctx.db
          .query('teamDataSyncState')
          .withIndex('by_source', (q) => q.eq('source', source))
          .unique(),
      ),
    )
    return `${POWER_MODEL_VERSION}:${PROGRAM_MODEL_VERSION}:${RESUME_MODEL_VERSION}:${states.map((row) => `${row?.source}:${row?.completedAt ?? 0}:${row?.status ?? 'missing'}`).join('|')}`
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
      ...rankingEditionFields,
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
      new Set(args.rows.map((row) => String(row.programId))).size !==
      args.rows.length
    )
      throw new Error('Duplicate team in rating edition.')
    const field = args.rows.filter((row) => row.published)
    for (const key of ['powerRank', 'programRank', 'resumeRank'] as const) {
      if (key === 'programRank' && !args.edition.programModelVersion) continue
      const ranks = field
        .map((row) => row[key])
        .sort((a, b) => (a ?? 0) - (b ?? 0))
      if (ranks.some((rank, index) => rank !== index + 1))
        throw new Error(`Incomplete ${key} field.`)
    }
    if (
      args.edition.rankingStage === 'selection' &&
      args.edition.editionType !== 'research'
    ) {
      const frozen = await ctx.db
        .query('ratingEditions')
        .withIndex('by_season_stage_cutoff', (q) =>
          q.eq('season', args.edition.season).eq('rankingStage', 'selection'),
        )
        .take(100)
      const published = frozen.find((row) => row.editionType !== 'research')
      if (published)
        return { editionId: published._id, inserted: false, rows: 0 }
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

export const storeDerivedEditionOutputs = internalMutation({
  args: { editionId: v.id('ratingEditions') },
  handler: async (ctx, args) => {
    const edition = await ctx.db.get('ratingEditions', args.editionId)
    if (!edition) throw new Error('Rating edition was not found.')
    if (edition.editionType === 'research' || edition.season < 2026) {
      return { forecasts: 0, playoff: false }
    }
    const [snapshots, games, rule, champions] = await Promise.all([
      ctx.db
        .query('teamRatingSnapshots')
        .withIndex('by_edition_and_power', (q) =>
          q.eq('editionId', edition._id),
        )
        .take(600),
      ctx.db
        .query('collegeGames')
        .withIndex('by_season_and_startTime', (q) =>
          q.eq('season', edition.season).gte('startTime', edition.cutoffAt),
        )
        .take(2_000),
      ctx.db
        .query('seasonRules')
        .withIndex('by_season', (q) => q.eq('season', edition.season))
        .unique(),
      ctx.db
        .query('conferenceChampions')
        .withIndex('by_season_and_conference', (q) =>
          q.eq('season', edition.season),
        )
        .take(500),
    ])
    const byProgram = new Map(
      snapshots.map((row) => [String(row.programId), row]),
    )
    let forecasts = 0
    for (const game of games) {
      const home = byProgram.get(String(game.homeProgramId))
      const away = byProgram.get(String(game.awayProgramId))
      if (
        !home ||
        !away ||
        !isFbsGame(game) ||
        game.completed ||
        cancellationEvidence(game)
      )
        continue
      const homeFieldEffect = game.neutralSite ? 0 : home.homeFieldAdvantage
      const expectedMargin =
        Math.round((home.power - away.power + homeFieldEffect) * 10) / 10
      const calibration = editionCalibration(edition)
      const winProbability = calibration
        ? calibrateMargin(expectedMargin, calibration)
        : Math.round(
            Math.min(
              Math.max(1 / (1 + Math.exp(-expectedMargin / 6.5)), 0.03),
              0.97,
            ) * 10_000,
          ) / 10_000
      const sourceKey = `${edition._id}:${game._id}`
      const existing = await ctx.db
        .query('frozenForecasts')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
        .unique()
      if (existing) continue
      await ctx.db.insert('frozenForecasts', {
        awayProgramId: game.awayProgramId,
        calibrationVersion: edition.calibrationVersion,
        cutoffAt: edition.cutoffAt,
        editionId: edition._id,
        expectedMargin,
        frozenAt: Date.now(),
        gameId: game._id,
        homeFieldEffect,
        homeProgramId: game.homeProgramId,
        modelVersion: edition.modelVersion,
        sourceKey,
        uncertainty:
          Math.round(
            (7 +
              Math.max(home.priorWeight, away.priorWeight) * 12 +
              (home.limitedSample || away.limitedSample ? 3 : 0)) *
              10,
          ) / 10,
        winProbability,
      })
      forecasts += 1
    }

    if (!edition.resumeVisible || !rule) return { forecasts, playoff: false }
    const championIds = new Set(champions.map((row) => String(row.programId)))
    const projection = buildPlayoffProjection({
      rules: {
        byeCount: rule.playoffByeCount,
        championBidCount: rule.playoffChampionBidCount,
        fieldSize: rule.playoffFieldSize,
      },
      teams: snapshots.flatMap((snapshot) =>
        snapshot.resumeRank !== undefined && snapshot.classification === 'fbs'
          ? [
              {
                conference: snapshot.conference ?? null,
                conferenceChampion: championIds.has(String(snapshot.programId)),
                programKey: String(snapshot.programId),
                resumeRank: snapshot.resumeRank,
              },
            ]
          : [],
      ),
    })
    const sourceKey = `${edition._id}:${rule.version}`
    const existingProjection = await ctx.db
      .query('playoffProjections')
      .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
      .unique()
    if (!existingProjection) {
      await ctx.db.insert('playoffProjections', {
        editionId: edition._id,
        field: projection.field
          .map((entry) => ({
            ...entry,
            programId: entry.programKey as Id<'programs'>,
          }))
          .map(({ programKey: _programKey, ...entry }) => entry),
        firstTeamOutProgramId: projection.firstTeamOut as Id<'programs'> | null,
        generatedAt: Date.now(),
        rulesVersion: rule.version,
        season: edition.season,
        sourceKey,
        week: edition.week,
      })
    }
    return { forecasts, playoff: true }
  },
})

function normalizedClassification(value: string | undefined) {
  const classification = value?.toLowerCase()
  if (classification === 'fcs') return 'fcs' as const
  if (classification === 'transitioning') return 'transitioning' as const
  if (classification === 'fbs') return 'fbs' as const
  return 'fcs' as const
}

function editionCalibration(
  edition: Doc<'ratingEditions'>,
): LogisticMarginCalibration | undefined {
  if (edition.calibrationVersion !== 'logistic-margin-v1') return undefined
  if (
    edition.calibrationFitCount === undefined ||
    edition.calibrationIntercept === undefined ||
    edition.calibrationMaximumProbability === undefined ||
    edition.calibrationMinimumProbability === undefined ||
    edition.calibrationSlope === undefined ||
    edition.calibrationTrainingSeasons === undefined
  )
    throw new Error('Published calibration metadata is incomplete.')
  return {
    fitCount: edition.calibrationFitCount,
    intercept: edition.calibrationIntercept,
    maximumProbability: edition.calibrationMaximumProbability,
    minimumProbability: edition.calibrationMinimumProbability,
    slope: edition.calibrationSlope,
    trainingSeasons: edition.calibrationTrainingSeasons,
    version: 'logistic-margin-v1',
  }
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
    rankingStage: v.optional(
      v.union(
        v.literal('in_season'),
        v.literal('selection'),
        v.literal('final'),
      ),
    ),
    cutoffAt: v.number(),
    editionType: editionTypeValidator,
    revision: v.optional(v.number()),
    season: v.number(),
    supersedesEditionId: v.optional(v.id('ratingEditions')),
    week: v.number(),
  },
  handler: async (ctx, args): Promise<StoredEditionResult> => {
    const sourceVersion = await ctx.runQuery(
      internal.ratings.ratingSourceVersion,
      {},
    )
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
    const currentEvidence = await ctx.runQuery(
      internal.ratings.loadProgramSeasonEvidence,
      { season, cutoffAt: args.cutoffAt },
    )
    const confirmedMembers = new Map(
      currentEvidence.members.map((row) => [row.teamId, row]),
    )
    const history: PowerHistory = new Map()
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
      >()
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
      if (modelSeason === season && confirmedMembers.size > 0) {
        for (const [teamId, detail] of details) {
          if (!confirmedMembers.has(teamId))
            details.set(teamId, { ...detail, classification: 'fcs' })
        }
        for (const member of confirmedMembers.values())
          details.set(member.teamId, member)
      }
      const teams: Array<PowerRatingTeam> = [...details].flatMap(
        ([teamId, detail]) => {
          const program = programById.get(teamId)
          if (!program) return []
          return [
            {
              ...detail,
              id: teamId,
              name: program.name,
              prior: withOffensiveContinuity(
                historicalPowerPrior(
                  { id: teamId, ...detail },
                  modelSeason,
                  history,
                  POWER_CARRYOVER,
                ),
                offensiveReturningShare(
                  data.profiles.find(
                    (profile) =>
                      String(profile.programId) === teamId &&
                      profile.season === modelSeason &&
                      profile.sourceUpdatedAt < args.cutoffAt,
                  ),
                ),
              ),
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
            ratingEvidence: game.ratingEvidence,
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
        ...POWER_FIT_POLICY,
        evidenceCutoffAt: args.cutoffAt,
        calibration: modelSeason === season ? args.calibration : undefined,
        cutoffAt: modelCutoff,
        games: modelGames,
        season: modelSeason,
        teams,
        week: modelSeason === season ? week : 30,
      })
      rememberPowerSeason(history, modelSeason, powerEdition.ratings)
    }
    if (!powerEdition || powerEdition.season !== season) {
      throw new Error('Unable to build the requested Power Rating edition.')
    }
    // History remains in fitted units; only the final edition gets point-scale calibration.
    if (season >= 2026)
      powerEdition = calibratePowerEdition(
        powerEdition,
        POWER_RELEASE_CALIBRATION,
      )
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
          ratingEvidence: game.ratingEvidence,
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
    const programEvidence: Array<ProgramSeasonEvidence> = []
    const coverageWarnings = [
      'FCS opponent schedules are imported independently; missing game evidence falls back to capped scores and subdivision priors.',
      'National coaching, incoming transfer production, defensive continuity, and injury coverage remain unverified.',
      'Competitive drives require at least six qualifying possessions per side; other games retain capped final-margin performance.',
      ...(confirmedMembers.size === 0
        ? [
            'Membership is schedule-derived until the season FBS directory is synchronized.',
          ]
        : []),
    ]
    let currentEarned: PowerRatingEdition | undefined
    const talentBySeason = new Map<number, Map<string, number>>()
    for (
      let evidenceSeason = season - 9;
      evidenceSeason <= season;
      evidenceSeason++
    ) {
      const source =
        evidenceSeason === season
          ? currentEvidence
          : await ctx.runQuery(internal.ratings.loadProgramSeasonEvidence, {
              season: evidenceSeason,
              cutoffAt: args.cutoffAt,
            })
      const participantIds = new Set(
        source.games.flatMap((game) => [game.homeTeamId, game.awayTeamId]),
      )
      const memberIds = new Set(source.members.map((member) => member.teamId))
      const seasonClassifications = new Map(
        source.games.flatMap((game) => [
          [game.homeTeamId, game.homeClassification] as const,
          [game.awayTeamId, game.awayClassification] as const,
        ]),
      )
      const teams = data.programs
        .filter(
          (program) =>
            participantIds.has(String(program._id)) ||
            memberIds.has(String(program._id)) ||
            (evidenceSeason === season &&
              powerEdition.ratings.some(
                (row) => row.teamId === String(program._id),
              )),
        )
        .map((program) => ({
          id: String(program._id),
          name: program.name,
          classification:
            memberIds.size > 0
              ? memberIds.has(String(program._id))
                ? ('fbs' as const)
                : ('fcs' as const)
              : (seasonClassifications.get(String(program._id)) ??
                normalizedClassification(program.classification)),
        }))
      const earned = buildPowerRatingEdition({
        cutoffAt: args.cutoffAt,
        season: evidenceSeason,
        week: evidenceSeason === season ? week : 30,
        teams,
        games: source.games,
      })
      if (evidenceSeason === season) currentEarned = earned
      const publishedIds = new Set(
        earned.ratings.filter((row) => row.published).map((row) => row.teamId),
      )
      const acquisition = acquisitionPercentiles(source.profiles, publishedIds)
      const rosterTalent = acquisitionPercentiles(
        source.profiles.map((row) => ({ ...row, recruitingPoints: null })),
        publishedIds,
      )
      talentBySeason.set(evidenceSeason, rosterTalent)
      const draftValues = new Map<string, number>()
      // A broadly populated national draft establishes meaningful zero-pick observations.
      if (source.drafts.length >= 150) {
        for (const team of earned.ratings)
          if (team.published) draftValues.set(team.teamId, 0)
        for (const pick of source.drafts.filter((row) =>
          publishedIds.has(row.teamId),
        ))
          draftValues.set(
            pick.teamId,
            (draftValues.get(pick.teamId) ?? 0) + pick.value,
          )
      }
      const development = evidencePercentiles(draftValues)
      for (const row of earned.ratings)
        programEvidence.push({
          teamId: row.teamId,
          season: evidenceSeason,
          games: row.gamesPlayed,
          performance: 100 / (1 + Math.exp(-row.power / 10)),
          acquisition: acquisition.get(row.teamId),
          development: (() => {
            const output = development.get(row.teamId)
            if (output === undefined) return undefined
            // Prior roster talent includes transfers present at that program, unlike signing classes.
            const cohort = [1, 2, 3].map((age) =>
              talentBySeason.get(evidenceSeason - age)?.get(row.teamId),
            )
            const known = cohort.filter(
              (value): value is number => value !== undefined,
            )
            return developmentWithConversion(
              output,
              known.length === 3
                ? known.reduce((a, b) => a + b, 0) / 3
                : undefined,
            )
          })(),
        })
    }
    const programRatings = buildProgramRatings({
      season,
      teams: powerEdition.ratings,
      evidence: programEvidence,
    })
    const programRatingsByTeam = new Map(
      programRatings.map((row) => [row.teamId, row]),
    )
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
    const sourceDataFingerprint =
      gameDataFingerprint(
        data.games.filter(
          (game) => game.season === season && game.startTime < args.cutoffAt,
        ),
        args.cutoffAt,
      ) +
      ':' +
      sourceVersion
    const rows = powerEdition.ratings.flatMap((power) => {
      const program = programById.get(power.teamId)
      if (!program) return []
      const resume: ResumeTeamRating | undefined = resumeByTeam.get(
        power.teamId,
      )
      return [
        {
          ...(() => {
            const rating = programRatingsByTeam.get(power.teamId)
            if (!rating) return {}
            const { teamId: _teamId, ...fields } = rating
            return fields
          })(),
          seasonStrength: currentEarned?.ratings.find(
            (row) => row.teamId === power.teamId,
          )?.power,
          personnelCoverage: power.dataSources.includes(
            'verified_offensive_continuity',
          )
            ? 'offensive_usage_only'
            : 'unavailable',
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
          recordDifficulty: resume?.recordDifficulty,
          recordProbability: resume?.recordProbability,
          resumeRank: resume?.resumeRank,
          scheduleComponent: resume?.scheduleComponent,
          sourceProgramName: power.name,
          specialTeams: power.specialTeams,
          specialTeamsAvailable: power.specialTeamsAvailable,
        },
      ]
    })
    if (
      sourceVersion !==
      (await ctx.runQuery(internal.ratings.ratingSourceVersion, {}))
    )
      throw new Error(
        'Rating sources changed during the build; retry against one source vintage.',
      )
    const stored: StoredEditionResult = await ctx.runMutation(
      internal.ratings.storeRatingEdition,
      {
        edition: {
          programModelVersion: PROGRAM_MODEL_VERSION,
          membershipBasis:
            confirmedMembers.size > 0 ? 'season_directory' : 'schedule',
          rankingStage:
            args.rankingStage ??
            (() => {
              const schedule = data.games.filter(
                (game) =>
                  game.season === season &&
                  (game.homeClassification === 'fbs' ||
                    game.awayClassification === 'fbs'),
              )
              const regular = schedule.filter(
                (game) => game.seasonType === 'regular',
              )
              const postseason = schedule.filter(
                (game) => game.seasonType === 'postseason',
              )
              if (
                postseason.length > 0 &&
                schedule.every(
                  (game) =>
                    isResolvedGame(game) && game.startTime < args.cutoffAt,
                )
              )
                return 'final' as const
              if (
                regular.length > 0 &&
                regular.every(
                  (game) =>
                    isResolvedGame(game) && game.startTime < args.cutoffAt,
                ) &&
                postseason.length > 0 &&
                postseason.every(
                  (game) =>
                    cancellationEvidence(game) ||
                    game.startTime >= args.cutoffAt,
                )
              )
                return 'selection' as const
              return 'in_season' as const
            })(),
          coverageWarnings,
          calibrationFitCount: powerEdition.calibration?.fitCount,
          calibrationIntercept: powerEdition.calibration?.intercept,
          calibrationMaximumProbability:
            powerEdition.calibration?.maximumProbability,
          calibrationMinimumProbability:
            powerEdition.calibration?.minimumProbability,
          calibrationSlope: powerEdition.calibration?.slope,
          calibrationTrainingSeasons: powerEdition.calibration?.trainingSeasons,
          calibrationVersion:
            powerEdition.calibration?.version ?? 'fixed-logistic-v1',
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
      },
    )
    if (stored.inserted && args.editionType !== 'research' && season >= 2026) {
      await ctx.runMutation(internal.ratings.storeDerivedEditionOutputs, {
        editionId: stored.editionId,
      })
    }
    return stored
  },
})

export const resolveRatingWeek = internalQuery({
  args: { asOf: v.number(), season: v.number() },
  handler: async (ctx, args) => {
    const games = await ctx.db
      .query('collegeGames')
      .withIndex('by_season_and_startTime', (q) => q.eq('season', args.season))
      .take(2001)
    if (games.length > 2000)
      throw new Error('Schedule exceeds publication bound.')
    const publicSchedule = games.filter(
      (game) => isFbsGame(game) && !cancellationEvidence(game),
    )
    const selected =
      publicSchedule.find((game) => game.startTime > args.asOf) ??
      publicSchedule.at(-1)
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
      week: publicationWeek({
        asOf: args.asOf,
        selected: selected ?? null,
        schedule: publicSchedule,
      }),
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

export const publicationReadiness = internalQuery({
  args: {},
  handler: async (ctx) => {
    const games = await ctx.db
      .query('teamDataSyncState')
      .withIndex('by_source', (q) => q.eq('source', 'games'))
      .unique()
    return {
      ready: games?.status === 'succeeded' && (games.acceptedRows ?? 0) > 0,
      reason:
        games?.status === 'failed'
          ? (games.error ?? 'The college game sync failed.')
          : games?.status !== 'succeeded'
            ? 'The college game sync has not completed successfully.'
            : (games.acceptedRows ?? 0) === 0
              ? 'The college game sync returned no accepted rows.'
              : null,
    }
  },
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
    const sourceVersion = await ctx.runQuery(
      internal.ratings.ratingSourceVersion,
      {},
    )
    if (
      latest?.sourceDataFingerprint ===
      state.sourceDataFingerprint + ':' + sourceVersion
    ) {
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
    const readiness: { ready: boolean; reason: string | null } =
      await ctx.runQuery(internal.ratings.publicationReadiness, {})
    if (!readiness.ready) {
      throw new Error(`Official publication blocked: ${readiness.reason}`)
    }
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
    if (week === undefined)
      week = (await latestPublishedEdition(ctx, season))?.week
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
    const [allSchedule, snapshotRows, compositeRows, ratingRows, michigan] =
      await Promise.all([
        ctx.db
          .query('collegeGames')
          .withIndex('by_season_and_startTime', (q) => q.eq('season', season))
          .take(2001),
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

    if (allSchedule.length > 2000)
      throw new Error('Season schedule exceeds its publication bound.')
    const seasonSchedule = allSchedule.filter(
      (game) => isFbsGame(game) && !cancellationEvidence(game),
    )
    const games = seasonSchedule.filter(
      (game) =>
        publicationWeek({
          asOf: game.startTime,
          selected: game,
          schedule: seasonSchedule,
        }) === week,
    )
    const fallbackRows =
      snapshotRows.length === 0
        ? await Promise.all([
            ctx.db
              .query('collegeGames')
              .withIndex('by_season_and_startTime', (q) =>
                q.eq('season', season),
              )
              .take(2_000),
            ctx.db
              .query('teamCompositeRatings')
              .withIndex('by_season_and_overall', (q) =>
                q.eq('season', season - 1),
              )
              .order('desc')
              .take(200),
            ctx.db
              .query('teamSeasonRatings')
              .withIndex('by_season_and_rating', (q) =>
                q.eq('season', season - 1),
              )
              .order('desc')
              .take(200),
            ctx.db.query('programs').withIndex('by_key').take(MAX_PROGRAM_ROWS),
          ]).then(([seasonGames, previousComposite, previousElo, programs]) =>
            buildFallbackPowerField({
              currentComposite: compositeRows.map((row) => ({
                confidence: row.confidence,
                conference: row.conference,
                dataSources: row.dataSources,
                defense: row.dimensions.defense,
                modelVersion: row.modelVersion,
                offense: row.dimensions.offense,
                overall: row.overall,
                programId: String(row.programId),
                signalCount: row.signalCount,
                sourceProgramName: row.sourceProgramName,
                specialTeams: row.dimensions.specialTeams,
              })),
              currentElo: ratingRows.map((row) => ({
                conference: row.conference,
                programId: String(row.programId),
                rating: row.rating,
                sourceProgramName: row.sourceProgramName,
              })),
              games: seasonGames.map((game) => ({
                awayClassification: game.awayClassification,
                awayConference: game.awayConference,
                awayProgramId: String(game.awayProgramId),
                awaySourceName: game.awaySourceName,
                homeClassification: game.homeClassification,
                homeConference: game.homeConference,
                homeProgramId: String(game.homeProgramId),
                homeSourceName: game.homeSourceName,
              })),
              previousComposite: previousComposite.map((row) => ({
                confidence: row.confidence,
                conference: row.conference,
                dataSources: row.dataSources,
                defense: row.dimensions.defense,
                modelVersion: row.modelVersion,
                offense: row.dimensions.offense,
                overall: row.overall,
                programId: String(row.programId),
                signalCount: row.signalCount,
                sourceProgramName: row.sourceProgramName,
                specialTeams: row.dimensions.specialTeams,
              })),
              previousElo: previousElo.map((row) => ({
                conference: row.conference,
                programId: String(row.programId),
                rating: row.rating,
                sourceProgramName: row.sourceProgramName,
              })),
              previousSeason: season - 1,
              programs: programs.map((program) => ({
                conference: program.conference,
                id: String(program._id),
                key: program.key,
                name: program.name,
              })),
            }),
          )
        : []

    const ratings =
      snapshotRows.length > 0 && edition
        ? snapshotRows
            .filter((row) => row.published)
            .map((row) => ({
              ...row,
              calibrationVersion: edition.calibrationVersion,
              confidence: undefined,
              generatedAt: edition.generatedAt,
              modelVersion: edition.modelVersion,
              rank: row.powerRank ?? 999,
              rankingBasis: 'weekly_edition' as const,
              rating: row.power,
              signalCount: undefined,
              sourceSeason: season,
            }))
        : fallbackRows.map((row) => ({
            ...row,
            actualWins: undefined,
            calibrationVersion: 'fixed-logistic-v1',
            classification: 'fbs' as const,
            disagreementReasons:
              row.rankingBasis === 'neutral_baseline'
                ? ['no_current_or_prior_rating_evidence']
                : row.sourceSeason === season
                  ? ([] as Array<string>)
                  : ['prior_season_carryover'],
            dominanceComponent: undefined,
            expectedWins: undefined,
            gamesPlayed: 0,
            generatedAt: Date.now(),
            homeFieldAdvantage: 2.5,
            limitedSample: true,
            programId: row.programId as Id<'programs'>,
            published: true,
            rank: row.powerRank,
            rankDifference: undefined,
            rating: row.power,
            resume: undefined,
            resumeRank: undefined,
            scheduleComponent: undefined,
          }))
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
      rankingMode:
        snapshotRows.length > 0 && edition
          ? ('weekly_edition' as const)
          : fallbackRows.every((row) => row.rankingBasis === 'season_composite')
            ? ('season_composite' as const)
            : ('fallback' as const),
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
      const calibration = editionCalibration(edition)
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
          modelVersion: edition.modelVersion,
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

function averageOrNull(values: Array<number>) {
  return values.length === 0
    ? null
    : Math.round(
        (values.reduce((total, value) => total + value, 0) / values.length) *
          10,
      ) / 10
}

export const getMeritDashboard = query({
  args: {
    programKey: v.optional(v.string()),
    season: v.number(),
    week: v.number(),
  },
  handler: async (ctx, args) => {
    const edition = await preferredWeeklyEdition(
      ctx,
      Math.floor(args.season),
      Math.floor(args.week),
    )
    if (!edition) return null
    const snapshots = await ctx.db
      .query('teamRatingSnapshots')
      .withIndex('by_edition_and_power', (q) => q.eq('editionId', edition._id))
      .take(600)
    const programs = await Promise.all(
      snapshots.map((snapshot) => ctx.db.get('programs', snapshot.programId)),
    )
    const programById = new Map(
      programs.flatMap((program) =>
        program ? [[String(program._id), program] as const] : [],
      ),
    )
    const powerById = new Map(
      snapshots.map((snapshot) => [String(snapshot.programId), snapshot]),
    )
    const rankings = snapshots
      .filter((snapshot) => snapshot.published)
      .sort((a, b) =>
        edition.resumeVisible
          ? (a.resumeRank ?? 999) - (b.resumeRank ?? 999)
          : (a.powerRank ?? 999) - (b.powerRank ?? 999),
      )
      .map((snapshot) => ({
        program: programById.get(String(snapshot.programId)) ?? null,
        snapshot,
      }))
    const playoff = await ctx.db
      .query('playoffProjections')
      .withIndex('by_editionId', (q) => q.eq('editionId', edition._id))
      .unique()
    const playoffPrograms = playoff
      ? new Map(
          (
            await Promise.all(
              [
                ...playoff.field.map((entry) => entry.programId),
                ...(playoff.firstTeamOutProgramId
                  ? [playoff.firstTeamOutProgramId]
                  : []),
              ].map((programId) => ctx.db.get('programs', programId)),
            )
          ).flatMap((program) =>
            program ? [[String(program._id), program] as const] : [],
          ),
        )
      : new Map()

    let schedule = null
    if (args.programKey) {
      const program = await ctx.db
        .query('programs')
        .withIndex('by_key', (q) => q.eq('key', args.programKey as string))
        .unique()
      if (program) {
        const [home, away] = await Promise.all([
          ctx.db
            .query('collegeGames')
            .withIndex('by_homeProgramId_and_season', (q) =>
              q.eq('homeProgramId', program._id).eq('season', edition.season),
            )
            .take(40),
          ctx.db
            .query('collegeGames')
            .withIndex('by_awayProgramId_and_season', (q) =>
              q.eq('awayProgramId', program._id).eq('season', edition.season),
            )
            .take(40),
        ])
        const top25Power =
          [...snapshots]
            .filter((row) => row.classification === 'fbs')
            .sort((a, b) => b.power - a.power)[24]?.power ?? 0
        const rows = [...home, ...away]
          .map((game) => {
            const isHome = game.homeProgramId === program._id
            const opponentId = isHome ? game.awayProgramId : game.homeProgramId
            const opponent = powerById.get(String(opponentId))
            const opponentProgram = programById.get(String(opponentId)) ?? null
            const opponentRank = opponent?.powerRank ?? null
            const venueEffect = game.neutralSite ? 0 : isHome ? 2.5 : -2.5
            const benchmarkProbability = opponent
              ? 1 /
                (1 +
                  Math.exp(-(top25Power - opponent.power + venueEffect) / 6.5))
              : null
            const completedAtCutoff =
              game.completed && game.startTime < edition.cutoffAt
            return {
              benchmarkProbability,
              completedAtCutoff,
              game,
              opponent,
              opponentProgram,
              quadrant:
                completedAtCutoff && opponent?.classification === 'fbs'
                  ? classifyQuadrant(opponentRank)
                  : null,
            }
          })
          .sort(
            (a, b) =>
              (b.opponent?.power ?? Number.NEGATIVE_INFINITY) -
                (a.opponent?.power ?? Number.NEGATIVE_INFINITY) ||
              a.game.startTime - b.game.startTime,
          )
        const summarize = (selected: typeof rows) => ({
          averageOpponentPower: averageOrNull(
            selected.flatMap((row) =>
              row.opponent ? [row.opponent.power] : [],
            ),
          ),
          benchmarkExpectedWins:
            Math.round(
              selected.reduce(
                (total, row) => total + (row.benchmarkProbability ?? 0),
                0,
              ) * 10,
            ) / 10,
          games: selected.length,
        })
        schedule = {
          conference: summarize(rows.filter((row) => row.game.conferenceGame)),
          full: summarize(rows),
          nonconference: summarize(
            rows.filter((row) => !row.game.conferenceGame),
          ),
          played: summarize(rows.filter((row) => row.completedAtCutoff)),
          quadrants: ['Q1', 'Q2', 'Q3', 'Q4'].map((quadrant) => ({
            quadrant,
            games: rows.filter((row) => row.quadrant === quadrant),
          })),
          remaining: summarize(rows.filter((row) => !row.completedAtCutoff)),
          rows,
        }
      }
    }
    return {
      edition,
      playoff: playoff
        ? {
            ...playoff,
            field: playoff.field.map((entry) => ({
              ...entry,
              program: playoffPrograms.get(String(entry.programId)) ?? null,
            })),
            firstTeamOut: playoff.firstTeamOutProgramId
              ? (playoffPrograms.get(String(playoff.firstTeamOutProgramId)) ??
                null)
              : null,
          }
        : null,
      rankings,
      schedule,
    }
  },
})

export const initializeBallot = mutation({
  args: {
    restart: v.optional(v.boolean()),
    season: v.number(),
    sessionToken: v.string(),
    week: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const edition = await preferredWeeklyEdition(ctx, args.season, args.week)
    if (!edition || !edition.resumeVisible) {
      throw new Error('A Week 7 or later Resume edition is required.')
    }
    const existing = await ctx.db
      .query('rankingBallots')
      .withIndex('by_season_and_week', (q) =>
        q.eq('season', args.season).eq('week', args.week),
      )
      .unique()
    if (existing?.status === 'submitted') {
      throw new Error('A submitted ballot is locked.')
    }
    if (existing && !args.restart) return existing._id
    const snapshots = await ctx.db
      .query('teamRatingSnapshots')
      .withIndex('by_edition_and_resume', (q) => q.eq('editionId', edition._id))
      .take(600)
    const seeded = snapshots
      .filter(
        (row) => row.classification === 'fbs' && row.resumeRank !== undefined,
      )
      .sort(
        (a, b) =>
          (a.resumeRank ?? 999) - (b.resumeRank ?? 999) ||
          a.programKey.localeCompare(b.programKey),
      )
      .map((row, index) => ({
        programId: row.programId,
        rank: index + 1,
        seedRank: index + 1,
      }))
    const document = {
      editionId: edition._id,
      entries: seeded,
      season: args.season,
      status: 'draft' as const,
      submittedAt: null,
      updatedAt: Date.now(),
      week: args.week,
    }
    if (existing) {
      await ctx.db.replace('rankingBallots', existing._id, document)
      return existing._id
    }
    return ctx.db.insert('rankingBallots', document)
  },
})

export const moveBallotTeam = mutation({
  args: {
    programId: v.id('programs'),
    season: v.number(),
    sessionToken: v.string(),
    targetRank: v.number(),
    week: v.number(),
  },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const ballot = await ctx.db
      .query('rankingBallots')
      .withIndex('by_season_and_week', (q) =>
        q.eq('season', args.season).eq('week', args.week),
      )
      .unique()
    if (!ballot || ballot.status !== 'draft')
      throw new Error('Editable ballot was not found.')
    const order = moveBallotEntry(
      ballot.entries
        .sort((a, b) => a.rank - b.rank)
        .map((entry) => String(entry.programId)),
      String(args.programId),
      args.targetRank,
    )
    const byId = new Map(
      ballot.entries.map((entry) => [String(entry.programId), entry]),
    )
    const entries = order.map((programId, index) => ({
      ...byId.get(programId)!,
      rank: index + 1,
    }))
    await ctx.db.patch('rankingBallots', ballot._id, {
      entries,
      updatedAt: Date.now(),
    })
    return ballot._id
  },
})

export const submitBallot = mutation({
  args: { season: v.number(), sessionToken: v.string(), week: v.number() },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const ballot = await ctx.db
      .query('rankingBallots')
      .withIndex('by_season_and_week', (q) =>
        q.eq('season', args.season).eq('week', args.week),
      )
      .unique()
    if (!ballot || ballot.status !== 'draft')
      throw new Error('Editable ballot was not found.')
    await ctx.db.patch('rankingBallots', ballot._id, {
      status: 'submitted',
      submittedAt: Date.now(),
      updatedAt: Date.now(),
    })
    return ballot._id
  },
})

export const getBallot = query({
  args: {
    season: v.number(),
    sessionToken: v.optional(v.string()),
    week: v.number(),
  },
  handler: async (ctx, args) => {
    const ballot = await ctx.db
      .query('rankingBallots')
      .withIndex('by_season_and_week', (q) =>
        q.eq('season', args.season).eq('week', args.week),
      )
      .unique()
    if (!ballot) return null
    if (ballot.status === 'draft') {
      if (!args.sessionToken) return null
      await requireOwnerSession(ctx, args.sessionToken)
    }
    const snapshots = await ctx.db
      .query('teamRatingSnapshots')
      .withIndex('by_edition_and_resume', (q) =>
        q.eq('editionId', ballot.editionId),
      )
      .take(600)
    const polls = await ctx.db
      .query('externalPollRanks')
      .withIndex('by_season_and_week_and_poll', (q) =>
        q.eq('season', args.season).eq('week', args.week),
      )
      .take(1_000)
    const snapshotById = new Map(
      snapshots.map((row) => [String(row.programId), row]),
    )
    const previous = await ctx.db
      .query('rankingBallots')
      .withIndex('by_season_and_week', (q) =>
        q.eq('season', args.season).eq('week', Math.max(0, args.week - 1)),
      )
      .unique()
    const previousById = new Map(
      (previous?.status === 'submitted' ? previous.entries : []).map(
        (entry) => [String(entry.programId), entry.rank] as const,
      ),
    )
    const pollRank = (programId: Id<'programs'>, pattern: RegExp) =>
      polls.find((row) => row.programId === programId && pattern.test(row.poll))
        ?.rank ?? null
    const entries = await Promise.all(
      ballot.entries
        .sort((a, b) => a.rank - b.rank)
        .map(async (entry) => {
          const snapshot = snapshotById.get(String(entry.programId))
          return {
            ...entry,
            evidence: snapshot
              ? {
                  actualWins: snapshot.actualWins ?? null,
                  apRank: pollRank(entry.programId, /associated press|ap top/i),
                  cfpRank: pollRank(entry.programId, /playoff|cfp/i),
                  dominance: snapshot.dominanceComponent ?? null,
                  expectedWins: snapshot.expectedWins ?? null,
                  powerRank: snapshot.powerRank ?? null,
                  previousRank:
                    previousById.get(String(entry.programId)) ?? null,
                  quadrantRecord: snapshot.disagreementReasons,
                  resumeRank: snapshot.resumeRank ?? null,
                  schedule: snapshot.scheduleComponent ?? null,
                }
              : null,
            program:
              ballot.status === 'submitted'
                ? await ctx.db.get('programs', entry.programId)
                : null,
          }
        }),
    )
    return { ...ballot, entries }
  },
})
