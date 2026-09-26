import { v } from 'convex/values'
import { internal } from './_generated/api'
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
} from './_generated/server'
import { isFbsGame } from './gameStatus'
import { scoreboardRowValidator } from './scoreboardFields'
import {
  SCOREBOARD_INTERVAL,
  SCOREBOARD_RESERVE,
  SCOREBOARD_WINDOW,
  acceptLiveScore,
  needsScoreboard,
  parseScoreboard,
  parseScoreboardAllowance,
  scoreboardBackoff,
  scoreboardBudget,
} from './scoreboardModel'

const claimValidator = v.object({
  token: v.number(),
  checkAllowance: v.boolean(),
})

// Transactional reservation prevents cron/manual overlap and counts failed requests.
export const claim = internalMutation({
  args: { verifyAccess: v.optional(v.boolean()) },
  returns: v.union(v.null(), claimValidator),
  handler: async (ctx, args) => {
    if (env.LIVE_SCORES_ENABLED !== 'true' || !env.CFBD_API_KEY) return null
    const now = Date.now()
    const state = await ctx.db
      .query('scoreboardSyncState')
      .withIndex('by_key', (q) => q.eq('key', 'fbs'))
      .unique()
    const budget = scoreboardBudget(state, now)
    if (
      !budget.allowed ||
      (!budget.checkAllowance &&
        state?.remainingCalls !== undefined &&
        state.remainingCalls <= SCOREBOARD_RESERVE)
    )
      return null
    // January postseason games belong to the previous football season.
    const year = new Date(now).getUTCFullYear()
    const windows = await Promise.all(
      [year - 1, year].map((season) =>
        ctx.db
          .query('collegeGames')
          .withIndex('by_season_and_startTime', (q) =>
            q
              .eq('season', season)
              .gte('startTime', now - SCOREBOARD_WINDOW)
              .lte('startTime', now + 10 * 60_000),
          )
          .take(251),
      ),
    )
    if (windows.some((rows) => rows.length > 250)) return null
    if (
      !args.verifyAccess &&
      !windows
        .flat()
        .some((game) => isFbsGame(game) && needsScoreboard(game, now))
    )
      return null
    const fields = {
      month: budget.month,
      day: budget.day,
      monthRequests: budget.monthRequests,
      dayRequests: budget.dayRequests,
      lastAttemptAt: now,
      nextPollAt: now + SCOREBOARD_INTERVAL,
      remainingCalls:
        state?.remainingCalls === undefined
          ? undefined
          : Math.max(0, state.remainingCalls - (budget.checkAllowance ? 2 : 1)),
    }
    if (state) await ctx.db.patch('scoreboardSyncState', state._id, fields)
    else
      await ctx.db.insert('scoreboardSyncState', {
        key: 'fbs',
        consecutiveFailures: 0,
        ...fields,
      })
    return { token: now, checkAllowance: budget.checkAllowance }
  },
})

export const finish = internalMutation({
  args: {
    token: v.number(),
    rows: v.optional(v.array(scoreboardRowValidator)),
    allowance: v.optional(
      v.object({
        enabled: v.boolean(),
        remainingCalls: v.number(),
        resetAt: v.number(),
      }),
    ),
    error: v.optional(v.string()),
    httpStatus: v.optional(v.number()),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query('scoreboardSyncState')
      .withIndex('by_key', (q) => q.eq('key', 'fbs'))
      .unique()
    if (!state || state.lastAttemptAt !== args.token) return 0
    const now = Date.now()
    const allowanceFields = args.allowance
      ? {
          allowanceCheckedAt: now,
          remainingCalls: Math.max(0, args.allowance.remainingCalls - 1),
        }
      : {}
    if (args.error || !args.rows?.length) {
      const failures = state.consecutiveFailures + 1
      const quotaPause =
        args.allowance && args.allowance.remainingCalls <= SCOREBOARD_RESERVE
      await ctx.db.patch('scoreboardSyncState', state._id, {
        ...allowanceFields,
        consecutiveFailures: failures,
        lastError:
          args.error ?? 'Scoreboard returned no games; last scores retained.',
        nextPollAt:
          now +
          (quotaPause
            ? 6 * 60 * 60_000
            : scoreboardBackoff(args.httpStatus, failures)),
      })
      return 0
    }
    if (args.rows.length > 250)
      throw new Error('Scoreboard batch exceeds limit')
    let updated = 0
    for (const row of args.rows) {
      const game = await ctx.db
        .query('collegeGames')
        .withIndex('by_sourceKey', (q) =>
          q.eq('sourceKey', `cfbd:game:${row.id}`),
        )
        .unique()
      if (!game || !isFbsGame(game) || !acceptLiveScore(game, row, args.token))
        continue
      const { id: _id, homeId: _home, awayId: _away, ...score } = row
      await ctx.db.patch('collegeGames', game._id, {
        liveScore: { ...score, updatedAt: args.token },
      })
      updated += 1
    }
    await ctx.db.patch('scoreboardSyncState', state._id, {
      ...allowanceFields,
      lastSuccessAt: now,
      lastError: undefined,
      consecutiveFailures: 0,
    })
    return updated
  },
})

