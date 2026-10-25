import {
  normalizeHockeyGame,
  validateHockeyGames,
} from './hockeyScheduleFields'
import type { Infer } from 'convex/values'
import type { hockeyGame } from './hockeyScheduleFields'
import type { hockeyPlayerResult } from './hockeyResultFields'

type ObjectValue = Record<string, unknown>
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Official source structure is incomplete.')
  return value as ObjectValue
}
function array(value: unknown): Array<unknown> {
  if (!Array.isArray(value))
    throw new Error('Official source rows are missing.')
  return value
}
function text(value: unknown): string {
  if (typeof value !== 'string' && typeof value !== 'number')
    throw new Error('Official source field is missing.')
  return String(value)
}
function integer(value: unknown, signed = false): number {
  const raw = text(value)
  if (!(signed ? /^-?\d+$/ : /^\d+$/).test(raw))
    throw new Error('Official source statistic is not a whole number.')
  const result = Number(raw)
  if (!Number.isSafeInteger(result) || Math.abs(result) > 10000)
    throw new Error('Official source statistic is out of range.')
  return result
}

function goalieWin(value: unknown): number {
  const raw = text(value)
  if (raw === '0') return 0
  if (raw === '1' || /^\d+-\d+-\d+$/.test(raw)) return 1
  throw new Error('Unsupported official goalie decision.')
}

// Nuxt/devalue serializes objects as references into an indexed value array.
// Decode only the source subtree requested by the caller, never global widgets.
export function officialState(
  html: string,
  domain: 'schedule' | 'boxscore',
): ObjectValue {
  const match = html.match(
    /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  )
  if (!match) throw new Error('Official structured page data is unavailable.')
  const values = array(JSON.parse(match[1]))
  const cache = new Map<number, unknown>()
  function decode(index: number, depth = 0): unknown {
    if (depth > 100) throw new Error('Official source nesting is too deep.')
    if (index === -1) return null
    if (!Number.isInteger(index) || index < 0 || index >= values.length)
      throw new Error('Invalid official source reference.')
    if (cache.has(index)) return cache.get(index)
    const value = values[index]
    if (value === null || typeof value !== 'object') return value
    if (Array.isArray(value)) {
      if (typeof value[0] === 'string') {
        if (
          !['Reactive', 'ShallowReactive', 'Ref', 'ShallowRef'].includes(
            value[0],
          )
        )
          throw new Error('Unsupported official source encoding.')
        return decode(Number(value[1]), depth + 1)
      }
      const result: Array<unknown> = []
      cache.set(index, result)
      for (const item of value) result.push(decode(Number(item), depth + 1))
      return result
    }
    const result: ObjectValue = Object.create(null) as ObjectValue
    cache.set(index, result)
    for (const [key, item] of Object.entries(value))
      result[key] = decode(Number(item), depth + 1)
    return result
  }
  function unwrap(index: number): ObjectValue {
    const value = values[index]
    if (
      Array.isArray(value) &&
      ['Reactive', 'ShallowReactive'].includes(String(value[0]))
    )
      return unwrap(Number(value[1]))
    return object(value)
  }
  const root = unwrap(0)
  const pinia = unwrap(Number(root.pinia))
  return { [domain]: decode(Number(pinia[domain])) }
}

export function easternRunAt(now: number) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)!.value
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10)
  return {
    today,
    yesterday,
    hour: Number(part('hour')),
    season: Number(part('year')) - (Number(part('month')) < 7 ? 1 : 0),
  }
}

export function officialUrl(value: string) {
  const url = new URL(value, 'https://mgoblue.com')
  if (url.origin !== 'https://mgoblue.com' || url.username || url.password)
    throw new Error('Only official Michigan Athletics pages are supported.')
  return url.href
}

