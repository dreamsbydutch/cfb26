import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import {
  createCfbdClient,
} from './cfbdClient'
import { resolveProgram, slug } from './programIdentity'
import { nflRosterStatus, nflStatistics, parseCsv } from './nflverse'
import type { Id } from './_generated/dataModel'
import type {
  CfbdDraftPick,
  CfbdFbsTeam,
  CfbdRankingWeek,
  CfbdRecruitingTeam,
  CfbdReturningProduction,
  CfbdTalent,
  CfbdVenue,
} from './cfbdClient'

const BATCH_SIZE = 40
const sourceValidator = v.union(
  v.literal('recruiting'),
  v.literal('standings'),
  v.literal('draft'),
  v.literal('games'),
  v.literal('game_stats'),
  v.literal('ratings'),
  v.literal('rating_inputs'),
  v.literal('programs'),
  v.literal('venues'),
  v.literal('affiliations'),
  v.literal('player_stats'),
  v.literal('nflverse'),
  v.literal('polls'),
)
type Source =
  | 'affiliations'
  | 'draft'
  | 'nflverse'
  | 'polls'
  | 'programs'
  | 'recruiting'
  | 'venues'
const optionalString = v.optional(v.string())
const nullableNumber = v.union(v.number(), v.null())

const venueRowValidator = v.object({
  capacity: v.optional(v.number()),
  city: optionalString,
  country: optionalString,
  elevationFeet: v.optional(v.number()),
  grass: v.optional(v.boolean()),
  name: v.string(),
  sourceVenueId: v.number(),
  state: optionalString,
  timezone: optionalString,
  yearConstructed: v.optional(v.number()),
})
const programRowValidator = v.object({
  abbreviation: optionalString,
  cfbdId: v.number(),
  color: optionalString,
  conference: optionalString,
  logos: v.optional(v.array(v.string())),
  mascot: optionalString,
  name: v.string(),
  sourceVenueId: v.optional(v.number()),
})
const profileRowValidator = v.object({
  averageRecruitRating: nullableNumber,
  conference: optionalString,
  programName: v.string(),
  recruitingPoints: nullableNumber,
  recruitingRank: nullableNumber,
  returningPpa: nullableNumber,
  returningUsage: nullableNumber,
  season: v.number(),
  talent: nullableNumber,
})
const draftRowValidator = v.object({
  draftingTeam: v.string(),
  overall: v.number(),
  pick: v.number(),
  playerName: v.string(),
  position: v.string(),
  programName: v.string(),
  round: v.number(),
  year: v.number(),
})
const nflRosterRowValidator = v.object({
  nflIdentityId: v.id('nflIdentities'),
  playerId: v.id('players'),
  season: v.number(),
  status: v.union(
    v.literal('active'),
    v.literal('practice_squad'),
    v.literal('injured_reserve'),
    v.literal('reserve'),
    v.literal('inactive'),
  ),
  team: v.string(),
  week: v.number(),
})
const nflGameRowValidator = v.object({
  awayTeam: v.string(),
  completed: v.boolean(),
  homeTeam: v.string(),
  season: v.number(),
  sourceGameId: v.string(),
  startTime: v.number(),
  week: v.number(),
})
const nflPlayerGameRowValidator = v.object({
  playerId: v.id('players'),
  sourceGameId: v.string(),
  statistics: v.array(v.object({ category: v.string(), value: v.number() })),
  team: v.string(),
})
const pollRowValidator = v.object({
  poll: v.string(),
  programName: v.string(),
  rank: v.number(),
  season: v.number(),
  week: v.number(),
})