class ScoreboardHttpError extends Error {
  constructor(readonly status: number) {
    super(`Scoreboard provider returned HTTP ${status}`)
  }
}

async function request(path: '/info' | '/scoreboard?classification=fbs') {
  const response = await fetch(`https://api.collegefootballdata.com${path}`, {
    headers: { Authorization: `Bearer ${env.CFBD_API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new ScoreboardHttpError(response.status)
  return (await response.json()) as unknown
}

export const refresh = internalAction({
  args: { verifyAccess: v.optional(v.boolean()) },
  returns: v.object({ polled: v.boolean(), updated: v.number() }),
  handler: async (ctx, args): Promise<{ polled: boolean; updated: number }> => {
    const reservation: { token: number; checkAllowance: boolean } | null =
      await ctx.runMutation(internal.scoreboard.claim, args)
    if (!reservation) return { polled: false, updated: 0 }
    let allowance: ReturnType<typeof parseScoreboardAllowance> | undefined
    try {
      if (reservation.checkAllowance) {
        allowance = parseScoreboardAllowance(await request('/info'))
        if (
          !allowance.enabled ||
          allowance.remainingCalls <= SCOREBOARD_RESERVE
        ) {
          await ctx.runMutation(internal.scoreboard.finish, {
            token: reservation.token,
            allowance,
            error: allowance.enabled
              ? 'Scoreboard paused to preserve API allowance.'
              : 'Scoreboard access is unavailable for this key.',
            httpStatus: allowance.enabled ? undefined : 403,
          })
          return { polled: true, updated: 0 }
        }
      }
      const rows = parseScoreboard(
        await request('/scoreboard?classification=fbs'),
      )
      const updated: number = await ctx.runMutation(
        internal.scoreboard.finish,
        { token: reservation.token, rows, allowance },
      )
      return { polled: true, updated }
    } catch (error) {
      await ctx.runMutation(internal.scoreboard.finish, {
        token: reservation.token,
        allowance,
        error: 'Scoreboard refresh failed; last scores retained.',
        httpStatus:
          error instanceof ScoreboardHttpError ? error.status : undefined,
      })
      return { polled: true, updated: 0 }
    }
  },
})

export const health = internalQuery({
  args: {},
  returns: v.object({
    enabled: v.boolean(),
    monthRequests: v.number(),
    dayRequests: v.number(),
    remainingCalls: v.union(v.number(), v.null()),
    lastSuccessAt: v.union(v.number(), v.null()),
    lastError: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const state = await ctx.db
      .query('scoreboardSyncState')
      .withIndex('by_key', (q) => q.eq('key', 'fbs'))
      .unique()
    return {
      enabled: env.LIVE_SCORES_ENABLED === 'true',
      monthRequests: state?.monthRequests ?? 0,
      dayRequests: state?.dayRequests ?? 0,
      remainingCalls: state?.remainingCalls ?? null,
      lastSuccessAt: state?.lastSuccessAt ?? null,
      lastError: state?.lastError ?? null,
    }
  },
})
