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
export type CfbdVenue = CfbdRow & { id: number; name: string }
export type CfbdDraftPick = CfbdRow & {
  collegeTeam: string
  nflTeam: string
  overall: number
  pick: number
  playerName: string
  position: string
  round: number
  year: number
}
export type CfbdRankingWeek = CfbdRow & {
  polls: Array<CfbdRow>
  season: number
  week: number
}
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
export type CfbdAdvancedGameStat = CfbdAdvancedSeasonStat & {
  gameId: number
  opponent: string
  week: number
}
export type CfbdDrive = {
  id: string
  gameId: number
  isHomeOffense: boolean
  startPeriod: number
  endPeriod: number
  startOffenseScore: number
  startDefenseScore: number
  endOffenseScore: number
  endDefenseScore: number
  plays: number
  driveResult: string
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
  getAdvancedGameStats: (
    args: GetSeasonArgs & { week?: number },
  ) => Promise<Array<CfbdAdvancedGameStat>>
  getDrives: (
    args: GetSeasonArgs & { week?: number },
  ) => Promise<Array<CfbdDrive>>
  getAdvancedSeasonStats: (
    args: GetSeasonStatsArgs,
  ) => Promise<Array<CfbdAdvancedSeasonStat>>
  getCoachTenures: (args: GetSeasonArgs) => Promise<Array<CfbdCoachTenure>>
  getDraftPicks: (args: GetSeasonArgs) => Promise<Array<CfbdDraftPick>>
  getFbsTeams: (args: GetSeasonArgs) => Promise<Array<CfbdFbsTeam>>
  getGames: (args: GetGamesArgs) => Promise<Array<CfbdGame>>
  getRecruitingTeams: (
    args: GetSeasonArgs,
  ) => Promise<Array<CfbdRecruitingTeam>>
  getRankings: (args: GetSeasonArgs) => Promise<Array<CfbdRankingWeek>>
  getReturningProduction: (
    args: GetSeasonArgs,
  ) => Promise<Array<CfbdReturningProduction>>
  getSeasonStats: (args: GetSeasonStatsArgs) => Promise<Array<CfbdSeasonStat>>
  getTalent: (args: GetSeasonArgs) => Promise<Array<CfbdTalent>>
  getTeamGameStats: (
    args: GetTeamGameStatsArgs,
  ) => Promise<Array<CfbdTeamGameStats>>
  getTransfers: (args: GetSeasonArgs) => Promise<Array<CfbdTransfer>>
  getVenues: (args?: { signal?: AbortSignal }) => Promise<Array<CfbdVenue>>
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
      message: `CFBD ${endpoint} rejected the configured credentials (HTTP ${status}). Check the CFBD API key and subscription access.`,
      retryable: false,
      status,
    })
  }
  if (status === 429) {
    return new CfbdClientError({
      endpoint,
      kind: 'rate_limit',
      message: `CFBD ${endpoint} exceeded the current request limit (HTTP ${status}). Wait for the provider limit to reset before retrying.`,
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

// Only include bounded football identifiers, never whole provider payloads.
function describeValue(value: unknown): string {
  if (value === undefined) return 'missing'
  if (value === null) return 'null'
  if (typeof value === 'string') {
    return `string ${JSON.stringify(value.length > 100 ? `${value.slice(0, 100)}…` : value)}`
  }
  if (Array.isArray(value)) return `array (${value.length} items)`
  if (typeof value === 'object') return 'object'
  return `${typeof value} ${String(value)}`
}

function recordContext(value: unknown) {
  if (!isRow(value)) return describeValue(value)
  return [
    'id',
    'collegeAthleteId',
    'name',
    'playerName',
    'firstName',
    'lastName',
    'collegeTeam',
    'nflTeam',
    'overall',
    'year',
    'season',
    'week',
    'team',
    'teamId',
    'school',
    'homeTeam',
    'awayTeam',
    'category',
    'statName',
  ]
    .flatMap((field) => {
      const item = value[field]
      if (typeof item !== 'string' && typeof item !== 'number') return []
      return [
        `${field}=${typeof item === 'string' ? describeValue(item).slice(7) : item}`,
      ]
    })
    .join(', ')
}

function fieldError(
  row: CfbdRow,
  field: string,
  endpoint: string,
  expected: string,
) {
  const context = recordContext(row)
  return contractError(
    endpoint,
    `invalid ${field}: expected ${expected}; received ${describeValue(row[field])}${context ? `; ${context}` : ''}`,
  )
}

function requiredBoolean(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (typeof value !== 'boolean') {
    throw fieldError(row, field, endpoint, 'boolean')
  }
  return value
}

function requiredNumber(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw fieldError(row, field, endpoint, 'finite number')
  }
  return value
}

function optionalNumber(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (value === null || value === undefined) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw fieldError(row, field, endpoint, 'finite number or null')
  }
  return value
}

function nullableString(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw fieldError(row, field, endpoint, 'string or null')
  }
  return value
}