export function parseHockeySchedule(
  html: string,
  season: number,
  id: string,
): Infer<typeof hockeyGame> {
  const schedules = object(
    object(officialState(html, 'schedule').schedule).schedules,
  )
  const schedule = object(
    schedules[
      `schedules-mens-ice-hockey,${season}-${String(season + 1).slice(-2)}`
    ],
  )
  const matches = array(schedule.games)
    .map(object)
    .filter((g) => String(g.id) === id)
  if (matches.length !== 1)
    throw new Error('Official game identity is missing or duplicated.')
  const raw = matches[0]
  const result = raw.result ? object(raw.result) : {}
  const opponent = object(raw.opponent)
  const note = [raw.noplay_text, result.prescore_info, result.postscore_info]
    .filter(Boolean)
    .join(' ')
  const statusText = `${raw.game_state_display} ${note}`.toLowerCase()
  const resultCode = result.status
  const hasResult = ['W', 'L', 'T'].includes(String(resultCode))
  const status = /cancel/.test(statusText)
    ? 'cancelled'
    : /postpon/.test(statusText)
      ? 'postponed'
      : /no.contest/.test(statusText)
        ? 'no_contest'
        : hasResult
          ? 'final'
          : 'scheduled'
  const link = (value: unknown) =>
    value ? officialUrl(text(object(value).url)) : null
  const game: Infer<typeof hockeyGame> = normalizeHockeyGame({
    sourceGameId: id,
    date: text(raw.date).slice(0, 10),
    endDate: raw.enddate ? text(raw.enddate).slice(0, 10) : null,
    time: text(raw.time ?? ''),
    opponentId: text(opponent.id),
    opponent: text(opponent.title),
    opponentPrefix: '',
    location: text(raw.location ?? ''),
    venue:
      raw.location_indicator === 'H'
        ? 'home'
        : raw.location_indicator === 'A'
          ? 'away'
          : raw.location_indicator === 'N'
            ? 'neutral'
            : 'unknown',
    exhibition: raw.type === 'E',
    conference: raw.conference === true,
    status,
    result: status === 'final' ? (resultCode as 'W' | 'L' | 'T') : null,
    michiganScore: status === 'final' ? integer(result.team_score) : null,
    opponentScore: status === 'final' ? integer(result.opponent_score) : null,
    note,
    tournament: raw.tournament ? text(object(raw.tournament).title) : '',
    recapUrl: link(result.recap),
    boxScoreUrl: link(result.boxscore),
  })
  validateHockeyGames(season, [game])
  return game
}

