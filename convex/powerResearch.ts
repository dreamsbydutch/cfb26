import { buildPowerRatingEdition, projectPowerMatchup } from './ratingSystem.ts'
import { chooseChampion, evaluateForecasts } from './ratingBacktest.ts'
import { publicationWeek } from './ratingCalendar.ts'
import { historicalPowerPrior, rememberPowerSeason } from './powerHistory.ts'
import type { PowerHistory } from './powerHistory.ts'
import type {
  PowerRatingGame,
  PowerRatingTeam,
  PowerTeamRating,
} from './ratingSystem.ts'
import type { BacktestForecast } from './ratingBacktest.ts'

export type PowerPolicy = {
  version: string
  historySeasons: number
  priorGames: number
  seasonRetention: number
  halfLifeDays: number | null
  turnoverSensitive: boolean
  divisionAdjustment?: boolean
  transitionPriorGames?: number
}

export const POWER_POLICIES: ReadonlyArray<PowerPolicy> = [
  {
    version: 'cfb26-power-v1',
    historySeasons: 5,
    priorGames: 8,
    seasonRetention: 1,
    halfLifeDays: null,
    turnoverSensitive: false,
  },
  {
    version: 'cfb26-power-v2',
    historySeasons: 5,
    priorGames: 8,
    seasonRetention: 1,
    halfLifeDays: null,
    turnoverSensitive: false,
    divisionAdjustment: true,
    transitionPriorGames: 2,
  },
  {
    version: 'power-transition-4',
    historySeasons: 5,
    priorGames: 4,
    seasonRetention: 0.8,
    halfLifeDays: null,
    turnoverSensitive: true,
  },
  {
    version: 'power-recency-60',
    historySeasons: 5,
    priorGames: 4,
    seasonRetention: 0.8,
    halfLifeDays: 60,
    turnoverSensitive: true,
  },
  {
    version: 'power-recency-120',
    historySeasons: 5,
    priorGames: 6,
    seasonRetention: 0.9,
    halfLifeDays: 120,
    turnoverSensitive: true,
  },
]

export type PersonnelEvidence = {
  teamId: string
  season: number
  observedAt: number
  effectiveAt: number
  expiresAt: number
  returningShare?: number
  coachChanged?: boolean
  source: string
}

/** A research seam: callers may only promote policies with held-out evidence. */
export function fitHistoricalPower(
  input: {
    teams: ReadonlyArray<PowerRatingTeam>
    games: ReadonlyArray<PowerRatingGame>
    season: number
    cutoffAt: number
    week: number
    policy: PowerPolicy
    personnel?: ReadonlyArray<PersonnelEvidence>
  },
  historyCache?: Map<string, ReturnType<typeof buildPowerRatingEdition>>,
) {
  if (
    !Number.isInteger(input.policy.historySeasons) ||
    input.policy.historySeasons < 1 ||
    input.policy.historySeasons > 10 ||
    !Number.isFinite(input.policy.priorGames) ||
    input.policy.priorGames < 0 ||
    !Number.isFinite(input.policy.seasonRetention) ||
    input.policy.seasonRetention < 0 ||
    input.policy.seasonRetention > 1 ||
    (input.policy.halfLifeDays !== null &&
      (!Number.isFinite(input.policy.halfLifeDays) ||
        input.policy.halfLifeDays <= 0))
  )
    throw new Error('Invalid historical Power policy.')
  for (const row of input.personnel ?? []) {
    if (
      ![row.observedAt, row.effectiveAt, row.expiresAt].every(
        Number.isFinite,
      ) ||
      row.expiresAt <= row.effectiveAt ||
      !row.source.trim() ||
      (row.returningShare !== undefined &&
        (!Number.isFinite(row.returningShare) ||
          row.returningShare < 0 ||
          row.returningShare > 1))
    )
      throw new Error('Invalid timestamped personnel evidence.')
  }
  let previous = new Map<string, PowerTeamRating>()
  const history: PowerHistory = new Map()
  let edition: ReturnType<typeof buildPowerRatingEdition> | undefined
  for (
    let season = input.season - input.policy.historySeasons + 1;
    season <= input.season;
    season++
  ) {
    const cacheKey = `${input.policy.version}:${input.season}:${season}`
    const cached =
      season < input.season ? historyCache?.get(cacheKey) : undefined
    if (cached) {
      edition = cached
      previous = new Map(cached.ratings.map((row) => [row.teamId, row]))
      rememberPowerSeason(history, season, cached.ratings)
      continue
    }
    const cutoffAt = Math.min(
      input.cutoffAt,
      season === input.season ? input.cutoffAt : Date.UTC(season + 1, 2, 1),
    )
    const schedule = input.games.filter((game) => game.season === season)
    const participantIds = new Set(
      schedule.flatMap((game) => [game.homeTeamId, game.awayTeamId]),
    )
    const classifications = new Map<string, PowerRatingTeam['classification']>()
    for (const game of schedule) {
      if (game.homeClassification)
        classifications.set(game.homeTeamId, game.homeClassification)
      if (game.awayClassification)
        classifications.set(game.awayTeamId, game.awayClassification)
    }
    const games = input.games.filter(
      (game) =>
        game.season === season &&
        game.completed &&
        game.kickoffAt + 6 * 3_600_000 < cutoffAt,
    )
    const teams = input.teams
      .filter(
        (team) => participantIds.size === 0 || participantIds.has(team.id),
      )
      .map((team) => {
        const prior = previous.get(team.id)
        const personnel = input.personnel
          ?.filter(
            (row) =>
              row.teamId === team.id &&
              row.season === season &&
              row.observedAt < cutoffAt &&
              row.effectiveAt <= cutoffAt &&
              row.expiresAt > cutoffAt,
          )
          .sort((a, b) => b.observedAt - a.observedAt)[0]
        const retention =
          input.policy.turnoverSensitive && personnel
            ? (personnel.returningShare === undefined
                ? 1
                : 0.5 + 0.5 * personnel.returningShare) *
              (personnel.coachChanged ? 0.8 : 1)
            : 1
        return {
          ...team,
          classification: classifications.get(team.id) ?? team.classification,
          prior: input.policy.divisionAdjustment
            ? historicalPowerPrior(
                {
                  ...team,
                  classification:
                    classifications.get(team.id) ?? team.classification,
                },
                season,
                history,
                input.policy.transitionPriorGames,
              )
            : prior
              ? {
                  power: prior.power * input.policy.seasonRetention,
                  offense: prior.offense * input.policy.seasonRetention,
                  defense: prior.defense * input.policy.seasonRetention,
                  effectiveGames:
                    Math.min(prior.gamesPlayed, input.policy.priorGames) *
                    retention,
                  sources: [
                    'multi_season_performance',
                    ...(personnel ? ['verified_personnel'] : []),
                  ],
                }
              : undefined,
        }
      })
    edition = buildPowerRatingEdition({
      divisionAdjustment: input.policy.divisionAdjustment ?? false,
      teams,
      season,
      cutoffAt,
      week: season === input.season ? input.week : 30,
      games: games.map((game) => ({
        ...game,
        evidenceWeight:
          input.policy.halfLifeDays === null
            ? 1
            : 2 **
              (-(cutoffAt - game.kickoffAt) /
                86_400_000 /
                input.policy.halfLifeDays),
      })),
    })
    previous = new Map(edition.ratings.map((row) => [row.teamId, row]))
    rememberPowerSeason(history, season, edition.ratings)
    if (season < input.season) historyCache?.set(cacheKey, edition)
  }
  if (!edition) throw new Error('Historical Power needs at least one season.')
  return edition
}

