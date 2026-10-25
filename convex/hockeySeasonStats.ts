import type { Doc } from './_generated/dataModel'
import type { QueryCtx } from './_generated/server'

// Never add game totals to an annual snapshot: its coverage is unknown.
// Use a complete chronological run of counted games, never isolated new games.
export async function hockeySeasonStats(
  ctx: QueryCtx,
  season: number,
  entries: Array<Doc<'teamRosterEntries'>>,
): Promise<Array<Doc<'teamRosterEntries'>>> {
  const schedule = await ctx.db
    .query('hockeyScheduleGames')
    .withIndex('by_season', (q) => q.eq('season', season))
    .take(81)
  if (schedule.length > 80) return entries
  const finals = schedule
    .filter((g) => g.status === 'final' && !g.exhibition)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.sourceGameId.localeCompare(b.sourceGameId),
    )
  if (!finals.length) return entries
  const games = await Promise.all(
    finals.map(async (game) => ({
      game,
      rows: await ctx.db
        .query('hockeyPlayerGames')
        .withIndex('by_gameId', (q) => q.eq('gameId', game._id))
        .take(41),
    })),
  )
  const ids = new Set(entries.map((entry) => entry._id))
  const missing = games.findIndex(
    ({ rows }) =>
      rows.length < 6 ||
      rows.length > 40 ||
      rows.some((row) => !ids.has(row.playerId)) ||
      new Set(rows.map((row) => row.playerId)).size !== rows.length,
  )
  // A delayed latest box must not roll a seven-game display back to a saved
  // six-game annual snapshot. Keep the complete chronological prefix.
  const covered = missing < 0 ? games : games.slice(0, missing)
  if (!covered.length) return entries
  const baselineGames = Math.max(
    0,
    ...entries.map((entry) => Number(entry.values.games) || 0),
  )
  if (missing >= 0 && covered.length < baselineGames) return entries
  return entries.map((entry) => {
    const rows = covered.flatMap(({ rows: gameRows }) =>
      gameRows.filter((row) => row.playerId === entry._id),
    )
    const sum = (key: 'goals' | 'assists' | 'shots' | 'penaltyMinutes') =>
      rows.reduce((n, row) => n + row[key], 0)
    const goalie = entry.values.position === 'G'
    const goalieSum = (key: 'seconds' | 'saves' | 'goalsAgainst') =>
      rows.reduce((n, row) => n + (row.goalie?.[key] ?? 0), 0)
    const decisions = (key: 'wins' | 'shutouts') =>
      rows.every((row) => !row.goalie || row.goalie[key] !== undefined)
        ? rows.reduce((n, row) => n + (row.goalie?.[key] ?? 0), 0)
        : null
    return {
      ...entry,
      values: {
        ...entry.values,
        games: rows.filter((row) => row.played).length,
        starts: rows.filter((row) => row.started).length,
        goals: sum('goals'),
        assists: sum('assists'),
        shots: sum('shots'),
        pim: sum('penaltyMinutes'),
        goalieMinutes: goalie ? goalieSum('seconds') / 60 : null,
        saves: goalie ? goalieSum('saves') : null,
        goalsAgainst: goalie ? goalieSum('goalsAgainst') : null,
        wins: goalie ? decisions('wins') : null,
        shutouts: goalie ? decisions('shutouts') : null,
      },
    }
  })
}