function requiredString(row: CfbdRow, field: string, endpoint: string) {
  const value = row[field]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw fieldError(row, field, endpoint, 'non-empty string')
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
    throw fieldError(value, 'homeAway', endpoint, '"home" or "away"')
  }
  if (!Array.isArray(value.stats)) {
    throw fieldError(value, 'stats', endpoint, 'array of statistics')
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
    throw fieldError(value, 'teams', endpoint, 'array of exactly two teams')
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
  if (!isRow(value)) throw fieldError(row, field, endpoint, 'object')
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

function parseVenue(value: unknown): CfbdVenue {
  const endpoint = '/venues'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    id: requiredNumber(value, 'id', endpoint),
    name: requiredString(value, 'name', endpoint),
  }
}

function parseDraftPick(value: unknown): CfbdDraftPick {
  const endpoint = '/draft/picks'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    collegeTeam: requiredString(value, 'collegeTeam', endpoint),
    nflTeam: requiredString(value, 'nflTeam', endpoint),
    overall: requiredNumber(value, 'overall', endpoint),
    pick: requiredNumber(value, 'pick', endpoint),
    playerName: requiredString(value, 'name', endpoint),
    position: requiredString(value, 'position', endpoint),
    round: requiredNumber(value, 'round', endpoint),
    year: requiredNumber(value, 'year', endpoint),
  }
}

function parseRankingWeek(value: unknown): CfbdRankingWeek {
  const endpoint = '/rankings'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  if (!Array.isArray(value.polls) || value.polls.some((poll) => !isRow(poll))) {
    throw fieldError(value, 'polls', endpoint, 'array of poll objects')
  }
  return {
    ...value,
    polls: value.polls as Array<CfbdRow>,
    season: requiredNumber(value, 'season', endpoint),
    week: requiredNumber(value, 'week', endpoint),
  }
}

