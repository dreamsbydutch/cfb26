import { v } from 'convex/values'
import { internal } from './_generated/api'
import { env, internalAction, internalMutation } from './_generated/server'
import { resolveProgram } from './programIdentity'

const CFBD_BASE_URL = 'https://api.collegefootballdata.com'
const BATCH_SIZE = 40
const MAX_SEASON_ROWS = 250

const metricSourceValidator = v.union(
  v.literal('core'),
  v.literal('sp'),
  v.literal('fpi'),
  v.literal('advanced'),
  v.literal('talent'),
  v.literal('returning'),
)

type MetricSource = 'core' | 'sp' | 'fpi' | 'advanced' | 'talent' | 'returning'
type SourceRow = Record<string, unknown>
type SignalMapping = readonly [key: string, path: string]

type ParsedRow = {
  conference?: string
  season: number
  signals: Array<{ key: string; value: number }>
  team: string
}

const inputRowValidator = v.object({
  conference: v.optional(v.string()),
  season: v.number(),
  signals: v.array(v.object({ key: v.string(), value: v.number() })),
  team: v.string(),
})

const SOURCE_CONFIG: ReadonlyArray<{
  mappings: ReadonlyArray<SignalMapping>
  path: (season: number) => string
  seasonField: 'season' | 'year'
  source: MetricSource
}> = [
  {
    mappings: [
      ['overall', 'overall'],
      ['offense', 'offense'],
      ['defense', 'defense'],
      ['offensePlays', 'offensePlays'],
      ['defensePlays', 'defensePlays'],
      ['throughWeek', 'throughWeek'],
    ],
    path: (season) => `/ratings/core?year=${season}`,
    seasonField: 'year',
    source: 'core',
  },
  {
    mappings: [
      ['overall', 'rating'],
      ['ranking', 'ranking'],
      ['secondOrderWins', 'secondOrderWins'],
      ['sos', 'sos'],
      ['offense.rating', 'offense.rating'],
      ['offense.ranking', 'offense.ranking'],
      ['offense.pace', 'offense.pace'],
      ['offense.runRate', 'offense.runRate'],
      ['offense.passingDowns', 'offense.passingDowns'],
      ['offense.standardDowns', 'offense.standardDowns'],
      ['offense.passing', 'offense.passing'],
      ['offense.rushing', 'offense.rushing'],
      ['offense.explosiveness', 'offense.explosiveness'],
      ['offense.success', 'offense.success'],
      ['defense.rating', 'defense.rating'],
      ['defense.ranking', 'defense.ranking'],
      ['defense.passingDowns', 'defense.passingDowns'],
      ['defense.standardDowns', 'defense.standardDowns'],
      ['defense.passing', 'defense.passing'],
      ['defense.rushing', 'defense.rushing'],
      ['defense.explosiveness', 'defense.explosiveness'],
      ['defense.success', 'defense.success'],
      ['defense.havoc', 'defense.havoc.total'],
      ['specialTeams', 'specialTeams.rating'],
    ],
    path: (season) => `/ratings/sp?year=${season}`,
    seasonField: 'year',
    source: 'sp',
  },
  {
    mappings: [
      ['overall', 'fpi'],
      ['efficiency.overall', 'efficiencies.overall'],
      ['efficiency.offense', 'efficiencies.offense'],
      ['efficiency.defense', 'efficiencies.defense'],
      ['efficiency.specialTeams', 'efficiencies.specialTeams'],
      ['resume.gameControl', 'resumeRanks.gameControl'],
      ['resume.remainingSos', 'resumeRanks.remainingStrengthOfSchedule'],
      ['resume.sos', 'resumeRanks.strengthOfSchedule'],
      ['resume.averageWinProbability', 'resumeRanks.averageWinProbability'],
      ['resume.fpi', 'resumeRanks.fpi'],
      ['resume.strengthOfRecord', 'resumeRanks.strengthOfRecord'],
    ],
    path: (season) => `/ratings/fpi?year=${season}`,
    seasonField: 'year',
    source: 'fpi',
  },
  {
    mappings: [
      ['offense.ppa', 'offense.ppa'],
      ['offense.successRate', 'offense.successRate'],
      ['offense.explosiveness', 'offense.explosiveness'],
      ['offense.pointsPerOpportunity', 'offense.pointsPerOpportunity'],
      ['offense.fieldPosition', 'offense.fieldPosition.averagePredictedPoints'],
      ['offense.passing.ppa', 'offense.passingPlays.ppa'],
      ['offense.passing.successRate', 'offense.passingPlays.successRate'],
      ['offense.passing.explosiveness', 'offense.passingPlays.explosiveness'],
      ['offense.rushing.ppa', 'offense.rushingPlays.ppa'],
      ['offense.rushing.successRate', 'offense.rushingPlays.successRate'],
      ['offense.rushing.explosiveness', 'offense.rushingPlays.explosiveness'],
      ['offense.standardDowns.ppa', 'offense.standardDowns.ppa'],
      [
        'offense.standardDowns.successRate',
        'offense.standardDowns.successRate',
      ],
      ['offense.passingDowns.ppa', 'offense.passingDowns.ppa'],
      ['offense.passingDowns.successRate', 'offense.passingDowns.successRate'],
      ['offense.lineYards', 'offense.lineYards'],
      ['offense.stuffRate', 'offense.stuffRate'],
      ['offense.powerSuccess', 'offense.powerSuccess'],
      ['defense.ppa', 'defense.ppa'],
      ['defense.successRate', 'defense.successRate'],
      ['defense.explosiveness', 'defense.explosiveness'],
      ['defense.pointsPerOpportunity', 'defense.pointsPerOpportunity'],
      ['defense.fieldPosition', 'defense.fieldPosition.averagePredictedPoints'],
      ['defense.passing.ppa', 'defense.passingPlays.ppa'],
      ['defense.passing.successRate', 'defense.passingPlays.successRate'],
      ['defense.passing.explosiveness', 'defense.passingPlays.explosiveness'],
      ['defense.rushing.ppa', 'defense.rushingPlays.ppa'],
      ['defense.rushing.successRate', 'defense.rushingPlays.successRate'],
      ['defense.rushing.explosiveness', 'defense.rushingPlays.explosiveness'],
      ['defense.standardDowns.ppa', 'defense.standardDowns.ppa'],
      [
        'defense.standardDowns.successRate',
        'defense.standardDowns.successRate',
      ],
      ['defense.passingDowns.ppa', 'defense.passingDowns.ppa'],
      ['defense.passingDowns.successRate', 'defense.passingDowns.successRate'],
      ['defense.lineYards', 'defense.lineYards'],
      ['defense.stuffRate', 'defense.stuffRate'],
      ['defense.powerSuccess', 'defense.powerSuccess'],
      ['defense.havoc', 'defense.havoc.total'],
    ],
    path: (season) =>
      `/stats/season/advanced?year=${season}&excludeGarbageTime=true&classification=fbs`,
    seasonField: 'season',
    source: 'advanced',
  },
  {
    mappings: [['composite', 'talent']],
    path: (season) => `/talent?year=${season}`,
    seasonField: 'year',
    source: 'talent',
  },
  {
    mappings: [
      ['totalPpa', 'totalPPA'],
      ['passingPpa', 'totalPassingPPA'],
      ['receivingPpa', 'totalReceivingPPA'],
      ['rushingPpa', 'totalRushingPPA'],
      ['percentPpa', 'percentPPA'],
      ['percentPassingPpa', 'percentPassingPPA'],
      ['percentReceivingPpa', 'percentReceivingPPA'],
      ['percentRushingPpa', 'percentRushingPPA'],
      ['usage', 'usage'],
      ['passingUsage', 'passingUsage'],
      ['receivingUsage', 'receivingUsage'],
      ['rushingUsage', 'rushingUsage'],
    ],
    path: (season) => `/player/returning?year=${season}`,
    seasonField: 'season',
    source: 'returning',
  },
]

