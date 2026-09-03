export const CFBD_BASE_URL = 'https://api.collegefootballdata.com'

export type CfbdClassification = 'fbs' | 'fcs'
export type CfbdSeasonType = 'both' | 'postseason' | 'regular'
export type CfbdRow = Record<string, unknown>

export type CfbdGame = CfbdRow & {
  awayClassification: string
  awayId: number
  awayPoints: number | null
  awayTeam: string
  completed: boolean
  homeClassification: string
  homeId: number
  homePoints: number | null
  homeTeam: string
  id: number
  neutralSite: boolean
  season: number
  seasonType: string
  startDate: string
  week: number
}

export type CfbdTeamGameStatsTeam = CfbdRow & {
  homeAway: 'away' | 'home'
  points: number | null
  stats: Array<{ category: string; stat: string }>
  team: string
  teamId: number
}

export type CfbdTeamGameStats = CfbdRow & {
  id: number
  teams: [CfbdTeamGameStatsTeam, CfbdTeamGameStatsTeam]
}

export type CfbdFbsTeam = CfbdRow & { id: number; school: string }
export type CfbdSeasonStat = CfbdRow & {
  season: number
  statName: string
  statValue: number | string
  team: string
}
export type CfbdAdvancedSeasonStat = CfbdRow & {
  defense: CfbdRow
  offense: CfbdRow
  season: number
  team: string
}
export type CfbdRecruitingTeam = CfbdRow & {
  points: number
  rank: number
  team: string
  year: number
}
export type CfbdTalent = CfbdRow & {
  talent: number
  team: string
  year: number
}
export type CfbdReturningProduction = CfbdRow & {
  percentPPA: number
  season: number
  team: string
  usage: number
}
export type CfbdTransfer = CfbdRow & {
  destination: string | null
  firstName: string
  lastName: string
  origin: string
  position: string
  season: number
}
export type CfbdCoachTenure = CfbdRow & {
  active: boolean
  coach: CfbdRow
  id: number
  startYear: number
  team: CfbdRow
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>

export type CfbdClientOptions = {
  apiKey: string
  baseUrl?: string
  fetchImpl?: FetchLike
  maxAttempts?: number
  sleep?: (milliseconds: number) => Promise<void>
}

export type GetGamesArgs = {
  classification: CfbdClassification
  season: number
  seasonType: CfbdSeasonType
  signal?: AbortSignal
  week?: number
}

export type GetTeamGameStatsArgs = GetGamesArgs & { week: number }
export type GetSeasonStatsArgs = {
  classification: CfbdClassification
  endWeek: number
  season: number
  signal?: AbortSignal
}
export type GetSeasonArgs = { season: number; signal?: AbortSignal }

export type CfbdClient = {
  getAdvancedSeasonStats: (
    args: GetSeasonStatsArgs,
  ) => Promise<Array<CfbdAdvancedSeasonStat>>
  getCoachTenures: (args: GetSeasonArgs) => Promise<Array<CfbdCoachTenure>>
  getFbsTeams: (args: GetSeasonArgs) => Promise<Array<CfbdFbsTeam>>
  getGames: (args: GetGamesArgs) => Promise<Array<CfbdGame>>
  getRecruitingTeams: (
    args: GetSeasonArgs,
  ) => Promise<Array<CfbdRecruitingTeam>>
  getReturningProduction: (
    args: GetSeasonArgs,
  ) => Promise<Array<CfbdReturningProduction>>
  getSeasonStats: (args: GetSeasonStatsArgs) => Promise<Array<CfbdSeasonStat>>
  getTalent: (args: GetSeasonArgs) => Promise<Array<CfbdTalent>>
  getTeamGameStats: (
    args: GetTeamGameStatsArgs,
  ) => Promise<Array<CfbdTeamGameStats>>
  getTransfers: (args: GetSeasonArgs) => Promise<Array<CfbdTransfer>>
}

export type CfbdClientErrorKind =
  | 'authentication'
  | 'contract'
  | 'http'
  | 'invalid_json'
  | 'network'
  | 'rate_limit'
  | 'server'

export class CfbdClientError extends Error {
  endpoint: string
  kind: CfbdClientErrorKind
  retryable: boolean
  status?: number

  constructor(args: {
    endpoint: string
    kind: CfbdClientErrorKind
    message: string
    retryable: boolean
    status?: number
  }) {
    super(args.message)
    this.name = 'CfbdClientError'
    this.endpoint = args.endpoint
    this.kind = args.kind
    this.retryable = args.retryable
    this.status = args.status
  }
}

function responseError(endpoint: string, status: number) {
  if (status === 401 || status === 403) {
    return new CfbdClientError({
      endpoint,
      kind: 'authentication',
      message: `CFBD ${endpoint} rejected the configured credentials.`,
      retryable: false,
      status,
    })
  }
  if (status === 429) {
    return new CfbdClientError({
      endpoint,
      kind: 'rate_limit',
      message: `CFBD ${endpoint} exceeded the current request limit.`,
      retryable: true,
      status,
    })
  }
  if (status >= 500) {
    return new CfbdClientError({
      endpoint,
      kind: 'server',
      message: `CFBD ${endpoint} failed with HTTP ${status}.`,
      retryable: true,
      status,
    })
  }
  return new CfbdClientError({
    endpoint,
    kind: 'http',
    message: `CFBD ${endpoint} failed with HTTP ${status}.`,
    retryable: false,
    status,
  })
}

function isRow(value: unknown): value is CfbdRow {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function contractError(endpoint: string, detail: string) {
  return new CfbdClientError({
    endpoint,
    kind: 'contract',
    message: `CFBD ${endpoint} contract violation: ${detail}.`,
    retryable: false,
  })
}

function requiredBoolean(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (typeof value !== 'boolean') {
    throw contractError(endpoint, `invalid ${field}`)
  }
  return value
}

function requiredNumber(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw contractError(endpoint, `invalid ${field}`)
  }
  return value
}

function optionalNumber(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw contractError(endpoint, `invalid ${field}`)
  }
  return value
}

