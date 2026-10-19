import { v } from 'convex/values'
import { internalAction, internalMutation, query } from './_generated/server'
import { internal } from './_generated/api'
import { npiSchedule, npiTeam } from './hockeyNpiFields'
import {
  NPI_SOURCE,
  hockeySeasonAt,
  npiWeekStart,
  parseNpiPage,
  validateNpiTeams,
} from './hockeyNpiModel'

function validateSeason(season: number) {
  if (!Number.isInteger(season) || season < 2025 || season > 2200)
    throw new Error('NPI seasons begin in 2025-26.')
}

export const claim = internalMutation({
  args: { season: v.number() },
  returns: v.union(
    v.null(),
    v.object({ token: v.number(), sourceUrl: v.string(), final: v.boolean() }),
  ),
  handler: async (ctx, { season }) => {
    validateSeason(season)
    const now = Date.now()
    if (season > hockeySeasonAt(now)) throw new Error('Future NPI season.')
    // May is safely after the NCAA championship; use the season-specific archive.
    const final = now >= Date.UTC(season + 1, 4, 1)
    const sourceUrl = final ? `${NPI_SOURCE}/${season + 1}` : NPI_SOURCE
    const row = await ctx.db
      .query('hockeyNpiSeasons')
      .withIndex('by_season', (q) => q.eq('season', season))
      .unique()
    if (
      row &&
      (row.final ||
        row.leaseUntil > now ||
        (!final &&
          row.observedAt !== null &&
          npiWeekStart(row.observedAt) === npiWeekStart(now)))
    )
      return null
    const lease = {
      lastAttemptAt: now,
      leaseToken: now,
      leaseUntil: now + 5 * 60_000,
    }
    if (row) await ctx.db.patch('hockeyNpiSeasons', row._id, lease)
    else
      await ctx.db.insert('hockeyNpiSeasons', {
        season,
        teams: [],
        final: false,
        observedAt: null,
        sourceUrl,
        sourceSha256: '',
        lastError: null,
        ...lease,
      })
    return { token: now, sourceUrl, final }
  },
})

export const finish = internalMutation({
  args: {
    season: v.number(),
    token: v.number(),
    teams: v.optional(v.array(npiTeam)),
    sourceSha256: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('hockeyNpiSeasons')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .unique()
    if (
      !row ||
      row.leaseToken !== args.token ||
      row.leaseUntil === 0 ||
      row.final
    )
      return false
    if (args.error !== undefined) {
      await ctx.db.patch('hockeyNpiSeasons', row._id, {
        leaseUntil: 0,
        lastError: args.error.slice(0, 240),
      })
      return false
    }
    if (!args.teams || !/^[a-f0-9]{64}$/.test(args.sourceSha256 ?? ''))
      throw new Error('Validated NPI source required.')
    validateNpiTeams(args.teams)
    const final = args.token >= Date.UTC(args.season + 1, 4, 1)
    await ctx.db.patch('hockeyNpiSeasons', row._id, {
      teams: args.teams,
      sourceSha256: args.sourceSha256!,
      observedAt: Date.now(),
      final,
      sourceUrl: final ? `${NPI_SOURCE}/${args.season + 1}` : NPI_SOURCE,
      leaseUntil: 0,
      lastError: null,
    })
    return true
  },
})

export const refresh = internalAction({
  args: { season: v.optional(v.number()), attempt: v.optional(v.number()) },
  returns: v.object({ saved: v.number(), failed: v.number() }),
  handler: async (ctx, args): Promise<{ saved: number; failed: number }> => {
    const attempt = args.attempt ?? 0
    if (!Number.isInteger(attempt) || attempt < 0 || attempt > 2)
      throw new Error('Invalid retry.')
    const active = hockeySeasonAt(Date.now())
    const seasons =
      args.season !== undefined
        ? [args.season]
        : [active, active - 1].filter((s) => s >= 2025)
    let saved = 0,
      failed = 0
    for (const season of seasons) {
      const lease: { token: number; sourceUrl: string; final: boolean } | null =
        await ctx.runMutation(internal.hockeyNpi.claim, { season })
      if (!lease) continue
      try {
        const response = await fetch(lease.sourceUrl, {
          signal: AbortSignal.timeout(20_000),
        })
        if (!response.ok) throw new Error(`CHN NPI HTTP ${response.status}`)
        const html = await response.text()
        const teams = parseNpiPage(html, season)
        const digest = await crypto.subtle.digest(
          'SHA-256',
          new TextEncoder().encode(html),
        )
        const sourceSha256 = Array.from(new Uint8Array(digest), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join('')
        if (
          await ctx.runMutation(internal.hockeyNpi.finish, {
            season,
            token: lease.token,
            teams,
            sourceSha256,
          })
        )
          saved++
      } catch (error) {
        failed++
        const message =
          error instanceof Error ? error.message : 'NPI refresh failed.'
        await ctx.runMutation(internal.hockeyNpi.finish, {
          season,
          token: lease.token,
          error: message,
        })
        console.error(`NPI ${season}: ${message.slice(0, 240)}`)
        if (attempt < 2)
          await ctx.scheduler.runAfter(
            15 * 60_000,
            internal.hockeyNpi.refresh,
            { season, attempt: attempt + 1 },
          )
      }
    }
    return { saved, failed }
  },
})

export const forSchedule = query({
  args: { season: v.number() },
  returns: npiSchedule,
  handler: async (ctx, { season }) => {
    validateSeason(season)
    const row = await ctx.db
      .query('hockeyNpiSeasons')
      .withIndex('by_season', (q) => q.eq('season', season))
      .unique()
    const newest = await ctx.db
      .query('hockeyNpiSeasons')
      .withIndex('by_season')
      .order('desc')
      .first()
    const visible =
      row && row.observedAt !== null && (row.final || season === newest?.season)
    return {
      latest: visible
        ? {
            observedAt: row.observedAt!,
            final: row.final,
            sourceUrl: row.sourceUrl,
            michiganRank:
              row.teams.find((team) => team.sourceTeamId === '31')?.rank ??
              null,
            teams: row.teams,
          }
        : null,
      refreshFailed: row?.lastError !== null && row?.lastError !== undefined,
    }
  },
})