export function normalizedHockeyName(value: string) {
  return value
    .replace(/&eacute;/g, 'é')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

export function parseHockeyBox(
  html: string,
  game: Infer<typeof hockeyGame>,
): Array<Infer<typeof hockeyPlayerResult>> {
  const boxes = Object.values(
    object(object(officialState(html, 'boxscore').boxscore).boxscore),
  )
  if (boxes.length !== 1)
    throw new Error('Expected one official hockey box score.')
  const box = object(boxes[0])
  const [month, day, year] = text(box.gameDate).split('/')
  if (`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` !== game.date)
    throw new Error('Box score date does not match the saved game.')
  const home = object(box.homeTeam),
    away = object(box.visitingTeam)
  const team =
    home.name === 'Michigan' ? home : away.name === 'Michigan' ? away : null
  if (
    !team ||
    integer(box.thisTeamScore) !== game.michiganScore ||
    integer(box.opponentTeamScore) !== game.opponentScore
  )
    throw new Error(
      'Box score teams or final scores disagree with the schedule.',
    )
  const sourcePlayers = array(team.players).map(object)
  const isTeam = (p: ObjectValue) =>
    p.name === 'TEAM' &&
    p.uniform === 'TM' &&
    p.rosterPlayerId === null &&
    p.playerFirstLastName === null
  const teamGoalies = sourcePlayers
    .filter(isTeam)
    .flatMap((p) => (p.goalieStats ? [object(p.goalieStats)] : []))
  const rows = sourcePlayers
    .filter((p) => !isTeam(p))
    .map((p) => {
      const shots = object(p.shotStats),
        misc = object(p.miscStats)
      const played = integer(p.gamePlayed),
        started = integer(p.gameStarted)
      if (played > 1 || started > played)
        throw new Error('Invalid player participation.')
      const g = p.goalieStats ? object(p.goalieStats) : null
      return {
        sourcePlayerId: text(p.rosterPlayerId),
        name: text(p.playerFirstLastName),
        jersey: text(p.uniform),
        played: played === 1,
        started: started === 1,
        goals: integer(shots.goals),
        assists: integer(shots.assists),
        shots: integer(shots.shots),
        penaltyMinutes: integer(object(p.penaltyStats).minutes),
        plusMinus: integer(misc.plusMinus, true),
        blockedShots: integer(misc.blocked),
        goalie: g
          ? {
              seconds: integer(g.seconds),
              saves: integer(g.saves),
              goalsAgainst: integer(g.goalsAllowed),
              // Sidearm uses the cumulative W-L-T record to mark this game's winner.
              wins: goalieWin(g.win),
              shutouts: integer(g.shutouts),
            }
          : null,
      }
    })
  validateHockeyPlayerResults(rows, game.michiganScore)
  const totals = object(team.totals),
    shotTotals = object(totals.shotStats),
    goalieTotals = object(totals.goalieStats)
  for (const [key, expected] of [
    ['goals', integer(shotTotals.goals)],
    ['assists', integer(shotTotals.assists)],
    ['shots', integer(shotTotals.shots)],
  ] as const)
    if (rows.reduce((n, row) => n + row[key], 0) !== expected)
      throw new Error(`Player ${key} do not match official totals.`)
  for (const [key, source] of [
    ['seconds', 'seconds'],
    ['saves', 'saves'],
    ['goalsAgainst', 'goalsAllowed'],
  ] as const)
    if (
      rows.reduce((n, row) => n + (row.goalie?.[key] ?? 0), 0) +
        teamGoalies.reduce((n, row) => n + integer(row[source]), 0) !==
      integer(goalieTotals[source])
    )
      throw new Error(`Goalie ${key} do not match official totals.`)
  const opponent = team === home ? away : home
  if (
    integer(goalieTotals.goalsAllowed) > game.opponentScore ||
    integer(goalieTotals.saves) + game.opponentScore !==
      integer(object(opponent.scoringSummary).shots)
  )
    throw new Error(
      'Goalie totals do not reconcile with opponent scoring and shots.',
    )
  return rows
}

export function validateHockeyPlayerResults(
  rows: Array<Infer<typeof hockeyPlayerResult>>,
  goals: number,
) {
  if (rows.length < 6 || rows.length > 40)
    throw new Error('Incomplete hockey player list.')
  const ids = new Set<string>()
  for (const row of rows) {
    if (
      !/^\d+$/.test(row.sourcePlayerId) ||
      ids.has(row.sourcePlayerId) ||
      !row.name.trim()
    )
      throw new Error('Missing or duplicated official player identity.')
    ids.add(row.sourcePlayerId)
    for (const key of [
      'goals',
      'assists',
      'shots',
      'penaltyMinutes',
      'blockedShots',
    ] as const)
      integer(row[key])
    integer(row.plusMinus, true)
    if (row.goalie)
      for (const value of Object.values(row.goalie)) integer(value)
    if (
      row.goalie &&
      ((row.goalie.wins ?? 0) > 1 || (row.goalie.shutouts ?? 0) > 1)
    )
      throw new Error('Invalid single-game goalie decision.')
    if (
      (row.started && !row.played) ||
      row.goals > row.shots ||
      (!row.played &&
        row.goals +
          row.assists +
          row.shots +
          row.penaltyMinutes +
          row.blockedShots +
          Math.abs(row.plusMinus) +
          (row.goalie?.seconds ?? 0) +
          (row.goalie?.saves ?? 0) +
          (row.goalie?.goalsAgainst ?? 0) >
          0)
    )
      throw new Error('Player participation contradicts statistics.')
  }
  if (
    rows.reduce((n, p) => n + p.goals, 0) !== goals ||
    rows.reduce((n, p) => n + p.assists, 0) > goals * 2
  )
    throw new Error('Player scoring totals disagree with the final score.')
}