function nullableString(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw contractError(endpoint, `invalid ${field}`)
  }
  return value
}

function requiredString(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw contractError(endpoint, `invalid ${field}`)
  }
  return value
}

function parseGame(value: unknown): CfbdGame {
  const endpoint = '/games'
  if (!isRow(value)) {
    throw contractError(endpoint, 'non-object row')
  }
  return {
    ...value,
    awayClassification: requiredString(value, 'awayClassification', endpoint),
    awayId: requiredNumber(value, 'awayId', endpoint),
    awayPoints: optionalNumber(value, 'awayPoints', endpoint),
    awayTeam: requiredString(value, 'awayTeam', endpoint),
    completed: requiredBoolean(value, 'completed', endpoint),
    homeClassification: requiredString(value, 'homeClassification', endpoint),
    homeId: requiredNumber(value, 'homeId', endpoint),
    homePoints: optionalNumber(value, 'homePoints', endpoint),
    homeTeam: requiredString(value, 'homeTeam', endpoint),
    id: requiredNumber(value, 'id', endpoint),
    neutralSite: requiredBoolean(value, 'neutralSite', endpoint),
    season: requiredNumber(value, 'season', endpoint),
    seasonType: requiredString(value, 'seasonType', endpoint),
    startDate: requiredString(value, 'startDate', endpoint),
    week: requiredNumber(value, 'week', endpoint),
  }
}

function parseTeamGameStatsTeam(
  value: unknown,
  endpoint: string,
): CfbdTeamGameStatsTeam {
  if (!isRow(value)) throw contractError(endpoint, 'non-object team row')
  const rawHomeAway = requiredString(value, 'homeAway', endpoint)
  if (rawHomeAway !== 'home' && rawHomeAway !== 'away') {
    throw contractError(endpoint, 'invalid homeAway')
  }
  if (!Array.isArray(value.stats)) {
    throw contractError(endpoint, 'invalid stats')
  }
  const stats = value.stats.map((stat) => {
    if (!isRow(stat)) throw contractError(endpoint, 'non-object stat row')
    return {
      category: requiredString(stat, 'category', endpoint),
      stat: requiredString(stat, 'stat', endpoint),
    }
  })
  return {
    ...value,
    homeAway: rawHomeAway,
    points: optionalNumber(value, 'points', endpoint),
    stats,
    team: requiredString(value, 'team', endpoint),
    teamId: requiredNumber(value, 'teamId', endpoint),
  }
}

