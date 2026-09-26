import type { WatchGame } from './watchRating'

export type ScoreboardGame = WatchGame & {
  homePoints?: number
  awayPoints?: number
  homeRank?: number
  awayRank?: number
}

export function scoreboardStatus(game: ScoreboardGame, now: number) {
  const live = game.liveScore
  const scores = game.completed
    ? { home: game.homePoints, away: game.awayPoints }
    : live && live.status !== 'scheduled'
      ? { home: live.homePoints, away: live.awayPoints }
      : { home: null, away: null }
  if (game.canceled) return { ...scores, kind: 'past', label: 'Canceled' }
  if (game.completed || live?.status === 'completed') {
    return {
      ...scores,
      kind: 'final',
      label:
        scores.home != null && scores.away != null ? 'Final' : 'Result pending',
    }
  }
  if (live?.status === 'in_progress') {
    const delayed = now - live.updatedAt > 15 * 60_000
    const period = live.period
      ? live.period > 4
        ? `${live.period - 4 > 1 ? live.period - 4 : ''}OT`
        : `Q${live.period}`
      : 'Live'
    return {
      ...scores,
      kind:
        delayed && now - game.startTime >= 8 * 60 * 60_000 ? 'past' : 'live',
      label: `${period}${live.clock ? ` · ${live.clock}` : ''}`,
    }
  }
  if (game.startTimeTbd)
    return { ...scores, kind: 'upcoming', label: 'Time TBD' }
  if (game.startTime > now) {
    return {
      ...scores,
      kind: 'upcoming',
      label: new Date(game.startTime).toLocaleString([], {
        weekday: 'short',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    }
  }
  return {
    ...scores,
    kind: now - game.startTime < 8 * 60 * 60_000 ? 'live' : 'past',
    label: 'Awaiting score',
  }
}

export function otherScoreboardGames<T extends ScoreboardGame>(
  games: Array<T>,
  assignedIds: Set<string>,
  now: number,
) {
  const remaining = games.filter(
    (game) => !assignedIds.has(game._id) && !game.canceled,
  )
  const live: Array<T> = []
  const finals: Array<T> = []
  const upcoming: Array<T> = []
  for (const game of remaining) {
    const status = scoreboardStatus(game, now)
    if (status.kind === 'live') live.push(game)
    if (status.kind === 'final' && game.startTime >= now - 24 * 60 * 60_000)
      finals.push(game)
    if (status.kind === 'upcoming') upcoming.push(game)
  }
  live.sort(
    (a, b) =>
      b.landscapeRating - a.landscapeRating || a.startTime - b.startTime,
  )
  finals.sort((a, b) => b.startTime - a.startTime)
  upcoming.sort(
    (a, b) =>
      Number(!!a.startTimeTbd) - Number(!!b.startTimeTbd) ||
      a.startTime - b.startTime,
  )
  return [
    { title: 'Other live games', games: live },
    { title: 'Recent results', games: finals },
    { title: 'Coming up', games: upcoming },
  ].filter((group) => group.games.length)
}