function asRow(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
function stringAt(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}
function numberAt(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}
function booleanAt(row: Record<string, unknown>, key: string) {
  const value = row[key]
  return typeof value === 'boolean' ? value : undefined
}
function stringsAt(row: Record<string, unknown>, key: string) {
  const value = row[key]
  if (!Array.isArray(value)) return undefined
  const strings = value.filter(
    (entry): entry is string => typeof entry === 'string' && entry.length > 0,
  )
  return strings.length > 0 ? strings : undefined
}

function parseVenue(row: CfbdVenue) {
  const value = asRow(row)
  return {
    capacity: numberAt(value, 'capacity'),
    city: stringAt(value, 'city'),
    country: stringAt(value, 'countryCode') ?? stringAt(value, 'country'),
    elevationFeet: numberAt(value, 'elevation'),
    grass: booleanAt(value, 'grass'),
    name: row.name,
    sourceVenueId: row.id,
    state: stringAt(value, 'state'),
    timezone: stringAt(value, 'timezone'),
    yearConstructed: numberAt(value, 'yearConstructed'),
  }
}
function parseProgram(row: CfbdFbsTeam) {
  const value = asRow(row)
  const location = asRow(value.location)
  return {
    abbreviation: stringAt(value, 'abbreviation'),
    cfbdId: row.id,
    color: stringAt(value, 'color'),
    conference: stringAt(value, 'conference'),
    logos: stringsAt(value, 'logos'),
    mascot: stringAt(value, 'mascot'),
    name: row.school,
    sourceVenueId: numberAt(location, 'venueId'),
  }
}

function buildProfiles(
  season: number,
  teams: Array<CfbdFbsTeam>,
  recruiting: Array<CfbdRecruitingTeam>,
  talent: Array<CfbdTalent>,
  returning: Array<CfbdReturningProduction>,
) {
  type Profile = {
    averageRecruitRating: number | null
    conference?: string
    programName: string
    recruitingPoints: number | null
    recruitingRank: number | null
    returningPpa: number | null
    returningUsage: number | null
    season: number
    talent: number | null
  }
  const profiles = new Map<string, Profile>()
  for (const team of teams) {
    profiles.set(slug(team.school), {
      averageRecruitRating: null,
      conference: stringAt(asRow(team), 'conference'),
      programName: team.school,
      recruitingPoints: null,
      recruitingRank: null,
      returningPpa: null,
      returningUsage: null,
      season,
      talent: null,
    })
  }
  const ensure = (name: string): Profile => {
    const key = slug(name)
    const existing = profiles.get(key)
    if (existing) return existing
    const created: Profile = {
      averageRecruitRating: null,
      programName: name,
      recruitingPoints: null,
      recruitingRank: null,
      returningPpa: null,
      returningUsage: null,
      season,
      talent: null,
    }
    profiles.set(key, created)
    return created
  }
  for (const row of recruiting) {
    const profile = ensure(row.team)
    profile.recruitingPoints = row.points
    profile.recruitingRank = row.rank
  }
  for (const row of talent) ensure(row.team).talent = row.talent
  for (const row of returning) {
    const profile = ensure(row.team)
    profile.returningPpa = row.percentPPA
    profile.returningUsage = row.usage
  }
  return [...profiles.values()]
}
const draftPickValue = (overall: number) =>
  Math.round((3000 / Math.sqrt(Math.max(overall, 1))) * 10) / 10

function parsePolls(editions: Array<CfbdRankingWeek>) {
  return editions.flatMap((edition) =>
    edition.polls.flatMap((rawPoll) => {
      const poll = stringAt(rawPoll, 'poll')
      const ranks = rawPoll.ranks
      if (!poll || !Array.isArray(ranks)) return []
      return ranks.flatMap((rawRank) => {
        const rank = asRow(rawRank)
        const programName = stringAt(rank, 'school')
        const value = numberAt(rank, 'rank')
        return programName && value !== undefined
          ? [
              {
                poll,
                programName,
                rank: value,
                season: edition.season,
                week: edition.week,
              },
            ]
          : []
      })
    }),
  )
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
    warnings: v.optional(v.array(v.string())),
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
      warnings: args.warnings,
    })
  },
})
export const failSync = internalMutation({
  args: { completedAt: v.number(), error: v.string(), source: sourceValidator },
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
      warnings: undefined,
    })
  },
})