function parseTeamGameStats(value: unknown): CfbdTeamGameStats {
  const endpoint = '/games/teams'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  if (!Array.isArray(value.teams) || value.teams.length !== 2) {
    throw contractError(endpoint, 'game does not contain exactly two teams')
  }
  return {
    ...value,
    id: requiredNumber(value, 'id', endpoint),
    teams: [
      parseTeamGameStatsTeam(value.teams[0], endpoint),
      parseTeamGameStatsTeam(value.teams[1], endpoint),
    ],
  }
}

function requiredRow(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (!isRow(value)) throw contractError(endpoint, `invalid ${field}`)
  return value
}

function parseFbsTeam(value: unknown): CfbdFbsTeam {
  const endpoint = '/teams/fbs'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    id: requiredNumber(value, 'id', endpoint),
    school: requiredString(value, 'school', endpoint),
  }
}

function parseSeasonStat(value: unknown): CfbdSeasonStat {
  const endpoint = '/stats/season'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  const statValue = value.statValue
  if (typeof statValue !== 'string' && typeof statValue !== 'number') {
    throw contractError(endpoint, 'invalid statValue')
  }
  return {
    ...value,
    season: requiredNumber(value, 'season', endpoint),
    statName: requiredString(value, 'statName', endpoint),
    statValue,
    team: requiredString(value, 'team', endpoint),
  }
}

function parseAdvancedSeasonStat(value: unknown): CfbdAdvancedSeasonStat {
  const endpoint = '/stats/season/advanced'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    defense: requiredRow(value, 'defense', endpoint),
    offense: requiredRow(value, 'offense', endpoint),
    season: requiredNumber(value, 'season', endpoint),
    team: requiredString(value, 'team', endpoint),
  }
}

function parseRecruitingTeam(value: unknown): CfbdRecruitingTeam {
  const endpoint = '/recruiting/teams'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    points: requiredNumber(value, 'points', endpoint),
    rank: requiredNumber(value, 'rank', endpoint),
    team: requiredString(value, 'team', endpoint),
    year: requiredNumber(value, 'year', endpoint),
  }
}

function parseTalent(value: unknown): CfbdTalent {
  const endpoint = '/talent'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    talent: requiredNumber(value, 'talent', endpoint),
    team: requiredString(value, 'team', endpoint),
    year: requiredNumber(value, 'year', endpoint),
  }
}

function parseReturningProduction(value: unknown): CfbdReturningProduction {
  const endpoint = '/player/returning'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    percentPPA: requiredNumber(value, 'percentPPA', endpoint),
    season: requiredNumber(value, 'season', endpoint),
    team: requiredString(value, 'team', endpoint),
    usage: requiredNumber(value, 'usage', endpoint),
  }
}

function parseTransfer(value: unknown): CfbdTransfer {
  const endpoint = '/player/portal'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    destination: nullableString(value, 'destination', endpoint),
    firstName: requiredString(value, 'firstName', endpoint),
    lastName: requiredString(value, 'lastName', endpoint),
    origin: requiredString(value, 'origin', endpoint),
    position: requiredString(value, 'position', endpoint),
    season: requiredNumber(value, 'season', endpoint),
  }
}

function parseCoachTenure(value: unknown): CfbdCoachTenure {
  const endpoint = '/coaches/tenures'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    active: requiredBoolean(value, 'active', endpoint),
    coach: requiredRow(value, 'coach', endpoint),
    id: requiredNumber(value, 'id', endpoint),
    startYear: requiredNumber(value, 'startYear', endpoint),
    team: requiredRow(value, 'team', endpoint),
  }
}

function rows(value: unknown, endpoint: string) {
  if (!Array.isArray(value)) {
    throw contractError(endpoint, 'non-array JSON document')
  }
  return value
}