/** Reconstruct pregame forecasts; never masquerade as contemporaneous publications. */
export function evaluatePowerPolicies(input: {
  teams: ReadonlyArray<PowerRatingTeam>
  games: ReadonlyArray<PowerRatingGame>
  testSeasons: ReadonlyArray<number>
  onProgress?: (version: string) => void
  policies?: ReadonlyArray<PowerPolicy>
}) {
  const reports = (input.policies ?? POWER_POLICIES).map((policy) => {
    input.onProgress?.(policy.version)
    const historyCache = new Map<
      string,
      ReturnType<typeof buildPowerRatingEdition>
    >()
    const forecasts: Array<BacktestForecast> = []
    for (const season of input.testSeasons) {
      const games = input.games
        .filter((game) => game.completed && game.season === season)
        .sort((a, b) => a.kickoffAt - b.kickoffAt)
      // Freeze before the first game in each week; later results cannot leak in.
      const weeks = [
        ...new Set(
          games.map((game) => `${game.seasonType ?? 'regular'}:${game.week}`),
        ),
      ]
      for (const weekKey of weeks) {
        const slate = games.filter(
          (game) => `${game.seasonType ?? 'regular'}:${game.week}` === weekKey,
        )
        const week = slate[0].week
        const cutoffAt = Math.min(...slate.map((game) => game.kickoffAt)) - 1
        const edition = fitHistoricalPower(
          {
            ...input,
            season,
            week,
            cutoffAt,
            policy,
            games: input.games,
          },
          historyCache,
        )
        for (const game of slate) {
          const projection = projectPowerMatchup(
            edition,
            game.homeTeamId,
            game.awayTeamId,
            game.neutralSite ? 'neutral' : 'team_a',
          )
          forecasts.push({
            homeClassification: game.homeClassification,
            awayClassification: game.awayClassification,
            gameId: game.id,
            season,
            week: publicationWeek({
              asOf: game.kickoffAt,
              selected: {
                seasonType: game.seasonType ?? 'regular',
                week: game.week,
              },
              schedule: games.map((row) => ({
                seasonType: row.seasonType ?? 'regular',
                week: row.week,
                startTime: row.kickoffAt,
              })),
            }),
            kickoffAt: game.kickoffAt,
            featureCutoffAt: cutoffAt,
            actualMargin: game.homePoints - game.awayPoints,
            predictedMargin: projection.projectedMargin,
            homeWinProbability: projection.teamAWinProbability,
            neutralSite: game.neutralSite,
            seasonType: game.seasonType ?? 'regular',
          })
        }
      }
    }
    const evaluation = evaluateForecasts(forecasts)
    return {
      modelVersion: policy.version,
      evaluation,
      forecasts,
      folds: Object.entries(evaluation.bySeason).map(([season, metrics]) => ({
        ...metrics,
        season: Number(season),
      })),
    }
  })
  return {
    reconstruction: true,
    reports,
    selection: chooseChampion(reports[0], reports.slice(1)),
  }
}