export const upsertVenuesBatch = internalMutation({
  args: { rows: v.array(venueRowValidator) },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const existing = await ctx.db
        .query('venues')
        .withIndex('by_sourceVenueId', (q) =>
          q.eq('sourceVenueId', row.sourceVenueId),
        )
        .unique()
      if (existing) await ctx.db.replace('venues', existing._id, row)
      else await ctx.db.insert('venues', row)
    }
  },
})
export const upsertProgramsBatch = internalMutation({
  args: {
    rows: v.array(programRowValidator),
    season: v.number(),
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const programId = await resolveProgram(ctx, 'programs', row.name)
      await ctx.db.patch('programs', programId, {
        abbreviation: row.abbreviation,
        cfbdId: row.cfbdId,
        classification: 'fbs',
        color: row.color,
        conference: row.conference,
        logos: row.logos,
        mascot: row.mascot,
        name: row.name,
        sourceUpdatedAt: args.sourceUpdatedAt,
      })
      if (row.conference) {
        const sourceKey = `cfbd:${args.season}:${row.cfbdId}`
        const affiliation = await ctx.db
          .query('programAffiliations')
          .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
          .unique()
        const document = {
          conference: row.conference,
          programId,
          sourceKey,
          startSeason: args.season,
        }
        if (affiliation)
          await ctx.db.replace('programAffiliations', affiliation._id, document)
        else await ctx.db.insert('programAffiliations', document)
      }
      const sourceVenueId = row.sourceVenueId
      if (sourceVenueId !== undefined) {
        const venue = await ctx.db
          .query('venues')
          .withIndex('by_sourceVenueId', (q) =>
            q.eq('sourceVenueId', sourceVenueId),
          )
          .unique()
        if (venue) {
          const links = await ctx.db
            .query('programVenues')
            .withIndex('by_programId_and_startSeason', (q) =>
              q.eq('programId', programId).eq('startSeason', args.season),
            )
            .take(5)
          if (!links.some((link) => link.venueId === venue._id)) {
            await ctx.db.insert('programVenues', {
              programId,
              startSeason: args.season,
              venueId: venue._id,
            })
          }
        }
      }
    }
  },
})
export const upsertProfilesBatch = internalMutation({
  args: { rows: v.array(profileRowValidator), sourceUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const { programName, ...fields } = row
      const programId = await resolveProgram(ctx, 'recruiting', programName)
      const existing = await ctx.db
        .query('teamSeasonProfiles')
        .withIndex('by_programId_and_season', (q) =>
          q.eq('programId', programId).eq('season', row.season),
        )
        .unique()
      const document = {
        ...fields,
        programId,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }
      if (existing)
        await ctx.db.replace('teamSeasonProfiles', existing._id, document)
      else await ctx.db.insert('teamSeasonProfiles', document)
    }
  },
})
export const upsertDraftBatch = internalMutation({
  args: { rows: v.array(draftRowValidator), sourceUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const programId = await resolveProgram(ctx, 'draft', row.programName)
      const sourceKey = `cfbd:draft:${row.year}:${row.overall}`
      const existing = await ctx.db
        .query('teamDraftSelections')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
        .unique()
      const document = {
        allProFirstTeamSelections: 0,
        draftingTeam: row.draftingTeam,
        pick: row.overall,
        pickValue: draftPickValue(row.overall),
        playerName: row.playerName,
        position: row.position,
        proBowlSelections: 0,
        programId,
        round: row.round,
        seasonsAsPrimaryStarter: 0,
        sourceId: `${row.year}:${row.overall}`,
        sourceKey,
        sourceProgramName: row.programName,
        sourceUpdatedAt: args.sourceUpdatedAt,
        year: row.year,
      }
      if (existing)
        await ctx.db.replace('teamDraftSelections', existing._id, document)
      else await ctx.db.insert('teamDraftSelections', document)
    }
  },
})