export function createCfbdClient(options: CfbdClientOptions): CfbdClient {
  const baseUrl = options.baseUrl ?? CFBD_BASE_URL
  const fetchImpl = options.fetchImpl ?? fetch
  const maxAttempts = Math.max(1, Math.floor(options.maxAttempts ?? 3))
  const sleep =
    options.sleep ??
    ((milliseconds: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, milliseconds)))

  async function requestRows(
    endpoint: string,
    signal: AbortSignal | undefined,
  ) {
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response: Response
      try {
        response = await fetchImpl(`${baseUrl}${endpoint}`, {
          headers: { Authorization: `Bearer ${options.apiKey}` },
          signal,
        })
      } catch (error) {
        if (attempt < maxAttempts) {
          await sleep(250 * 2 ** (attempt - 1))
          continue
        }
        throw new CfbdClientError({
          endpoint,
          kind: 'network',
          message: `CFBD ${endpoint} could not be reached.`,
          retryable: true,
        })
      }
      if (!response.ok) {
        const error = responseError(endpoint, response.status)
        if (error.retryable && attempt < maxAttempts) {
          await sleep(250 * 2 ** (attempt - 1))
          continue
        }
        throw error
      }
      const contentType = response.headers.get('content-type')?.toLowerCase()
      if (!contentType?.includes('json')) {
        throw new CfbdClientError({
          endpoint,
          kind: 'invalid_json',
          message: `CFBD ${endpoint} returned a non-JSON content type.`,
          retryable: false,
        })
      }
      let body: unknown
      try {
        body = await response.json()
      } catch {
        throw new CfbdClientError({
          endpoint,
          kind: 'invalid_json',
          message: `CFBD ${endpoint} returned invalid JSON.`,
          retryable: false,
        })
      }
      return rows(body, endpoint)
    }
    throw new Error('Unreachable CFBD request state.')
  }

  return {
    async getAdvancedSeasonStats(args) {
      const query = new URLSearchParams({
        year: String(args.season),
        endWeek: String(args.endWeek),
        excludeGarbageTime: 'true',
        classification: args.classification,
      })
      return (
        await requestRows(
          `/stats/season/advanced?${query.toString()}`,
          args.signal,
        )
      ).map(parseAdvancedSeasonStat)
    },
    async getCoachTenures(args) {
      return (
        await requestRows(`/coaches/tenures?year=${args.season}`, args.signal)
      ).map(parseCoachTenure)
    },
    async getFbsTeams(args) {
      return (
        await requestRows(`/teams/fbs?year=${args.season}`, args.signal)
      ).map(parseFbsTeam)
    },
    async getGames(args) {
      const query = new URLSearchParams({
        year: String(args.season),
      })
      if (args.week !== undefined) query.set('week', String(args.week))
      query.set('seasonType', args.seasonType)
      query.set('classification', args.classification)
      const endpoint = `/games?${query.toString()}`
      return (await requestRows(endpoint, args.signal)).map(parseGame)
    },
    async getRecruitingTeams(args) {
      return (
        await requestRows(`/recruiting/teams?year=${args.season}`, args.signal)
      ).map(parseRecruitingTeam)
    },
    async getReturningProduction(args) {
      return (
        await requestRows(`/player/returning?year=${args.season}`, args.signal)
      ).map(parseReturningProduction)
    },
    async getSeasonStats(args) {
      const query = new URLSearchParams({
        year: String(args.season),
        endWeek: String(args.endWeek),
        classification: args.classification,
      })
      return (
        await requestRows(`/stats/season?${query.toString()}`, args.signal)
      ).map(parseSeasonStat)
    },
    async getTalent(args) {
      return (
        await requestRows(`/talent?year=${args.season}`, args.signal)
      ).map(parseTalent)
    },
    async getTeamGameStats(args) {
      const query = new URLSearchParams({
        year: String(args.season),
        week: String(args.week),
        seasonType: args.seasonType,
        classification: args.classification,
      })
      const endpoint = `/games/teams?${query.toString()}`
      return (await requestRows(endpoint, args.signal)).map(parseTeamGameStats)
    },
    async getTransfers(args) {
      return (
        await requestRows(`/player/portal?year=${args.season}`, args.signal)
      ).map(parseTransfer)
    },
  }
}
