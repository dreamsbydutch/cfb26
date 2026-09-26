import type { LiveScore } from '../../../convex/scoreboardModel'

export type WatchGame = {
  _id: string
  homeSourceName: string
  awaySourceName: string
  landscapeRating: number
  startTime: number
  startTimeTbd?: boolean
  completed: boolean
  canceled?: boolean
  liveScore?: LiveScore
  liveScoreHistory?: Array<LiveScore>
  tvOutlets?: Array<string>
}

export type TvSlot = { id: string; networks: Array<string> }

// Four fixed positions: B main, B backup, C main, C backup. Keep a retained
// game first, then reuse a network, then fill openings by current watch rank.
export function stableTvSlots<T extends WatchGame>(
  ranked: Array<T>,
  previous: Array<TvSlot>,
) {
  const candidates = ranked.slice(1, 5)
  const slots: Array<T | undefined> = Array.from({ length: 4 })
  const used = new Set<string>()
  for (const matchNetwork of [false, true]) {
    for (let i = 0; i < 4; i++) {
      if (slots[i]) continue
      const prior = previous.at(i)
      if (!prior) continue
      const game = candidates.find(
        (candidate) =>
          !used.has(candidate._id) &&
          (matchNetwork
            ? (candidate.tvOutlets ?? []).some((network) =>
                prior.networks.includes(network.trim().toLowerCase()),
              )
            : candidate._id === prior.id),
      )
      if (game) {
        slots[i] = game
        used.add(game._id)
      }
    }
  }
  // Initially distribute #2/#5 to B and #3/#4 to C; subsequent rank changes
  // leave retained games/networks where they already are.
  for (const i of [0, 2, 3, 1]) {
    if (slots[i]) continue
    const game = candidates.find((candidate) => !used.has(candidate._id))
    if (game) {
      slots[i] = game
      used.add(game._id)
    }
  }
  return slots
}

export function tvSlotMemory(
  slots: Array<WatchGame | undefined>,
): Array<TvSlot> {
  return slots.map((game) => ({
    id: game?._id ?? '',
    networks: (game?.tvOutlets ?? []).map((network) =>
      network.trim().toLowerCase(),
    ),
  }))
}

export function stableTvPlan<T extends WatchGame>(
  ranked: Array<T>,
  previous: Array<TvSlot>,
  now?: number,
) {
  const first = ranked.at(0)
  const top = ranked
    .slice(0, 3)
    .filter(
      (game) =>
        now === undefined ||
        !first ||
        first.startTime > now ||
        game.startTime <= now,
    )
  const prior = previous.at(0)
  const main =
    first && isMichiganGame(first)
      ? first
      : (top.find((game) => game._id === prior?.id) ??
        top.find((game) =>
          (game.tvOutlets ?? []).some((network) =>
            prior?.networks.includes(network.trim().toLowerCase()),
          ),
        ) ??
        first)
  const others = ranked.filter((game) => game._id !== main?._id)
  const secondary = main
    ? stableTvSlots([main, ...others], previous.slice(2, 6))
    : []
  const backup = main && !isMichiganGame(main) ? others[4] : undefined
  return [main, backup, secondary[0], secondary[1], secondary[2], secondary[3]]
}

const MINUTE = 60_000
export const isMichiganGame = (game: WatchGame) =>
  game.homeSourceName === 'Michigan' || game.awaySourceName === 'Michigan'

// Use the reported clock only. Wall time is not game time (timeouts/reviews).
function remainingMinutes(score: LiveScore) {
  if (!score.period) return null
  if (score.period > 4) return 0
  const match = score.clock?.match(/^(\d{1,2}):(\d{2})$/)
  if (!match || Number(match[1]) > 15 || Number(match[2]) > 59) return null
  return (4 - score.period) * 15 + Number(match[1]) + Number(match[2]) / 60
}