export const upsertPollsBatch = internalMutation({
  args: { rows: v.array(pollRowValidator), sourceUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const programId = await resolveProgram(ctx, 'polls', row.programName)
      const sourceKey = `cfbd:poll:${row.season}:${row.week}:${slug(row.poll)}:${programId}`
      const existing = await ctx.db
        .query('externalPollRanks')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
        .unique()
      const { programName: _programName, ...fields } = row
      const document = {
        ...fields,
        programId,
        sourceKey,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }
      if (existing)
        await ctx.db.replace('externalPollRanks', existing._id, document)
      else await ctx.db.insert('externalPollRanks', document)
    }
  },
})

export const loadNflIdentities = internalQuery({
  args: {},
  handler: async (ctx) =>
    ctx.db.query('nflIdentities').withIndex('by_firstSeason').take(500),
})

export const upsertNflGamesBatch = internalMutation({
  args: { rows: v.array(nflGameRowValidator) },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const existing = await ctx.db
        .query('nflGames')
        .withIndex('by_sourceGameId', (q) =>
          q.eq('sourceGameId', row.sourceGameId),
        )
        .unique()
      if (existing) await ctx.db.replace('nflGames', existing._id, row)
      else await ctx.db.insert('nflGames', row)
    }
  },
})

export const upsertNflRostersBatch = internalMutation({
  args: { rows: v.array(nflRosterRowValidator), sourceUpdatedAt: v.number() },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const sourceKey = `nflverse:roster:${row.playerId}:${row.season}:${row.week}`
      const existing = await ctx.db
        .query('nflWeeklyRosters')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
        .unique()
      const document = {
        ...row,
        sourceKey,
        sourceUpdatedAt: args.sourceUpdatedAt,
      }
      if (existing)
        await ctx.db.replace('nflWeeklyRosters', existing._id, document)
      else await ctx.db.insert('nflWeeklyRosters', document)
    }
  },
})

export const upsertNflPlayerGamesBatch = internalMutation({
  args: {
    rows: v.array(nflPlayerGameRowValidator),
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const game = await ctx.db
        .query('nflGames')
        .withIndex('by_sourceGameId', (q) =>
          q.eq('sourceGameId', row.sourceGameId),
        )
        .unique()
      if (!game) continue
      const sourceKey = `nflverse:player-game:${row.playerId}:${row.sourceGameId}`
      const existing = await ctx.db
        .query('nflPlayerGames')
        .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
        .unique()
      const document = {
        defenseSnaps: null,
        gameId: game._id,
        offenseSnaps: null,
        playerId: row.playerId,
        sourceKey,
        sourceUpdatedAt: args.sourceUpdatedAt,
        specialTeamsSnaps: null,
        started: false,
        statistics: row.statistics,
        team: row.team,
      }
      if (existing)
        await ctx.db.replace('nflPlayerGames', existing._id, document)
      else await ctx.db.insert('nflPlayerGames', document)
    }
  },
})