function parseSeasonStat(value: unknown): CfbdSeasonStat {
  const endpoint = '/stats/season'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  const statValue = value.statValue
  if (typeof statValue !== 'string' && typeof statValue !== 'number') {
    throw fieldError(value, 'statValue', endpoint, 'string or number')
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

function parseAdvancedGameStat(value: unknown): CfbdAdvancedGameStat {
  const endpoint = '/stats/game/advanced'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  return {
    ...value,
    gameId: requiredNumber(value, 'gameId', endpoint),
    season: requiredNumber(value, 'season', endpoint),
    team: requiredString(value, 'team', endpoint),
    opponent: requiredString(value, 'opponent', endpoint),
    week: requiredNumber(value, 'week', endpoint),
    offense: requiredRow(value, 'offense', endpoint),
    defense: requiredRow(value, 'defense', endpoint),
  }
}
function parseDrive(value: unknown): CfbdDrive {
  const endpoint = '/drives'
  if (!isRow(value)) throw contractError(endpoint, 'non-object row')
  const number = (key: string) => requiredNumber(value, key, endpoint)
  if (typeof value.id !== 'string' || typeof value.isHomeOffense !== 'boolean')
    throw contractError(endpoint, 'invalid drive identity')
  return {
    id: value.id,
    gameId: number('gameId'),
    isHomeOffense: value.isHomeOffense,
    startPeriod: number('startPeriod'),
    endPeriod: number('endPeriod'),
    startOffenseScore: number('startOffenseScore'),
    startDefenseScore: number('startDefenseScore'),
    endOffenseScore: number('endOffenseScore'),
    endDefenseScore: number('endDefenseScore'),
    plays: number('plays'),
    driveResult: requiredString(value, 'driveResult', endpoint),
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
          message: `CFBD ${endpoint} could not be reached after ${attempt} attempts. Check provider availability and network access before retrying.`,
          retryable: true,
        })
      }
      if (!response.ok) {
        const error = responseError(endpoint, response.status)
        if (error.retryable && attempt < maxAttempts) {
          await sleep(250 * 2 ** (attempt - 1))
          continue
        }
        error.message += ` Request stopped after ${attempt} attempt(s).`
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

  async function requestParsedRows<T>(
    endpoint: string,
    signal: AbortSignal | undefined,
    parse: (value: unknown) => T,
  ): Promise<Array<T>> {
    const values = await requestRows(endpoint, signal)
    return values.map((value, index) => {
      try {
        return parse(value)
      } catch (error) {
        if (!(error instanceof CfbdClientError)) throw error
        const context = recordContext(value)
        const detail = error.message.replace(
          `CFBD ${error.endpoint} contract violation: `,
          '',
        )
        const message = `CFBD ${endpoint} contract violation at record ${index + 1} of ${values.length}${context && !detail.includes(context) ? ` (${context})` : ''}: ${detail} Check the source record and field mapping before retrying.`
        throw new CfbdClientError({
          endpoint,
          kind: error.kind,
          message: options.apiKey
            ? message.split(options.apiKey).join('<REDACTED>')
            : message,
          retryable: error.retryable,
          status: error.status,
        })
      }
    })
  }

  return {
    async getAdvancedGameStats(args) {
      const query = new URLSearchParams({
        year: String(args.season),
        excludeGarbageTime: 'true',
        seasonType: 'both',
      })
      if (args.week !== undefined) query.set('week', String(args.week))
      return requestParsedRows(
        `/stats/game/advanced?${query}`,
        args.signal,
        parseAdvancedGameStat,
      )
    },
    async getDrives(args) {
      const query = new URLSearchParams({
        year: String(args.season),
        classification: 'fbs',
        seasonType: 'both',
      })
      if (args.week !== undefined) query.set('week', String(args.week))
      return requestParsedRows(`/drives?${query}`, args.signal, parseDrive)
    },
    async getAdvancedSeasonStats(args) {
      const query = new URLSearchParams({
        year: String(args.season),
        endWeek: String(args.endWeek),
        excludeGarbageTime: 'true',
        classification: args.classification,
      })
      return requestParsedRows(
        `/stats/season/advanced?${query.toString()}`,
        args.signal,
        parseAdvancedSeasonStat,
      )
    },
    async getCoachTenures(args) {
      return requestParsedRows(
        `/coaches/tenures?year=${args.season}`,
        args.signal,
        parseCoachTenure,
      )
    },
    async getDraftPicks(args) {
      return requestParsedRows(
        `/draft/picks?year=${args.season}`,
        args.signal,
        parseDraftPick,
      )
    },
    async getFbsTeams(args) {
      return requestParsedRows(
        `/teams/fbs?year=${args.season}`,
        args.signal,
        parseFbsTeam,
      )
    },
    async getGames(args) {
      const query = new URLSearchParams({
        year: String(args.season),
      })
      if (args.week !== undefined) query.set('week', String(args.week))
      query.set('seasonType', args.seasonType)
      query.set('classification', args.classification)
      const endpoint = `/games?${query.toString()}`
      return requestParsedRows(endpoint, args.signal, parseGame)
    },
    async getRecruitingTeams(args) {
      return requestParsedRows(
        `/recruiting/teams?year=${args.season}`,
        args.signal,
        parseRecruitingTeam,
      )
    },
    async getReturningProduction(args) {
      return requestParsedRows(
        `/player/returning?year=${args.season}`,
        args.signal,
        parseReturningProduction,
      )
    },
    async getSeasonStats(args) {
      const query = new URLSearchParams({
        year: String(args.season),
        endWeek: String(args.endWeek),
        classification: args.classification,
      })
      return requestParsedRows(
        `/stats/season?${query.toString()}`,
        args.signal,
        parseSeasonStat,
      )
    },
    async getTalent(args) {
      return requestParsedRows(
        `/talent?year=${args.season}`,
        args.signal,
        parseTalent,
      )
    },
    async getTeamGameStats(args) {
      const query = new URLSearchParams({
        year: String(args.season),
        week: String(args.week),
        seasonType: args.seasonType,
        classification: args.classification,
      })
      const endpoint = `/games/teams?${query.toString()}`
      return requestParsedRows(endpoint, args.signal, parseTeamGameStats)
    },
    async getTransfers(args) {
      return requestParsedRows(
        `/player/portal?year=${args.season}`,
        args.signal,
        parseTransfer,
      )
    },
    async getRankings(args) {
      return requestParsedRows(
        `/rankings?year=${args.season}`,
        args.signal,
        parseRankingWeek,
      )
    },
    async getVenues(args) {
      return requestParsedRows('/venues', args?.signal, parseVenue)
    },
  }
}
