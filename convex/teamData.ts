import { v } from 'convex/values'
import { internal } from './_generated/api'
import { internalAction, internalMutation, query } from './_generated/server'
import { resolveProgram, slug } from './programIdentity'

const FEED_URLS = {
  draft:
    'https://opensheet.elk.sh/1929LufXzpisOmSLzYqkqAU0qeRR40fCbv6zbxY2SB9M/DraftHistoryInput',
  recruiting:
    'https://opensheet.elk.sh/1929LufXzpisOmSLzYqkqAU0qeRR40fCbv6zbxY2SB9M/RecruitingInput',
  standings:
    'https://opensheet.elk.sh/1929LufXzpisOmSLzYqkqAU0qeRR40fCbv6zbxY2SB9M/Standings',
} as const

const BATCH_SIZE = 50

const sourceValidator = v.union(
  v.literal('recruiting'),
  v.literal('standings'),
  v.literal('draft'),
  v.literal('games'),
  v.literal('game_stats'),
  v.literal('ratings'),
)

type Source = keyof typeof FEED_URLS
type SourceRow = Record<string, unknown>

const perGameValidator = v.object({
  firstDownsByPass: v.number(),
  firstDownsByPenalty: v.number(),
  firstDownsByRush: v.number(),
  firstDownsTotal: v.number(),
  interceptions: v.number(),
  passAttempts: v.number(),
  passCompletionPercentage: v.number(),
  passCompletions: v.number(),
  passingTouchdowns: v.number(),
  passingYards: v.number(),
  penalties: v.number(),
  penaltyYards: v.number(),
  plays: v.number(),
  points: v.number(),
  rushAttempts: v.number(),
  rushingTouchdowns: v.number(),
  rushingYards: v.number(),
  rushingYardsPerAttempt: v.number(),
  totalYards: v.number(),
  turnovers: v.number(),
  turnoversByFumble: v.number(),
  yardsPerPlay: v.number(),
})

const recruitingRowValidator = v.object({
  averageRating: v.number(),
  commits: v.number(),
  fiveStars: v.number(),
  fourStars: v.number(),
  points: v.number(),
  programName: v.string(),
  rank: v.number(),
  season: v.number(),
  sourceId: v.string(),
  sourceKey: v.string(),
  threeStars: v.number(),
})

const standingsRowValidator = v.object({
  apCurrentRank: v.optional(v.number()),
  apHighRank: v.optional(v.number()),
  apPreseasonRank: v.optional(v.number()),
  conference: v.string(),
  conferenceChampion: v.boolean(),
  conferenceLosses: v.optional(v.number()),
  conferenceWinPercentage: v.optional(v.number()),
  conferenceWins: v.optional(v.number()),
  defense: perGameValidator,
  division: v.optional(v.string()),
  fourTeamPlayoff: v.boolean(),
  games: v.number(),
  losses: v.number(),
  nationalChampion: v.boolean(),
  offense: perGameValidator,
  programName: v.string(),
  season: v.number(),
  simpleRatingSystem: v.number(),
  sourceId: v.string(),
  sourceKey: v.string(),
  strengthOfSchedule: v.number(),
  twelveTeamPlayoff: v.boolean(),
  winPercentage: v.number(),
  wins: v.number(),
})

const draftRowValidator = v.object({
  age: v.optional(v.number()),
  allProFirstTeamSelections: v.number(),
  approximateValue: v.optional(v.number()),
  careerDefensiveInterceptions: v.optional(v.number()),
  careerGames: v.optional(v.number()),
  careerPassAttempts: v.optional(v.number()),
  careerPassCompletions: v.optional(v.number()),
  careerPassingInterceptions: v.optional(v.number()),
  careerPassingTouchdowns: v.optional(v.number()),
  careerPassingYards: v.optional(v.number()),
  careerReceptions: v.optional(v.number()),
  careerReceivingTouchdowns: v.optional(v.number()),
  careerReceivingYards: v.optional(v.number()),
  careerRushAttempts: v.optional(v.number()),
  careerRushingTouchdowns: v.optional(v.number()),
  careerRushingYards: v.optional(v.number()),
  careerSacks: v.optional(v.number()),
  careerSoloTackles: v.optional(v.number()),
  draftingTeam: v.string(),
  draftingTeamApproximateValue: v.optional(v.number()),
  finalSeason: v.optional(v.number()),
  pick: v.number(),
  pickValue: v.number(),
  playerName: v.string(),
  position: v.string(),
  proBowlSelections: v.number(),
  programName: v.string(),
  round: v.number(),
  seasonsAsPrimaryStarter: v.number(),
  sourceId: v.string(),
  sourceKey: v.string(),
  year: v.number(),
})