export const rebuildNflSummaries = internalMutation({
  args: { season: v.number() },
  handler: async (ctx, args) => {
    const identities = await ctx.db
      .query('nflIdentities')
      .withIndex('by_firstSeason')
      .take(500)
    let rebuilt = 0
    for (const identity of identities.filter(
      (row) => row.firstSeason <= args.season,
    )) {
      const playerGames = await ctx.db
        .query('nflPlayerGames')
        .withIndex('by_playerId_and_gameId', (q) =>
          q.eq('playerId', identity.playerId),
        )
        .take(500)
      const seasonGames = []
      for (const playerGame of playerGames) {
        const game = await ctx.db.get('nflGames', playerGame.gameId)
        if (game?.season === args.season) seasonGames.push(playerGame)
      }
      if (seasonGames.length === 0) continue
      const statistics = new Map<string, number>()
      for (const row of seasonGames) {
        for (const statistic of row.statistics) {
          statistics.set(
            statistic.category,
            (statistics.get(statistic.category) ?? 0) + statistic.value,
          )
        }
      }
      const document = {
        defenseSnaps: seasonGames.reduce(
          (total, row) => total + (row.defenseSnaps ?? 0),
          0,
        ),
        games: seasonGames.length,
        offenseSnaps: seasonGames.reduce(
          (total, row) => total + (row.offenseSnaps ?? 0),
          0,
        ),
        playerId: identity.playerId,
        season: args.season,
        specialTeamsSnaps: seasonGames.reduce(
          (total, row) => total + (row.specialTeamsSnaps ?? 0),
          0,
        ),
        starts: seasonGames.filter((row) => row.started).length,
        statistics: [...statistics].map(([category, value]) => ({
          category,
          value,
        })),
      }
      const existing = await ctx.db
        .query('nflSeasonSummaries')
        .withIndex('by_playerId_and_season', (q) =>
          q.eq('playerId', identity.playerId).eq('season', args.season),
        )
        .unique()
      if (existing)
        await ctx.db.replace('nflSeasonSummaries', existing._id, document)
      else await ctx.db.insert('nflSeasonSummaries', document)
      rebuilt += 1
    }
    return { rebuilt }
  },
})

async function batches<T>(
  rows: Array<T>,
  run: (batch: Array<T>) => Promise<unknown>,
) {
  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    await run(rows.slice(offset, offset + BATCH_SIZE))
  }
}

