import { v } from 'convex/values'
import {
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server'
import { internal } from './_generated/api'
import schema from './schema'
import {
  hockeyGame,
  hockeyScheduleUrl,
  validateHockeyGames,
} from './hockeyScheduleFields'
import { hockeyPlayerResult, hockeyResultSource } from './hockeyResultFields'
import {
  easternRunAt,
  normalizedHockeyName,
  officialUrl,
  parseHockeyBox,
  parseHockeySchedule,
  validateHockeyPlayerResults,
} from './hockeyResultModel'
import { requireOwnerSession } from './rosterAdmin'
import type { Doc } from './_generated/dataModel'
import type { Infer } from 'convex/values'

function observation(game: Infer<typeof hockeyGame>) {
  return Object.fromEntries(
    Object.keys(hockeyGame.fields).map((key) => [
      key,
      game[key as keyof typeof game],
    ]),
  ) as Infer<typeof hockeyGame>
}
function fingerprint(game: Infer<typeof hockeyGame>) {
  return JSON.stringify(observation(game))
}

function sourceFingerprint(sources: Array<Infer<typeof hockeyResultSource>>) {
  return JSON.stringify(
    sources
      .map((s) => [s.url, s.sha256])
      .sort((a, b) => a[0].localeCompare(b[0])),
  )
}

function playerFingerprint(players: Array<Infer<typeof hockeyPlayerResult>>) {
  return JSON.stringify(
    [...players]
      .sort((a, b) => a.sourcePlayerId.localeCompare(b.sourcePlayerId))
      .map((p) => [
        p.sourcePlayerId,
        p.name,
        p.jersey,
        p.played,
        p.started,
        p.goals,
        p.assists,
        p.shots,
        p.penaltyMinutes,
        p.plusMinus,
        p.blockedShots,
        p.goalie
          ? [
              p.goalie.seconds,
              p.goalie.saves,
              p.goalie.goalsAgainst,
              p.goalie.wins ?? null,
              p.goalie.shutouts ?? null,
            ]
          : null,
      ]),
  )
}

export const candidates = internalQuery({
  args: { now: v.number() },
  returns: v.array(v.id('hockeyScheduleGames')),
  handler: async (ctx, { now }) => {
    const run = easternRunAt(now)
    if (run.hour < 3 || run.hour > 6) return []
    const earliest = new Date(
      Date.parse(`${run.today}T00:00:00Z`) - 14 * 86400000,
    )
      .toISOString()
      .slice(0, 10)
    const seasons = [run.season, run.season - 1]
    const result = []
    for (const season of seasons) {
      const games = await ctx.db
        .query('hockeyScheduleGames')
        .withIndex('by_season', (q) => q.eq('season', season))
        .take(81)
      for (const game of games) {
        if (
          game.date > run.yesterday ||
          ['cancelled', 'no_contest'].includes(game.status)
        )
          continue
        const state = await ctx.db
          .query('hockeyResultState')
          .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
          .unique()
        // Bootstrap complete current-season coverage, including games outside
        // the normal correction window. Upgrade receipts lacking goalie decisions.
        const receipt = state?.latestReceiptId
          ? await ctx.db.get('hockeyResultReceipts', state.latestReceiptId)
          : null
        const needsCoverage =
          season === run.season &&
          game.status === 'final' &&
          !game.exhibition &&
          (!receipt ||
            receipt.status !== 'complete' ||
            receipt.players.some(
              (p) =>
                p.goalie &&
                (p.goalie.wins === undefined ||
                  p.goalie.shutouts === undefined),
            ))
        if (game.date < earliest && !needsCoverage) continue
        if (
          !state ||
          (state.leaseUntil <= now &&
            state.nextAttemptAt <= now &&
            (needsCoverage ||
              state.status !== 'complete' ||
              state.checkedDate !== run.today))
        )
          result.push(game._id)
      }
    }
    return result
  },
})

export const claim = internalMutation({
  args: {
    gameId: v.id('hockeyScheduleGames'),
    manual: v.optional(v.boolean()),
  },
  returns: v.union(
    v.null(),
    v.object({ token: v.number(), game: schema.doc('hockeyScheduleGames') }),
  ),
  handler: async (ctx, { gameId, manual }) => {
    const game = await ctx.db.get('hockeyScheduleGames', gameId)
    if (!game) return null
    const now = Date.now(),
      run = easternRunAt(now)
    if (
      (!manual && (run.hour < 3 || run.hour > 6)) ||
      game.date > run.yesterday
    )
      return null
    const state = await ctx.db
      .query('hockeyResultState')
      .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
      .unique()
    if (
      state &&
      (state.leaseUntil > now ||
        (!manual &&
          (state.nextAttemptAt > now ||
            (state.status === 'complete' && state.checkedDate === run.today))))
    )
      return null
    const token = (state?.leaseToken ?? 0) + 1
    if (state)
      await ctx.db.patch('hockeyResultState', state._id, {
        leaseToken: token,
        leaseUntil: now + 10 * 60000,
      })
    else
      await ctx.db.insert('hockeyResultState', {
        gameId,
        leaseToken: token,
        leaseUntil: now + 10 * 60000,
        nextAttemptAt: 0,
        checkedDate: '',
        status: 'pending',
      })
    return { token, game }
  },
})

export const finish = internalMutation({
  args: {
    gameId: v.id('hockeyScheduleGames'),
    token: v.number(),
    expectedGame: hockeyGame,
    game: v.optional(hockeyGame),
    players: v.optional(v.array(hockeyPlayerResult)),
    sources: v.array(hockeyResultSource),
    issues: v.array(v.string()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const now = Date.now(),
      run = easternRunAt(now)
    const game = await ctx.db.get('hockeyScheduleGames', args.gameId)
    const state = await ctx.db
      .query('hockeyResultState')
      .withIndex('by_gameId', (q) => q.eq('gameId', args.gameId))
      .unique()
    if (
      !game ||
      !state ||
      state.leaseToken !== args.token ||
      state.leaseUntil <= now
    )
      return false
    const issues = args.issues.slice(0, 40).map((s) => s.slice(0, 240))
    if (
      args.sources.length > 3 ||
      args.sources.some(
        (s) => !/^[a-f0-9]{64}$/.test(s.sha256) || officialUrl(s.url) !== s.url,
      )
    )
      throw new Error('Invalid result provenance.')
    let next = observation(game)
    if (fingerprint(game) !== fingerprint(args.expectedGame))
      issues.push(
        'Saved schedule changed while official pages were being fetched.',
      )
    else if (args.game) {
      validateHockeyGames(game.season, [args.game])
      if (
        args.game.sourceGameId !== game.sourceGameId ||
        args.game.date !== game.date ||
        args.game.opponentId !== game.opponentId ||
        args.game.exhibition !== game.exhibition
      )
        issues.push(
          'Official date, opponent, or game identity changed; owner review required.',
        )
      else if (args.game.status !== 'final' || args.game.michiganScore === null)
        issues.push('Official final score is not available yet.')
      else if (
        !args.sources.some((s) => s.url === hockeyScheduleUrl(game.season))
      )
        issues.push('Official schedule provenance is missing.')
      else next = args.game
    }
    const canApplyScore =
      args.game !== undefined && fingerprint(next) === fingerprint(args.game)
    const matches: Array<{
      playerId: Doc<'teamRosterEntries'>['_id']
      row: Infer<typeof hockeyPlayerResult>
    }> = []
    if (canApplyScore && args.players && issues.length === 0) {
      validateHockeyPlayerResults(args.players, next.michiganScore!)
      const roster = await ctx.db
        .query('teamRosterEntries')
        .withIndex('by_sport_and_season', (q) =>
          q.eq('sport', 'hockey').eq('season', game.season),
        )
        .take(101)
      const seen = new Set<string>()
      for (const row of args.players) {
        const found = roster.filter(
          (p) =>
            normalizedHockeyName(String(p.values.name)) ===
            normalizedHockeyName(row.name),
        )
        const player = found.length === 1 ? found[0] : null
        if (
          !player ||
          (player.values.jersey != null &&
            String(player.values.jersey) !== row.jersey) ||
          seen.has(player._id) ||
          (player.values.position === 'G') !== (row.goalie !== null)
        ) {
          issues.push(`Roster match needs review: ${row.name}`)
        } else {
          seen.add(player._id)
          matches.push({ playerId: player._id, row })
        }
      }
      if (
        !next.boxScoreUrl ||
        !args.sources.some((s) => s.url === next.boxScoreUrl)
      )
        issues.push('Official box score provenance is missing.')
    }
    if (!args.players && issues.length === 0)
      issues.push('Player box score is not available yet.')
    const complete = canApplyScore && !!args.players && issues.length === 0
    const previous = state.latestReceiptId
      ? await ctx.db.get('hockeyResultReceipts', state.latestReceiptId)
      : null
    const changed = fingerprint(next) !== fingerprint(game)
    const same =
      complete &&
      previous?.status === 'complete' &&
      sourceFingerprint(previous.sources) === sourceFingerprint(args.sources) &&
      fingerprint(previous.after) === fingerprint(next) &&
      playerFingerprint(previous.players) ===
        playerFingerprint(args.players ?? [])
    let receiptId = state.latestReceiptId
    if (!same) {
      receiptId = await ctx.db.insert('hockeyResultReceipts', {
        gameId: game._id,
        importedAt: now,
        sources: args.sources,
        status: complete ? 'complete' : 'pending',
        issues,
        before: observation(game),
        after: next,
        players: args.players ?? [],
        ...(state.latestReceiptId
          ? { previousReceiptId: state.latestReceiptId }
          : {}),
        correction:
          (game.status === 'final' && changed) ||
          (previous !== null &&
            (previous.sources.some((old) =>
              args.sources.some(
                (source) =>
                  source.url === old.url && source.sha256 !== old.sha256,
              ),
            ) ||
              fingerprint(previous.after) !== fingerprint(next))),
      })
      if (complete) {
        const old = await ctx.db
          .query('hockeyPlayerGames')
          .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
          .take(41)
        for (const row of old) await ctx.db.delete('hockeyPlayerGames', row._id)
        for (const { playerId, row } of matches)
          await ctx.db.insert('hockeyPlayerGames', {
            ...row,
            gameId: game._id,
            playerId,
            receiptId,
          })
      }
    }
    if (changed) {
      await ctx.db.patch('hockeyScheduleGames', game._id, next)
      const latest = await ctx.db
        .query('hockeyScheduleImports')
        .withIndex('by_season', (q) => q.eq('season', game.season))
        .order('desc')
        .first()
      const games = await ctx.db
        .query('hockeyScheduleGames')
        .withIndex('by_season', (q) => q.eq('season', game.season))
        .take(81)
      await ctx.db.insert('hockeyScheduleImports', {
        season: game.season,
        revision: (latest?.revision ?? 0) + 1,
        sourceSha256: args.sources.find(
          (s) => s.url === hockeyScheduleUrl(game.season),
        )!.sha256,
        sourceUrl: hockeyScheduleUrl(game.season),
        gameCount: games.length,
        importedAt: now,
        automated: true,
      })
    }
    await ctx.db.patch('hockeyResultState', state._id, {
      leaseUntil: 0,
      // Leave room for fetch duration and scheduler jitter before the next hour.
      nextAttemptAt: now + 55 * 60000,
      checkedDate: run.today,
      status: complete ? 'complete' : 'pending',
      ...(receiptId ? { latestReceiptId: receiptId } : {}),
    })
    return complete
  },
})

async function fetchOfficial(url: string) {
  const response = await fetch(officialUrl(url), {
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  })
  if (!response.ok)
    throw new Error(`Official page returned HTTP ${response.status}.`)
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Official page is empty.')
  const chunks: Array<Uint8Array> = []
  let size = 0
  let chunk = await reader.read()
  while (!chunk.done) {
    const value = chunk.value
    size += value.byteLength
    if (size > 8 * 1024 * 1024) {
      await reader.cancel()
      throw new Error('Official page exceeds the import size limit.')
    }
    chunks.push(value)
    chunk = await reader.read()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const part of chunks) {
    bytes.set(part, offset)
    offset += part.length
  }
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return {
    html: new TextDecoder().decode(bytes),
    source: {
      url,
      sha256: Array.from(new Uint8Array(digest), (b) =>
        b.toString(16).padStart(2, '0'),
      ).join(''),
    },
  }
}

export const refresh = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const ids = await ctx.runQuery(internal.hockeyResults.candidates, {
      now: Date.now(),
    })
    for (const gameId of ids)
      await ctx.scheduler.runAfter(0, internal.hockeyResults.processGame, {
        gameId,
      })
    return null
  },
})

