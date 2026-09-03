import { CfbdClientError, createCfbdClient } from './cfbdClient.ts'
import type { CfbdClient, CfbdClientOptions } from './cfbdClient.ts'

export type CfbdHealthEndpointStatus = {
  durationMs: number
  errorKind?: CfbdClientError['kind']
  httpStatus?: number
  name: string
  required: boolean
  rowCount: number
  status: 'error' | 'ok' | 'warning'
  warning?: string
}

export type CfbdHealthReport = {
  configured: boolean
  endpoints: Array<CfbdHealthEndpointStatus>
  ok: boolean
  season: number
  week: number
}

export type ProbeCfbdArgs = Pick<
  CfbdClientOptions,
  'apiKey' | 'baseUrl' | 'fetchImpl' | 'maxAttempts' | 'sleep'
> & {
  now?: () => number
  season: number
  week: number
}

type ProbeDefinition = {
  load: (client: CfbdClient) => Promise<Array<unknown>>
  name: string
  required: boolean
}

async function runProbe(
  client: CfbdClient,
  definition: ProbeDefinition,
  now: () => number,
): Promise<CfbdHealthEndpointStatus> {
  const startedAt = now()
  try {
    const rows = await definition.load(client)
    const durationMs = Math.max(0, now() - startedAt)
    if (rows.length === 0) {
      return {
        durationMs,
        name: definition.name,
        required: definition.required,
        rowCount: 0,
        status: 'warning',
        warning: 'Endpoint returned no rows for the requested season and week.',
      }
    }
    return {
      durationMs,
      name: definition.name,
      required: definition.required,
      rowCount: rows.length,
      status: 'ok',
    }
  } catch (error) {
    const cfbdError = error instanceof CfbdClientError ? error : undefined
    return {
      durationMs: Math.max(0, now() - startedAt),
      errorKind: cfbdError?.kind ?? 'contract',
      httpStatus: cfbdError?.status,
      name: definition.name,
      required: definition.required,
      rowCount: 0,
      status: 'error',
      warning:
        error instanceof Error ? error.message : 'Unknown CFBD probe failure.',
    }
  }
}

export async function probeCfbd(
  args: ProbeCfbdArgs,
): Promise<CfbdHealthReport> {
  if (!args.apiKey.trim()) {
    return {
      configured: false,
      endpoints: [],
      ok: false,
      season: args.season,
      week: args.week,
    }
  }
  const now = args.now ?? Date.now
  const client = createCfbdClient(args)
  const current = {
    classification: 'fbs' as const,
    season: args.season,
    seasonType: 'both' as const,
    week: args.week,
  }
  const season = { season: args.season }
  const definitions: Array<ProbeDefinition> = [
    { load: (value) => value.getGames(current), name: 'games', required: true },
    {
      load: (value) => value.getTeamGameStats(current),
      name: 'team_game_stats',
      required: true,
    },
    {
      load: (value) => value.getFbsTeams(season),
      name: 'fbs_teams',
      required: true,
    },
    {
      load: (value) =>
        value.getSeasonStats({
          classification: 'fbs',
          endWeek: args.week,
          season: args.season,
        }),
      name: 'season_stats',
      required: true,
    },
    {
      load: (value) =>
        value.getAdvancedSeasonStats({
          classification: 'fbs',
          endWeek: args.week,
          season: args.season,
        }),
      name: 'advanced_season_stats',
      required: false,
    },
    {
      load: (value) => value.getRecruitingTeams(season),
      name: 'recruiting',
      required: false,
    },
    {
      load: (value) => value.getTalent(season),
      name: 'talent',
      required: false,
    },
    {
      load: (value) => value.getReturningProduction(season),
      name: 'returning_production',
      required: false,
    },
    {
      load: (value) => value.getTransfers(season),
      name: 'transfers',
      required: false,
    },
    {
      load: (value) => value.getCoachTenures(season),
      name: 'coaching',
      required: false,
    },
  ]
  const endpoints = await Promise.all(
    definitions.map((definition) => runProbe(client, definition, now)),
  )
  return {
    configured: true,
    endpoints,
    ok: endpoints.every(
      (endpoint) => !endpoint.required || endpoint.status === 'ok',
    ),
    season: args.season,
    week: args.week,
  }
}