export const syncAll = internalAction({
  args: { season: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const apiKey = env.CFBD_API_KEY
    if (!apiKey) throw new Error('CFBD_API_KEY is not configured.')
    const season = Math.floor(args.season ?? new Date().getUTCFullYear())
    const client = createCfbdClient({ apiKey })
    const results: Array<{
      acceptedRows: number
      error?: string
      fetchedRows: number
      rejectedRows: number
      source: Source
    }> = []
    const run = async (
      source: Source,
      load: (
        startedAt: number,
      ) => Promise<{ accepted: number; fetched: number }>,
    ) => {
      const startedAt = Date.now()
      await ctx.runMutation(internal.teamData.beginSync, { source, startedAt })
      try {
        const counts = await load(startedAt)
        const result = {
          acceptedRows: counts.accepted,
          fetchedRows: counts.fetched,
          rejectedRows: counts.fetched - counts.accepted,
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
    let teams: Array<CfbdFbsTeam> = []
    await run('venues', async () => {
      const rows = (await client.getVenues()).map(parseVenue)
      await batches(rows, (batch) =>
        ctx.runMutation(internal.teamData.upsertVenuesBatch, { rows: batch }),
      )
      return { accepted: rows.length, fetched: rows.length }
    })
    await run('programs', async (startedAt) => {
      teams = await client.getFbsTeams({ season })
      const rows = teams.map(parseProgram)
      await batches(rows, (batch) =>
        ctx.runMutation(internal.teamData.upsertProgramsBatch, {
          rows: batch,
          season,
          sourceUpdatedAt: startedAt,
        }),
      )
      return { accepted: rows.length, fetched: teams.length }
    })
    await run('recruiting', async (startedAt) => {
      if (teams.length === 0) teams = await client.getFbsTeams({ season })
      const [recruiting, talent, returning] = await Promise.all([
        client.getRecruitingTeams({ season }),
        client.getTalent({ season }),
        client.getReturningProduction({ season }),
      ])
      const rows = buildProfiles(season, teams, recruiting, talent, returning)
      await batches(rows, (batch) =>
        ctx.runMutation(internal.teamData.upsertProfilesBatch, {
          rows: batch,
          sourceUpdatedAt: startedAt,
        }),
      )
      return {
        accepted: rows.length,
        fetched: recruiting.length + talent.length + returning.length,
      }
    })
    await run('draft', async (startedAt) => {
      const picks: Array<CfbdDraftPick> = await client.getDraftPicks({ season })
      const rows = picks.map((pick) => ({
        draftingTeam: pick.nflTeam,
        overall: pick.overall,
        pick: pick.pick,
        playerName: pick.playerName,
        position: pick.position,
        programName: pick.collegeTeam,
        round: pick.round,
        year: pick.year,
      }))
      await batches(rows, (batch) =>
        ctx.runMutation(internal.teamData.upsertDraftBatch, {
          rows: batch,
          sourceUpdatedAt: startedAt,
        }),
      )
      return { accepted: rows.length, fetched: picks.length }
    })
    await run('polls', async (startedAt) => {
      const editions = await client.getRankings({ season })
      const rows = parsePolls(editions)
      await batches(rows, (batch) =>
        ctx.runMutation(internal.teamData.upsertPollsBatch, {
          rows: batch,
          sourceUpdatedAt: startedAt,
        }),
      )
      return { accepted: rows.length, fetched: rows.length }
    })
    return results
  },
})

export const syncNflverse = internalAction({
  args: { season: v.optional(v.number()) },
  handler: async (
    ctx,
    args,
  ): Promise<{
    games: number
    playerGames: number
    rosters: number
    season: number
  }> => {
    const season = Math.floor(args.season ?? new Date().getUTCFullYear())
    if (season < 2015 || season > 2100)
      throw new Error('NFL season is outside scope.')
    const startedAt = Date.now()
    await ctx.runMutation(internal.teamData.beginSync, {
      source: 'nflverse',
      startedAt,
    })
    try {
      const identities: Array<{
        _id: Id<'nflIdentities'>
        playerId: Id<'players'>
        provider: string
        providerId: string
      }> = await ctx.runQuery(internal.teamData.loadNflIdentities, {})
      const identityByProviderId = new Map(
        identities
          .filter((identity) => identity.provider === 'nflverse')
          .map((identity) => [identity.providerId, identity] as const),
      )
      if (identityByProviderId.size === 0) {
        await ctx.runMutation(internal.teamData.completeSync, {
          acceptedRows: 0,
          completedAt: Date.now(),
          fetchedRows: 0,
          rejectedRows: 0,
          source: 'nflverse',
          warnings: ['No confirmed nflverse identities are configured.'],
        })
        return { games: 0, playerGames: 0, rosters: 0, season }
      }
      const urls = {
        rosters: `https://github.com/nflverse/nflverse-data/releases/download/weekly_rosters/roster_weekly_${season}.csv`,
        schedules:
          'https://github.com/nflverse/nflverse-data/releases/download/schedules/games.csv',
        stats: `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_${season}.csv`,
      }
      const [rosterResponse, scheduleResponse, statsResponse] =
        await Promise.all([
          fetch(urls.rosters),
          fetch(urls.schedules),
          fetch(urls.stats),
        ])
      for (const [name, response] of [
        ['rosters', rosterResponse],
        ['schedules', scheduleResponse],
        ['stats', statsResponse],
      ] as const) {
        if (!response.ok)
          throw new Error(
            `nflverse ${name} failed with HTTP ${response.status}.`,
          )
      }
      const [rawRosters, rawSchedules, rawStats] = await Promise.all([
        rosterResponse.text(),
        scheduleResponse.text(),
        statsResponse.text(),
      ])
      const rosterRows = parseCsv(rawRosters)
      const scheduleRows = parseCsv(rawSchedules).filter(
        (row) => Number(row.season) === season,
      )
      const statRows = parseCsv(rawStats)
      const retainedTeams = new Set<string>()
      const rosters = new Map<
        string,
        {
          nflIdentityId: Id<'nflIdentities'>
          playerId: Id<'players'>
          season: number
          status:
            | 'active'
            | 'inactive'
            | 'injured_reserve'
            | 'practice_squad'
            | 'reserve'
          team: string
          week: number
        }
      >()
      for (const row of rosterRows) {
        const identity = identityByProviderId.get(row.gsis_id)
        const week = Number(row.week)
        const team = row.team.trim().toUpperCase()
        if (!identity || !Number.isInteger(week) || !team) continue
        retainedTeams.add(team)
        rosters.set(`${identity.playerId}:${week}`, {
          nflIdentityId: identity._id,
          playerId: identity.playerId,
          season,
          status: nflRosterStatus(row.status),
          team,
          week,
        })
      }
      const relevantStats = statRows.flatMap((row) => {
        const identity = identityByProviderId.get(row.player_id)
        const week = Number(row.week)
        const team = row.team.trim().toUpperCase()
        const opponent = row.opponent_team.trim().toUpperCase()
        if (!identity || !Number.isInteger(week) || !team || !opponent)
          return []
        retainedTeams.add(team)
        return [{ identity, opponent, row, team, week }]
      })
      const games = scheduleRows.flatMap((row) => {
        const homeTeam = row.home_team.trim().toUpperCase()
        const awayTeam = row.away_team.trim().toUpperCase()
        const sourceGameId = row.game_id.trim()
        const week = Number(row.week)
        if (!sourceGameId || !homeTeam || !awayTeam || !Number.isInteger(week))
          return []
        if (!retainedTeams.has(homeTeam) && !retainedTeams.has(awayTeam))
          return []
        const date = row.gameday || row.game_date
        const time = /^\d{1,2}:\d{2}$/.test(row.gametime)
          ? row.gametime
          : '00:00'
        const parsedTime = Date.parse(`${date}T${time}:00Z`)
        return [
          {
            awayTeam,
            completed:
              row.result !== '' ||
              row.home_score !== '' ||
              row.away_score !== '',
            homeTeam,
            season,
            sourceGameId,
            startTime: Number.isFinite(parsedTime)
              ? parsedTime
              : Date.UTC(season, 7, 1),
            week,
          },
        ]
      })
      const gameByTeamWeek = new Map<string, string>()
      for (const game of games) {
        gameByTeamWeek.set(
          `${game.week}:${game.homeTeam}:${game.awayTeam}`,
          game.sourceGameId,
        )
        gameByTeamWeek.set(
          `${game.week}:${game.awayTeam}:${game.homeTeam}`,
          game.sourceGameId,
        )
      }
      const playerGames = relevantStats.flatMap(
        ({ identity, opponent, row, team, week }) => {
          const sourceGameId =
            row.game_id || gameByTeamWeek.get(`${week}:${team}:${opponent}`)
          return sourceGameId
            ? [
                {
                  playerId: identity.playerId,
                  sourceGameId,
                  statistics: nflStatistics(row),
                  team,
                },
              ]
            : []
        },
      )
      await batches(games, (batch) =>
        ctx.runMutation(internal.teamData.upsertNflGamesBatch, { rows: batch }),
      )
      await batches([...rosters.values()], (batch) =>
        ctx.runMutation(internal.teamData.upsertNflRostersBatch, {
          rows: batch,
          sourceUpdatedAt: startedAt,
        }),
      )
      await batches(playerGames, (batch) =>
        ctx.runMutation(internal.teamData.upsertNflPlayerGamesBatch, {
          rows: batch,
          sourceUpdatedAt: startedAt,
        }),
      )
      await ctx.runMutation(internal.teamData.rebuildNflSummaries, { season })
      const acceptedRows = games.length + rosters.size + playerGames.length
      const fetchedRows =
        rosterRows.length + scheduleRows.length + statRows.length
      await ctx.runMutation(internal.teamData.completeSync, {
        acceptedRows,
        completedAt: Date.now(),
        fetchedRows,
        rejectedRows: Math.max(0, fetchedRows - acceptedRows),
        source: 'nflverse',
      })
      return {
        games: games.length,
        playerGames: playerGames.length,
        rosters: rosters.size,
        season,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await ctx.runMutation(internal.teamData.failSync, {
        completedAt: Date.now(),
        error: message,
        source: 'nflverse',
      })
      throw error
    }
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
export const getProgramProfile = query({
  args: { programKey: v.string(), season: v.number() },
  handler: async (ctx, args) => {
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', args.programKey))
      .unique()
    if (!program) return null
    const [profile, affiliations, venueLinks, games, draft] = await Promise.all(
      [
        ctx.db
          .query('teamSeasonProfiles')
          .withIndex('by_programId_and_season', (q) =>
            q.eq('programId', program._id).eq('season', args.season),
          )
          .unique(),
        ctx.db
          .query('programAffiliations')
          .withIndex('by_programId_and_startSeason', (q) =>
            q.eq('programId', program._id),
          )
          .take(100),
        ctx.db
          .query('programVenues')
          .withIndex('by_programId_and_startSeason', (q) =>
            q.eq('programId', program._id),
          )
          .take(100),
        Promise.all([
          ctx.db
            .query('collegeGames')
            .withIndex('by_homeProgramId_and_season', (q) =>
              q.eq('homeProgramId', program._id).eq('season', args.season),
            )
            .take(30),
          ctx.db
            .query('collegeGames')
            .withIndex('by_awayProgramId_and_season', (q) =>
              q.eq('awayProgramId', program._id).eq('season', args.season),
            )
            .take(30),
        ]).then(([home, away]) =>
          [...home, ...away].sort((a, b) => a.startTime - b.startTime),
        ),
        ctx.db
          .query('teamDraftSelections')
          .withIndex('by_programId_and_year', (q) =>
            q
              .eq('programId', program._id)
              .gte('year', args.season - 4)
              .lte('year', args.season),
          )
          .take(200),
      ],
    )
    const venues = await Promise.all(
      venueLinks.map(async (link) => ({
        link,
        venue: await ctx.db.get('venues', link.venueId),
      })),
    )
    return { affiliations, draft, games, profile, program, venues }
  },
})
export const listRecruitingBySeason = query({
  args: { limit: v.optional(v.number()), season: v.number() },
  handler: async (ctx, args) =>
    ctx.db
      .query('teamSeasonProfiles')
      .withIndex('by_season_and_recruitingRank', (q) =>
        q.eq('season', args.season),
      )
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
    if (
      args.toSeason < args.fromSeason ||
      args.toSeason - args.fromSeason > 50
    ) {
      throw new Error(
        'Season range must be ordered and no wider than 50 years.',
      )
    }
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', args.programKey))
      .unique()
    if (!program) return null
    const [profiles, standings, draft, affiliations] = await Promise.all([
      ctx.db
        .query('teamSeasonProfiles')
        .withIndex('by_programId_and_season', (q) =>
          q
            .eq('programId', program._id)
            .gte('season', args.fromSeason)
            .lte('season', args.toSeason),
        )
        .take(51),
      ctx.db
        .query('teamSeasonStandings')
        .withIndex('by_programId_and_season', (q) =>
          q
            .eq('programId', program._id)
            .gte('season', args.fromSeason)
            .lte('season', args.toSeason),
        )
        .take(51),
      ctx.db
        .query('teamDraftSelections')
        .withIndex('by_programId_and_year', (q) =>
          q
            .eq('programId', program._id)
            .gte('year', args.fromSeason)
            .lte('year', args.toSeason),
        )
        .take(500),
      ctx.db
        .query('programAffiliations')
        .withIndex('by_programId_and_startSeason', (q) =>
          q.eq('programId', program._id),
        )
        .take(100),
    ])
    return { affiliations, draft, profiles, program, standings }
  },
})
export const getSyncState = query({
  args: {},
  handler: async (ctx) =>
    ctx.db.query('teamDataSyncState').withIndex('by_source').take(20),
})