export const processGame = internalAction({
  args: {
    gameId: v.id('hockeyScheduleGames'),
    manual: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, { gameId, manual }) => {
    const lease = await ctx.runMutation(internal.hockeyResults.claim, {
      gameId,
      ...(manual ? { manual: true } : {}),
    })
    if (!lease) return null
    const sources: Array<Infer<typeof hockeyResultSource>> = [],
      issues: Array<string> = []
    let game: Infer<typeof hockeyGame> | undefined,
      players: Array<Infer<typeof hockeyPlayerResult>> | undefined
    try {
      const schedule = await fetchOfficial(hockeyScheduleUrl(lease.game.season))
      sources.push(schedule.source)
      game = parseHockeySchedule(
        schedule.html,
        lease.game.season,
        lease.game.sourceGameId,
      )
      if (game.status === 'final' && game.michiganScore !== null) {
        if (game.boxScoreUrl) {
          const box = await fetchOfficial(game.boxScoreUrl)
          sources.push(box.source)
          try {
            players = parseHockeyBox(box.html, game)
          } catch (error) {
            issues.push(
              error instanceof Error
                ? error.message
                : 'Box score parsing failed.',
            )
          }
        }
        if (game.recapUrl) {
          try {
            const recap = await fetchOfficial(game.recapUrl)
            sources.push(recap.source)
          } catch (error) {
            issues.push(
              error instanceof Error ? error.message : 'Recap fetch failed.',
            )
          }
        }
      }
    } catch (error) {
      issues.push(
        error instanceof Error
          ? error.message
          : 'Official source fetch failed.',
      )
    }
    await ctx.runMutation(internal.hockeyResults.finish, {
      gameId,
      token: lease.token,
      expectedGame: observation(lease.game),
      ...(game ? { game } : {}),
      ...(players ? { players } : {}),
      sources,
      issues,
    })
    return null
  },
})

export const review = query({
  args: { gameId: v.id('hockeyScheduleGames'), sessionToken: v.string() },
  returns: v.object({
    state: v.union(schema.doc('hockeyResultState'), v.null()),
    receipts: v.array(schema.doc('hockeyResultReceipts')),
  }),
  handler: async (ctx, { gameId, sessionToken }) => {
    await requireOwnerSession(ctx, sessionToken)
    return {
      state: await ctx.db
        .query('hockeyResultState')
        .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
        .unique(),
      receipts: await ctx.db
        .query('hockeyResultReceipts')
        .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
        .order('desc')
        .take(30),
    }
  },
})