function sourceRecord(value: unknown, source: Source): Array<SourceRow> {
  if (!Array.isArray(value)) {
    throw new Error(`${source} returned a non-array JSON document.`)
  }
  return value.map((row, index) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`${source} row ${index + 1} is not an object.`)
    }
    return row as SourceRow
  })
}

function stringField(row: SourceRow, field: string) {
  const value = row[field]
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid or missing ${field}.`)
  }
  return value.trim()
}

function numberField(row: SourceRow, field: string) {
  const raw = stringField(row, field)
  const value = Number(raw)
  if (!Number.isFinite(value))
    throw new Error(`Invalid numeric ${field}: ${raw}`)
  return value
}

function optionalNumberField(row: SourceRow, field: string) {
  const raw = row[field]
  if (raw === '' || raw === '-' || raw === undefined) return undefined
  if (typeof raw !== 'string') throw new Error(`Invalid ${field}.`)
  const value = Number(raw)
  if (!Number.isFinite(value))
    throw new Error(`Invalid numeric ${field}: ${raw}`)
  return value
}

function optionalStringField(row: SourceRow, field: string) {
  const raw = row[field]
  if (raw === '' || raw === '-' || raw === undefined) return undefined
  if (typeof raw !== 'string') throw new Error(`Invalid ${field}.`)
  return raw.trim()
}

function markerField(row: SourceRow, field: string) {
  const raw = row[field]
  if (typeof raw !== 'string') throw new Error(`Invalid ${field}.`)
  return raw.trim() !== '' && raw.trim() !== '0' && raw.trim() !== '-'
}

function perGameFields(row: SourceRow, prefix: 'Off' | 'Def') {
  return {
    firstDownsByPass: numberField(row, `${prefix}FirstDownPass`),
    firstDownsByPenalty: numberField(row, `${prefix}FirstDownPen`),
    firstDownsByRush: numberField(row, `${prefix}FirstDownRush`),
    firstDownsTotal: numberField(row, `${prefix}FirstDownTot`),
    interceptions: numberField(row, `${prefix}TOInt`),
    passAttempts: numberField(row, `${prefix}PassAtt`),
    passCompletionPercentage: numberField(row, `${prefix}PassPct`),
    passCompletions: numberField(row, `${prefix}PassCmp`),
    passingTouchdowns: numberField(row, `${prefix}PassTD`),
    passingYards: numberField(row, `${prefix}PassYds`),
    penalties: numberField(row, `${prefix}PenNo.`),
    penaltyYards: numberField(row, `${prefix}PenYds`),
    plays: numberField(row, `${prefix}TotPlays`),
    points: numberField(row, `${prefix}PtsPerGame`),
    rushAttempts: numberField(row, `${prefix}RushAtt`),
    rushingTouchdowns: numberField(row, `${prefix}RushTD`),
    rushingYards: numberField(row, `${prefix}RushYds`),
    rushingYardsPerAttempt: numberField(row, `${prefix}RushAvg`),
    totalYards: numberField(row, `${prefix}TotYds`),
    turnovers: numberField(row, `${prefix}TOTot`),
    turnoversByFumble: numberField(row, `${prefix}TOFum`),
    yardsPerPlay: numberField(row, `${prefix}TotAvg`),
  }
}

function parseRecruiting(rows: Array<SourceRow>) {
  return rows.map((row) => {
    const programName = stringField(row, 'Team')
    const season = numberField(row, 'Year')
    const sourceId = stringField(row, 'id')
    return {
      averageRating: numberField(row, 'Avg'),
      commits: numberField(row, 'Commits'),
      fiveStars: numberField(row, '5-stars'),
      fourStars: numberField(row, '4-stars'),
      points: numberField(row, 'Points'),
      programName,
      rank: numberField(row, 'Rank'),
      season,
      sourceId,
      sourceKey: `recruiting:${sourceId}`,
      threeStars: numberField(row, '3-stars'),
    }
  })
}

function parseStandings(rows: Array<SourceRow>) {
  return rows.map((row) => {
    const programName = stringField(row, 'School')
    const season = numberField(row, 'Season')
    return {
      apCurrentRank: optionalNumberField(row, 'APCurr'),
      apHighRank: optionalNumberField(row, 'APHigh'),
      apPreseasonRank: optionalNumberField(row, 'APPre'),
      conference: stringField(row, 'Conf'),
      conferenceChampion: markerField(row, 'CC'),
      conferenceLosses: optionalNumberField(row, 'CL'),
      conferenceWinPercentage: optionalNumberField(row, 'CPct'),
      conferenceWins: optionalNumberField(row, 'CW'),
      defense: perGameFields(row, 'Def'),
      division: optionalStringField(row, 'Div'),
      fourTeamPlayoff: markerField(row, '4TMPlayoff'),
      games: numberField(row, 'G'),
      losses: numberField(row, 'L'),
      nationalChampion: markerField(row, 'NC'),
      offense: perGameFields(row, 'Off'),
      programName,
      season,
      simpleRatingSystem: numberField(row, 'SRS'),
      sourceId: stringField(row, 'id'),
      sourceKey: `standings:${season}:${slug(programName)}`,
      strengthOfSchedule: numberField(row, 'SOS'),
      twelveTeamPlayoff: markerField(row, '12TMPlayoff'),
      winPercentage: numberField(row, 'Pct'),
      wins: numberField(row, 'W'),
    }
  })
}

function isDraftRow(row: SourceRow) {
  const raw = row.Year
  return typeof raw === 'string' && /^\d{4}$/.test(raw)
}

function parseDraft(rows: Array<SourceRow>) {
  return rows.filter(isDraftRow).map((row) => {
    const year = numberField(row, 'Year')
    const pick = numberField(row, 'Pick')
    return {
      age: optionalNumberField(row, 'Age'),
      allProFirstTeamSelections: numberField(row, 'AllProFirst'),
      approximateValue: optionalNumberField(row, 'AV'),
      careerDefensiveInterceptions: optionalNumberField(row, 'DefInt'),
      careerGames: optionalNumberField(row, 'GP'),
      careerPassAttempts: optionalNumberField(row, 'PassAtt'),
      careerPassCompletions: optionalNumberField(row, 'PassCmp'),
      careerPassingInterceptions: optionalNumberField(row, 'PassInt'),
      careerPassingTouchdowns: optionalNumberField(row, 'PassTD'),
      careerPassingYards: optionalNumberField(row, 'PassYds'),
      careerReceptions: optionalNumberField(row, 'RecCth'),
      careerReceivingTouchdowns: optionalNumberField(row, 'RecTD'),
      careerReceivingYards: optionalNumberField(row, 'RecYds'),
      careerRushAttempts: optionalNumberField(row, 'RushAtt'),
      careerRushingTouchdowns: optionalNumberField(row, 'RushTD'),
      careerRushingYards: optionalNumberField(row, 'RushYds'),
      careerSacks: optionalNumberField(row, 'DefSk'),
      careerSoloTackles: optionalNumberField(row, 'DefSoloTkl'),
      draftingTeam: stringField(row, 'Tm'),
      draftingTeamApproximateValue: optionalNumberField(row, 'DrftTmAV'),
      finalSeason: optionalNumberField(row, 'To'),
      pick,
      pickValue: numberField(row, 'PickVal'),
      playerName: stringField(row, 'Player'),
      position: stringField(row, 'Pos'),
      proBowlSelections: numberField(row, 'ProBowl'),
      programName: stringField(row, 'College'),
      round: numberField(row, 'Rnd'),
      seasonsAsPrimaryStarter: numberField(row, 'Starter'),
      sourceId: stringField(row, 'id'),
      sourceKey: `draft:${year}:${pick}`,
      year,
    }
  })
}

function assertUniqueKeys(rows: Array<{ sourceKey: string }>, source: Source) {
  const keys = new Set<string>()
  for (const row of rows) {
    if (keys.has(row.sourceKey)) {
      throw new Error(`${source} contains duplicate key ${row.sourceKey}.`)
    }
    keys.add(row.sourceKey)
  }
}

export const beginSync = internalMutation({
  args: { source: sourceValidator, startedAt: v.number() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('teamDataSyncState')
      .withIndex('by_source', (q) => q.eq('source', args.source))
      .unique()
    const state = {
      source: args.source,
      startedAt: args.startedAt,
      status: 'running' as const,
    }
    if (existing) await ctx.db.replace('teamDataSyncState', existing._id, state)
    else await ctx.db.insert('teamDataSyncState', state)
  },
})

export const completeSync = internalMutation({
  args: {
    acceptedRows: v.number(),
    completedAt: v.number(),
    fetchedRows: v.number(),
    rejectedRows: v.number(),
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('teamDataSyncState')
      .withIndex('by_source', (q) => q.eq('source', args.source))
      .unique()
    if (!existing) throw new Error(`Missing ${args.source} sync state.`)
    await ctx.db.patch('teamDataSyncState', existing._id, {
      acceptedRows: args.acceptedRows,
      completedAt: args.completedAt,
      error: undefined,
      fetchedRows: args.fetchedRows,
      rejectedRows: args.rejectedRows,
      status: 'succeeded',
    })
  },
})

export const failSync = internalMutation({
  args: {
    completedAt: v.number(),
    error: v.string(),
    source: sourceValidator,
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('teamDataSyncState')
      .withIndex('by_source', (q) => q.eq('source', args.source))
      .unique()
    if (!existing) throw new Error(`Missing ${args.source} sync state.`)
    await ctx.db.patch('teamDataSyncState', existing._id, {
      completedAt: args.completedAt,
      error: args.error,
      status: 'failed',
    })
  },
})

export const upsertRecruitingBatch = internalMutation({
  args: {
    rows: v.array(recruitingRowValidator),
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const { programName, ...fields } = row
      const programId = await resolveProgram(ctx, 'recruiting', programName)
      const existing = await ctx.db
        .query('teamRecruitingClasses')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', row.sourceKey))
        .unique()
      const document = {
        ...fields,
        programId,
        sourceProgramName: programName,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }
      if (existing)
        await ctx.db.replace('teamRecruitingClasses', existing._id, document)
      else await ctx.db.insert('teamRecruitingClasses', document)
    }
  },
})

export const upsertStandingsBatch = internalMutation({
  args: {
    rows: v.array(standingsRowValidator),
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const { programName, ...fields } = row
      const programId = await resolveProgram(ctx, 'standings', programName)
      const existing = await ctx.db
        .query('teamSeasonStandings')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', row.sourceKey))
        .unique()
      const document = {
        ...fields,
        programId,
        sourceProgramName: programName,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }
      if (existing)
        await ctx.db.replace('teamSeasonStandings', existing._id, document)
      else await ctx.db.insert('teamSeasonStandings', document)
    }
  },
})

export const upsertDraftBatch = internalMutation({
  args: { rows: v.array(draftRowValidator), sourceUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const { programName, ...fields } = row
      const programId = await resolveProgram(ctx, 'draft', programName)
      const existing = await ctx.db
        .query('teamDraftSelections')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', row.sourceKey))
        .unique()
      const document = {
        ...fields,
        programId,
        sourceProgramName: programName,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }
      if (existing)
        await ctx.db.replace('teamDraftSelections', existing._id, document)
      else await ctx.db.insert('teamDraftSelections', document)
    }
  },
})

export const syncAll = internalAction({
  args: {},
  handler: async (
    ctx,
  ): Promise<
    Array<{
      acceptedRows: number
      error?: string
      fetchedRows: number
      rejectedRows: number
      source: Source
    }>
  > => {
    const results = []
    const sources: Array<Source> = ['recruiting', 'standings', 'draft']

    for (const source of sources) {
      const startedAt = Date.now()
      await ctx.runMutation(internal.teamData.beginSync, { source, startedAt })
      try {
        const response = await fetch(FEED_URLS[source])
        if (!response.ok) {
          throw new Error(
            `${source} fetch failed with HTTP ${response.status}.`,
          )
        }
        const sourceRows = sourceRecord(await response.json(), source)
        let acceptedRows = 0
        if (source === 'recruiting') {
          const rows = parseRecruiting(sourceRows)
          assertUniqueKeys(rows, source)
          acceptedRows = rows.length
          for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
            await ctx.runMutation(internal.teamData.upsertRecruitingBatch, {
              rows: rows.slice(offset, offset + BATCH_SIZE),
              sourceUpdatedAt: startedAt,
            })
          }
        } else if (source === 'standings') {
          const rows = parseStandings(sourceRows)
          assertUniqueKeys(rows, source)
          acceptedRows = rows.length
          for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
            await ctx.runMutation(internal.teamData.upsertStandingsBatch, {
              rows: rows.slice(offset, offset + BATCH_SIZE),
              sourceUpdatedAt: startedAt,
            })
          }
        } else {
          const rows = parseDraft(sourceRows)
          assertUniqueKeys(rows, source)
          acceptedRows = rows.length
          for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
            await ctx.runMutation(internal.teamData.upsertDraftBatch, {
              rows: rows.slice(offset, offset + BATCH_SIZE),
              sourceUpdatedAt: startedAt,
            })
          }
        }

        const result = {
          acceptedRows,
          fetchedRows: sourceRows.length,
          rejectedRows: sourceRows.length - acceptedRows,
          source,
        }
        await ctx.runMutation(internal.teamData.completeSync, {
          ...result,
          completedAt: Date.now(),
        })
        results.push(result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await ctx.runMutation(internal.teamData.failSync, {
          completedAt: Date.now(),
          error: message,
          source,
        })
        results.push({
          acceptedRows: 0,
          error: message,
          fetchedRows: 0,
          rejectedRows: 0,
          source,
        })
      }
    }

    return results
  },
})

const boundedLimit = (limit: number | undefined, fallback: number) =>
  Math.min(Math.max(Math.floor(limit ?? fallback), 1), 500)

export const listPrograms = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) =>
    ctx.db
      .query('programs')
      .withIndex('by_key')
      .take(boundedLimit(args.limit, 500)),
})

export const listRecruitingBySeason = query({
  args: { limit: v.optional(v.number()), season: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query('teamRecruitingClasses')
      .withIndex('by_season_and_rank', (q) => q.eq('season', args.season))
      .take(boundedLimit(args.limit, 200)),
})

export const listStandingsBySeason = query({
  args: { limit: v.optional(v.number()), season: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query('teamSeasonStandings')
      .withIndex('by_season_and_wins', (q) => q.eq('season', args.season))
      .order('desc')
      .take(boundedLimit(args.limit, 200)),
})

export const listDraftByYear = query({
  args: { limit: v.optional(v.number()), year: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query('teamDraftSelections')
      .withIndex('by_year_and_pick', (q) => q.eq('year', args.year))
      .take(boundedLimit(args.limit, 300)),
})

export const getProgramHistory = query({
  args: {
    fromSeason: v.number(),
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

    const [recruiting, standings, draft] = await Promise.all([
      ctx.db
        .query('teamRecruitingClasses')
        .withIndex('by_programId_and_season', (q) =>
          q
            .eq('programId', program._id)
            .gte('season', fromSeason)
            .lte('season', toSeason),
        )
        .take(51),
      ctx.db
        .query('teamSeasonStandings')
        .withIndex('by_programId_and_season', (q) =>
          q
            .eq('programId', program._id)
            .gte('season', fromSeason)
            .lte('season', toSeason),
        )
        .take(51),
      ctx.db
        .query('teamDraftSelections')
        .withIndex('by_programId_and_year', (q) =>
          q
            .eq('programId', program._id)
            .gte('year', fromSeason)
            .lte('year', toSeason),
        )
        .take(500),
    ])

    return { draft, program, recruiting, standings }
  },
})

export const getSyncState = query({
  args: {},
  handler: async (ctx) =>
    ctx.db.query('teamDataSyncState').withIndex('by_source').take(6),
})