export function watchRating(game: WatchGame, now: number) {
  const live = game.liveScore
  if (game.canceled || game.completed || live?.status === 'completed')
    return {
      score: 0,
      reason: 'Finished or canceled',
      state: 'excluded' as const,
    }
  if (game.startTimeTbd)
    return { score: 0, reason: 'Kickoff TBD', state: 'excluded' as const }
  const fresh =
    live?.status === 'in_progress' && now - live.updatedAt <= 15 * MINUTE
  if (!fresh) {
    if (game.startTime > now)
      return {
        score: game.landscapeRating,
        reason: 'Up next · Landscape rating',
        state: 'upcoming' as const,
      }
    if (now - game.startTime >= 8 * 60 * MINUTE)
      return { score: 0, reason: 'Result pending', state: 'excluded' as const }
    return {
      score: Math.max(1, game.landscapeRating - 20),
      reason:
        live?.status === 'in_progress'
          ? 'Score delayed · ranking provisional'
          : 'Awaiting live score',
      state: 'uncertain' as const,
    }
  }
  if (live.homePoints === null || live.awayPoints === null)
    return {
      score: game.landscapeRating,
      reason: 'Awaiting live score',
      state: 'uncertain' as const,
    }
  const homePoints = live.homePoints
  const awayPoints = live.awayPoints
  const margin = homePoints - awayPoints
  const gap = Math.abs(margin)
  const remaining = remainingMinutes(live)
  const overtime = (live.period ?? 0) > 4
  const late = live.period === 4 || overtime
  const urgency =
    remaining === null ? (late ? 0.75 : 0.2) : Math.max(0, 1 - remaining / 30)
  let adjustment =
    gap <= 8
      ? 5 + 35 * urgency
      : gap <= 16
        ? -5 + 10 * urgency
        : -(10 + gap - 16) * (1 + 2 * urgency)
  let reason =
    gap <= 8
      ? late
        ? 'One-score finish'
        : 'One-score game'
      : gap <= 16
        ? 'Two-score game'
        : 'Lopsided game'
  if (gap === 0) reason = late ? 'Tied late' : 'Tied game'
  if (overtime) {
    adjustment += 15
    reason = 'Overtime'
  }
  if (remaining !== null && remaining <= 5 && gap > 16) reason = 'Late blowout'

  // A formerly trailing team must actually score. Corrections to the leader's
  // score cannot manufacture a comeback. History expires after 30 wall minutes.
  const comeback = (game.liveScoreHistory ?? []).some((prior) => {
    if (
      prior.status !== 'in_progress' ||
      prior.homePoints === null ||
      prior.awayPoints === null ||
      prior.homePoints > homePoints ||
      prior.awayPoints > awayPoints ||
      prior.updatedAt < live.updatedAt - 30 * MINUTE ||
      prior.updatedAt >= live.updatedAt
    )
      return false
    const priorMargin = prior.homePoints - prior.awayPoints
    if (Math.abs(priorMargin) < 17) return false
    const homeTrailing = priorMargin < 0
    const gained = homeTrailing
      ? homePoints - prior.homePoints
      : awayPoints - prior.awayPoints
    const currentDeficit = homeTrailing ? -margin : margin
    return (
      gained >= 7 &&
      Math.abs(priorMargin) - currentDeficit >= 10 &&
      currentDeficit >= -8 &&
      currentDeficit <= 16
    )
  })
  if (comeback) {
    adjustment += 22
    reason = 'Comeback alert'
  }
  return {
    score: Math.round(
      Math.max(1, Math.min(99, game.landscapeRating + adjustment)),
    ),
    reason,
    state: 'live' as const,
  }
}

export function watchBoard<T extends WatchGame>(games: Array<T>, now: number) {
  const rated = games.map((game) => ({ game, ...watchRating(game, now) }))
  const compare = (a: (typeof rated)[number], b: (typeof rated)[number]) =>
    Number(isMichiganGame(b.game)) - Number(isMichiganGame(a.game)) ||
    Number(b.state === 'live') - Number(a.state === 'live') ||
    b.score - a.score ||
    b.game.landscapeRating - a.game.landscapeRating ||
    a.game.startTime - b.game.startTime ||
    a.game._id.localeCompare(b.game._id)
  const active = rated
    .filter((row) => row.state === 'live' || row.state === 'uncertain')
    .sort(compare)
  const upcoming = rated.filter((row) => row.state === 'upcoming')
  const nextKickoff = Math.min(...upcoming.map((row) => row.game.startTime))
  const next = upcoming
    .filter((row) => row.game.startTime <= nextKickoff + 30 * MINUTE)
    .sort(compare)
  const ranked = [...active, ...next]
  return {
    active,
    next,
    assignments: [
      { label: 'Main TV', main: ranked.at(0), backup: undefined },
      { label: 'TV B', main: ranked[1], backup: ranked[4] },
      { label: 'TV C', main: ranked[2], backup: ranked[3] },
    ],
  }
}