function sourceRows(value: unknown, source: MetricSource) {
  if (!Array.isArray(value)) {
    throw new Error(`CFBD ${source} returned a non-array JSON document.`)
  }
  return value.map((row, index) => {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      throw new Error(`CFBD ${source} row ${index + 1} is not an object.`)
    }
    return row as SourceRow
  })
}

function valueAt(row: SourceRow, path: string): unknown {
  let value: unknown = row
  for (const part of path.split('.')) {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return undefined
    }
    value = (value as Record<string, unknown>)[part]
  }
  return value
}

function optionalNumberAt(row: SourceRow, path: string) {
  const raw = valueAt(row, path)
  if (raw === null || raw === undefined || raw === '') return undefined
  const value = typeof raw === 'number' ? raw : Number(raw)
  return Number.isFinite(value) ? value : undefined
}

function optionalStringAt(row: SourceRow, path: string) {
  const raw = valueAt(row, path)
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
}

function parseRows(
  rows: Array<SourceRow>,
  source: MetricSource,
  season: number,
  seasonField: 'season' | 'year',
  mappings: ReadonlyArray<SignalMapping>,
) {
  const accepted: Array<ParsedRow> = []
  let rejected = 0
  for (const row of rows) {
    const team = optionalStringAt(row, 'team')
    const rowSeason = optionalNumberAt(row, seasonField)
    const normalizedTeam = team?.toLowerCase().replace(/[^a-z0-9]/g, '')
    if (
      !team ||
      normalizedTeam === 'nationalaverages' ||
      rowSeason !== season
    ) {
      rejected += 1
      continue
    }
    const signals = mappings.flatMap(([key, path]) => {
      const value = optionalNumberAt(row, path)
      return value === undefined ? [] : [{ key: `${source}.${key}`, value }]
    })
    if (signals.length === 0) {
      rejected += 1
      continue
    }
    accepted.push({
      conference: optionalStringAt(row, 'conference'),
      season,
      signals,
      team,
    })
  }

  if (source !== 'core') return { accepted, rejected }

  const latest = new Map<string, ParsedRow>()
  for (const row of accepted) {
    const key = row.team.toLowerCase()
    const previous = latest.get(key)
    const week = row.signals.find(
      (signal) => signal.key === 'core.throughWeek',
    )?.value
    const previousWeek = previous?.signals.find(
      (signal) => signal.key === 'core.throughWeek',
    )?.value
    if (!previous || (week ?? -1) >= (previousWeek ?? -1)) latest.set(key, row)
  }
  return { accepted: [...latest.values()], rejected }
}

