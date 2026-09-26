export const SCOREBOARD_INTERVAL = 5 * 60_000
export const SCOREBOARD_WINDOW = 8 * 60 * 60_000
export const SCOREBOARD_MONTHLY_LIMIT = 1500
export const SCOREBOARD_DAILY_LIMIT = 250
export const SCOREBOARD_RESERVE = 500
export const SCOREBOARD_INFO_INTERVAL = 60 * 60_000

export type LiveScore = {
  status: 'scheduled' | 'in_progress' | 'completed'
  homePoints: number | null
  awayPoints: number | null
  period: number | null
  clock: string | null
  updatedAt: number
}

export type ScoreboardRow = Omit<LiveScore, 'updatedAt'> & {
  id: number
  homeId: number
  awayId: number
}

// Bounded recent observations enable comeback detection without extra API calls.
export function scoreHistory(
  history: Array<LiveScore> | undefined,
  previous: LiveScore | undefined,
  now: number,
) {
  return [...(history ?? []), ...(previous ? [previous] : [])]
    .filter(
      (score) =>
        score.status === 'in_progress' &&
        score.updatedAt >= now - 30 * 60_000 &&
        score.updatedAt < now,
    )
    .slice(-6)
}

function object(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid scoreboard object')
  return value as Record<string, unknown>
}

function integer(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new Error('Invalid scoreboard number')
  return value
}

export function parseScoreboard(value: unknown): Array<ScoreboardRow> {
  if (!Array.isArray(value) || value.length > 250)
    throw new Error('Invalid scoreboard response size')
  const ids = new Set<number>()
  return value.map((item) => {
    const row = object(item)
    const home = object(row.homeTeam)
    const away = object(row.awayTeam)
    const id = integer(row.id)
    if (ids.has(id)) throw new Error('Duplicate scoreboard game')
    ids.add(id)
    const status = row.status
    if (
      status !== 'scheduled' &&
      status !== 'in_progress' &&
      status !== 'completed'
    )
      throw new Error('Unknown scoreboard status')
    const homePoints = home.points == null ? null : integer(home.points)
    const awayPoints = away.points == null ? null : integer(away.points)
    if (status !== 'scheduled' && (homePoints === null || awayPoints === null))
      throw new Error('Scoreboard game has no score')
    if (
      row.clock != null &&
      (typeof row.clock !== 'string' || row.clock.length > 40)
    )
      throw new Error('Invalid scoreboard clock')
    return {
      id,
      homeId: integer(home.id),
      awayId: integer(away.id),
      status,
      homePoints,
      awayPoints,
      period: row.period == null ? null : integer(row.period),
      clock: typeof row.clock === 'string' ? row.clock : null,
    }
  })
}

export function parseScoreboardAllowance(value: unknown) {
  const row = object(value)
  const features = object(row.features)
  if (typeof features.scoreboard !== 'boolean')
    throw new Error('Missing scoreboard access')
  const remainingCalls = integer(row.remainingCalls)
  const resetAt =
    typeof row.resetAt === 'string' ? Date.parse(row.resetAt) : NaN
  if (!Number.isFinite(resetAt)) throw new Error('Invalid quota reset')
  return { enabled: features.scoreboard, remainingCalls, resetAt }
}

export function needsScoreboard(
  game: {
    startTime: number
    startTimeTbd?: boolean
    completed: boolean
    canceled?: boolean
    liveScore?: LiveScore
  },
  now: number,
) {
  return (
    !game.completed &&
    !game.canceled &&
    !game.startTimeTbd &&
    game.liveScore?.status !== 'completed' &&
    game.startTime <= now + 10 * 60_000 &&
    game.startTime >= now - SCOREBOARD_WINDOW
  )
}

export function acceptLiveScore(
  game: {
    homeSourceId: number
    awaySourceId: number
    completed: boolean
    canceled?: boolean
    liveScore?: LiveScore
  },
  row: ScoreboardRow,
  updatedAt: number,
) {
  if (
    game.completed ||
    game.canceled ||
    row.homeId !== game.homeSourceId ||
    row.awayId !== game.awaySourceId
  )
    return false
  if (
    game.liveScore &&
    (game.liveScore.updatedAt >= updatedAt ||
      (game.liveScore.status === 'completed' && row.status !== 'completed') ||
      (game.liveScore.status === 'in_progress' && row.status === 'scheduled'))
  )
    return false
  return true
}

export function scoreboardBudget(
  state: {
    month: string
    day: string
    monthRequests: number
    dayRequests: number
    nextPollAt: number
    allowanceCheckedAt?: number
  } | null,
  now: number,
) {
  const day = new Date(now).toISOString().slice(0, 10)
  const month = day.slice(0, 7)
  const checkAllowance =
    !state?.allowanceCheckedAt ||
    now - state.allowanceCheckedAt >= SCOREBOARD_INFO_INTERVAL ||
    state.month !== month
  // Reserve before fetch, including failures. An unused reservation is conservative.
  const requests = checkAllowance ? 2 : 1
  const monthRequests =
    (state?.month === month ? state.monthRequests : 0) + requests
  const dayRequests = (state?.day === day ? state.dayRequests : 0) + requests
  return {
    allowed:
      (!state || now >= state.nextPollAt) &&
      monthRequests <= SCOREBOARD_MONTHLY_LIMIT &&
      dayRequests <= SCOREBOARD_DAILY_LIMIT,
    checkAllowance,
    month,
    day,
    monthRequests,
    dayRequests,
  }
}

export function scoreboardBackoff(
  status: number | undefined,
  failures: number,
) {
  if (status === 401 || status === 403) return 24 * 60 * 60_000
  if (status === 429) return 60 * 60_000
  return Math.min(60 * 60_000, SCOREBOARD_INTERVAL * 2 ** Math.min(failures, 4))
}