async function fetchSource(key: string, path: string, source: MetricSource) {
  const response = await fetch(`${CFBD_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
  if (!response.ok) {
    throw new Error(`${source} failed with HTTP ${response.status}`)
  }
  return sourceRows(await response.json(), source)
}

export const clearSeasonSource = internalMutation({
  args: { season: v.number(), source: metricSourceValidator },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('teamSeasonRatingInputs')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .take(MAX_SEASON_ROWS)
    const prefix = `${args.source}.`
    for (const row of rows) {
      const signals = row.signals.filter(
        (signal) => !signal.key.startsWith(prefix),
      )
      const sources = row.sources.filter((source) => source !== args.source)
      if (signals.length === 0)
        await ctx.db.delete('teamSeasonRatingInputs', row._id)
      else
        await ctx.db.patch('teamSeasonRatingInputs', row._id, {
          signals,
          sources,
        })
    }
  },
})

export const upsertBatch = internalMutation({
  args: {
    rows: v.array(inputRowValidator),
    source: metricSourceValidator,
    sourceUpdatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      const programId = await resolveProgram(ctx, 'rating_inputs', row.team)
      const existing = await ctx.db
        .query('teamSeasonRatingInputs')
        .withIndex('by_programId_and_season', (q) =>
          q.eq('programId', programId).eq('season', row.season),
        )
        .unique()
      const signalMap = new Map(
        existing?.signals.map((signal) => [signal.key, signal.value]) ?? [],
      )
      for (const signal of row.signals) signalMap.set(signal.key, signal.value)
      const document = {
        conference: row.conference ?? existing?.conference,
        programId,
        season: row.season,
        signals: [...signalMap.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([key, value]) => ({ key, value })),
        sourceProgramName: row.team,
        sourceUpdatedAt: args.sourceUpdatedAt,
        sources: [
          ...new Set([...(existing?.sources ?? []), args.source]),
        ].sort(),
      }
      if (existing)
        await ctx.db.replace('teamSeasonRatingInputs', existing._id, document)
      else await ctx.db.insert('teamSeasonRatingInputs', document)
    }
  },
})

export const syncSeason = internalAction({
  args: { season: v.number() },
  handler: async (ctx, args) => {
    const season = Math.floor(args.season)
    const key = env.CFBD_API_KEY
    if (!key) {
      return {
        acceptedRows: 0,
        configured: false,
        fetchedRows: 0,
        rejectedRows: 0,
        warnings: ['CFBD_API_KEY is not configured.'],
      }
    }

    const startedAt = Date.now()
    await ctx.runMutation(internal.teamData.beginSync, {
      source: 'rating_inputs',
      startedAt,
    })
    let acceptedRows = 0
    let fetchedRows = 0
    let rejectedRows = 0
    let successfulSources = 0
    const warnings: Array<string> = []

    for (const config of SOURCE_CONFIG) {
      try {
        const source = await fetchSource(
          key,
          config.path(season),
          config.source,
        )
        const parsed = parseRows(
          source,
          config.source,
          season,
          config.seasonField,
          config.mappings,
        )
        await ctx.runMutation(internal.ratingInputs.clearSeasonSource, {
          season,
          source: config.source,
        })
        for (
          let offset = 0;
          offset < parsed.accepted.length;
          offset += BATCH_SIZE
        ) {
          await ctx.runMutation(internal.ratingInputs.upsertBatch, {
            rows: parsed.accepted.slice(offset, offset + BATCH_SIZE),
            source: config.source,
            sourceUpdatedAt: startedAt,
          })
        }
        acceptedRows += parsed.accepted.length
        fetchedRows += source.length
        rejectedRows += parsed.rejected
        successfulSources += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        warnings.push(message)
      }
    }

    if (successfulSources === 0) {
      const error =
        warnings.join('; ') || 'Every CFBD rating-input source failed.'
      await ctx.runMutation(internal.teamData.failSync, {
        completedAt: Date.now(),
        error,
        source: 'rating_inputs',
      })
    } else {
      await ctx.runMutation(internal.teamData.completeSync, {
        acceptedRows,
        completedAt: Date.now(),
        fetchedRows,
        rejectedRows,
        source: 'rating_inputs',
        warnings: warnings.length > 0 ? warnings : undefined,
      })
    }

    return {
      acceptedRows,
      configured: true,
      fetchedRows,
      rejectedRows,
      warnings,
    }
  },
})
