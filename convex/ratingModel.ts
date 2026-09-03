import { calibrateMargin } from './ratingBacktest.ts'
import type { Doc, Id } from './_generated/dataModel'
import type { LogisticMarginCalibration } from './ratingBacktest.ts'

export const MODEL_VERSION = 'cfb26-composite-v2'

export type RatingDimensions = {
  continuity: number
  defense: number
  form: number
  offense: number
  passingDefense: number
  passingOffense: number
  power: number
  resume: number
  rushingDefense: number
  rushingOffense: number
  situationalDefense: number
  situationalOffense: number
  specialTeams: number
  talent: number
  tempo: number
  volatility: number
}

export type SeasonModelData = {
  draft: Array<Doc<'teamDraftSelections'>>
  elo: Array<Doc<'teamSeasonRatings'>>
  games: Array<Doc<'collegeGames'>>
  inputs: Array<Doc<'teamSeasonRatingInputs'>>
  programs: Array<Doc<'programs'>>
  recruiting: Array<Doc<'teamRecruitingClasses'>>
  standings: Array<Doc<'teamSeasonStandings'>>
  stats: Array<Doc<'teamGameStats'>>
}

export type CompositeRating = {
  confidence: number
  conference?: string
  dataSources: Array<string>
  dimensions: RatingDimensions
  generatedAt: number
  modelVersion: string
  overall: number
  programId: Id<'programs'>
  programKey: string
  rank: number
  season: number
  signalCount: number
  sourceProgramName: string
}

type RawTeam = {
  conference?: string
  name: string
  programId: Id<'programs'>
  programKey: string
  raw: Map<string, number>
  sources: Set<string>
}

type SignalDefinition = {
  direction?: 'high' | 'low'
  key: string
  weight: number
}

type ScoredDimension = { coverage: number; score: number }

const DIMENSION_WEIGHTS: Readonly<Record<keyof RatingDimensions, number>> = {
  continuity: 6,
  defense: 13,
  form: 4,
  offense: 13,
  passingDefense: 2.5,
  passingOffense: 2.5,
  power: 26,
  resume: 8,
  rushingDefense: 2.5,
  rushingOffense: 2.5,
  situationalDefense: 2.5,
  situationalOffense: 2.5,
  specialTeams: 3,
  talent: 12,
  tempo: 0,
  volatility: 0,
}

const SOURCE_CONFIDENCE: Readonly<Record<string, number>> = {
  advanced: 12,
  core: 10,
  draft: 3,
  elo: 10,
  fpi: 8,
  game_stats: 8,
  games: 13,
  recruiting: 8,
  returning: 5,
  sp: 10,
  standings: 8,
  talent: 5,
}

const DIMENSIONS: Readonly<
  Record<keyof RatingDimensions, Array<SignalDefinition>>
> = {
  power: [
    { key: 'elo', weight: 19 },
    { key: 'standings.srs', weight: 7 },
    { key: 'sp.overall', weight: 12 },
    { key: 'fpi.overall', weight: 9 },
    { key: 'core.overall', weight: 12 },
    { key: 'games.adjustedMargin', weight: 12 },
    { key: 'standings.winPercentage', weight: 4 },
    { key: 'sp.secondOrderWins', weight: 3 },
    { key: 'games.seasonForm', weight: 2 },
    { key: 'history.standingsSrs', weight: 5 },
    { key: 'history.standingsWinPercentage', weight: 3 },
    { key: 'history.gamesAdjustedMargin', weight: 6 },
    { key: 'history.gamesWinPercentage', weight: 3 },
    { key: 'history.standingsTrend', weight: 1.5 },
    { key: 'history.gamesTrend', weight: 1.5 },
  ],
  offense: [
    { key: 'core.offense', weight: 15 },
    { key: 'sp.offense.rating', weight: 12 },
    { key: 'fpi.efficiency.offense', weight: 8 },
    { key: 'advanced.offense.ppa', weight: 12 },
    { key: 'advanced.offense.successRate', weight: 9 },
    { key: 'advanced.offense.explosiveness', weight: 7 },
    { key: 'advanced.offense.pointsPerOpportunity', weight: 8 },
    { key: 'standings.offense.points', weight: 10 },
    { key: 'standings.offense.yardsPerPlay', weight: 8 },
    { key: 'gameStats.offense.yardsPerPlay', weight: 6 },
    { key: 'gameStats.offense.turnovers', weight: 5, direction: 'low' },
  ],
  defense: [
    { key: 'core.defense', weight: 15, direction: 'low' },
    { key: 'sp.defense.ranking', weight: 10, direction: 'low' },
    { key: 'fpi.efficiency.defense', weight: 8 },
    { key: 'advanced.defense.ppa', weight: 12, direction: 'low' },
    { key: 'advanced.defense.successRate', weight: 9, direction: 'low' },
    { key: 'advanced.defense.explosiveness', weight: 7, direction: 'low' },
    {
      key: 'advanced.defense.pointsPerOpportunity',
      weight: 8,
      direction: 'low',
    },
    { key: 'standings.defense.points', weight: 10, direction: 'low' },
    { key: 'standings.defense.yardsPerPlay', weight: 8, direction: 'low' },
    { key: 'gameStats.defense.yardsPerPlay', weight: 6, direction: 'low' },
    { key: 'gameStats.defense.havoc', weight: 7 },
  ],
  passingOffense: [
    { key: 'sp.offense.passing', weight: 17 },
    { key: 'advanced.offense.passing.ppa', weight: 22 },
    { key: 'advanced.offense.passing.successRate', weight: 18 },
    { key: 'advanced.offense.passing.explosiveness', weight: 13 },
    { key: 'standings.offense.passYpa', weight: 15 },
    { key: 'standings.offense.passCompletionPercentage', weight: 7 },
    { key: 'gameStats.offense.passYpa', weight: 8 },
  ],
  passingDefense: [
    { key: 'sp.defense.passing', weight: 17, direction: 'low' },
    { key: 'advanced.defense.passing.ppa', weight: 22, direction: 'low' },
    {
      key: 'advanced.defense.passing.successRate',
      weight: 18,
      direction: 'low',
    },
    {
      key: 'advanced.defense.passing.explosiveness',
      weight: 13,
      direction: 'low',
    },
    { key: 'standings.defense.passYpa', weight: 15, direction: 'low' },
    {
      key: 'standings.defense.passCompletionPercentage',
      weight: 7,
      direction: 'low',
    },
    { key: 'gameStats.defense.passYpa', weight: 8, direction: 'low' },
  ],
  rushingOffense: [
    { key: 'sp.offense.rushing', weight: 16 },
    { key: 'advanced.offense.rushing.ppa', weight: 20 },
    { key: 'advanced.offense.rushing.successRate', weight: 16 },
    { key: 'advanced.offense.rushing.explosiveness', weight: 10 },
    { key: 'advanced.offense.lineYards', weight: 9 },
    { key: 'advanced.offense.powerSuccess', weight: 7 },
    { key: 'advanced.offense.stuffRate', weight: 6, direction: 'low' },
    { key: 'standings.offense.rushingYardsPerAttempt', weight: 10 },
    { key: 'gameStats.offense.rushYpa', weight: 6 },
  ],
  rushingDefense: [
    { key: 'sp.defense.rushing', weight: 16, direction: 'low' },
    { key: 'advanced.defense.rushing.ppa', weight: 20, direction: 'low' },
    {
      key: 'advanced.defense.rushing.successRate',
      weight: 16,
      direction: 'low',
    },
    {
      key: 'advanced.defense.rushing.explosiveness',
      weight: 10,
      direction: 'low',
    },
    { key: 'advanced.defense.lineYards', weight: 9, direction: 'low' },
    { key: 'advanced.defense.powerSuccess', weight: 7, direction: 'low' },
    { key: 'advanced.defense.stuffRate', weight: 8 },
    {
      key: 'standings.defense.rushingYardsPerAttempt',
      weight: 9,
      direction: 'low',
    },
    { key: 'gameStats.defense.rushYpa', weight: 5, direction: 'low' },
  ],
  situationalOffense: [
    { key: 'advanced.offense.standardDowns.ppa', weight: 17 },
    { key: 'advanced.offense.standardDowns.successRate', weight: 13 },
    { key: 'advanced.offense.passingDowns.ppa', weight: 17 },
    { key: 'advanced.offense.passingDowns.successRate', weight: 13 },
    { key: 'advanced.offense.fieldPosition', weight: 10 },
    { key: 'advanced.offense.pointsPerOpportunity', weight: 12 },
    { key: 'gameStats.offense.thirdDownRate', weight: 10 },
    { key: 'standings.offense.turnovers', weight: 8, direction: 'low' },
  ],
  situationalDefense: [
    { key: 'advanced.defense.standardDowns.ppa', weight: 15, direction: 'low' },
    {
      key: 'advanced.defense.standardDowns.successRate',
      weight: 12,
      direction: 'low',
    },
    { key: 'advanced.defense.passingDowns.ppa', weight: 15, direction: 'low' },
    {
      key: 'advanced.defense.passingDowns.successRate',
      weight: 12,
      direction: 'low',
    },
    { key: 'advanced.defense.fieldPosition', weight: 9, direction: 'low' },
    {
      key: 'advanced.defense.pointsPerOpportunity',
      weight: 10,
      direction: 'low',
    },
    { key: 'advanced.defense.havoc', weight: 12 },
    { key: 'gameStats.defense.thirdDownRate', weight: 8, direction: 'low' },
    { key: 'standings.defense.turnovers', weight: 7 },
  ],
  specialTeams: [
    { key: 'sp.specialTeams', weight: 45 },
    { key: 'fpi.efficiency.specialTeams', weight: 25 },
    { key: 'gameStats.specialTeams.fieldGoalRate', weight: 15 },
    { key: 'gameStats.specialTeams.puntAverage', weight: 8 },
    { key: 'gameStats.specialTeams.returnAverage', weight: 7 },
  ],
  talent: [
    { key: 'talent.composite', weight: 40 },
    { key: 'recruiting.developedPoints', weight: 18 },
    { key: 'recruiting.developedRating', weight: 10 },
    { key: 'recruiting.blueChipPipeline', weight: 10 },
    { key: 'recruiting.freshmanStudImpact', weight: 5 },
    { key: 'recruiting.coreTalent', weight: 5 },
    { key: 'draft.pickValue', weight: 7 },
    { key: 'draft.picks', weight: 3 },
    { key: 'draft.earlyRoundPicks', weight: 2 },
  ],
  continuity: [
    { key: 'returning.percentPpa', weight: 30 },
    { key: 'returning.percentPassingPpa', weight: 20 },
    { key: 'returning.percentReceivingPpa', weight: 15 },
    { key: 'returning.percentRushingPpa', weight: 15 },
    { key: 'returning.usage', weight: 10 },
    { key: 'returning.passingUsage', weight: 4 },
    { key: 'returning.receivingUsage', weight: 3 },
    { key: 'returning.rushingUsage', weight: 3 },
  ],
  resume: [
    { key: 'standings.winPercentage', weight: 24 },
    { key: 'standings.sos', weight: 14 },
    { key: 'standings.srs', weight: 14 },
    { key: 'fpi.resume.strengthOfRecord', weight: 16, direction: 'low' },
    { key: 'fpi.resume.gameControl', weight: 9, direction: 'low' },
    { key: 'games.qualityWinRate', weight: 11 },
    { key: 'games.adjustedMargin', weight: 7 },
    { key: 'standings.championshipScore', weight: 5 },
  ],
  form: [
    { key: 'games.recentForm', weight: 45 },
    { key: 'games.seasonForm', weight: 25 },
    { key: 'games.roadForm', weight: 15 },
    { key: 'games.consistency', weight: 15 },
  ],
  tempo: [
    { key: 'sp.offense.pace', weight: 50 },
    { key: 'standings.offense.plays', weight: 30 },
    { key: 'gameStats.offense.plays', weight: 20 },
  ],
  volatility: [
    { key: 'games.volatility', weight: 45 },
    { key: 'advanced.offense.explosiveness', weight: 20 },
    { key: 'advanced.defense.explosiveness', weight: 20 },
    { key: 'sp.offense.explosiveness', weight: 15 },
  ],
}

function round(value: number, precision = 1) {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}

function clamp(value: number, minimum = 0, maximum = 100) {
  return Math.min(Math.max(value, minimum), maximum)
}

function average(values: Array<number>) {
  return values.length === 0
    ? undefined
    : values.reduce((total, value) => total + value, 0) / values.length
}

function standardDeviation(values: Array<number>) {
  const mean = average(values)
  if (mean === undefined || values.length < 2) return undefined
  return Math.sqrt(
    values.reduce((total, value) => total + (value - mean) ** 2, 0) /
      values.length,
  )
}

function weightedAverage(values: Array<{ value: number; weight: number }>) {
  const totalWeight = values.reduce((total, entry) => total + entry.weight, 0)
  return totalWeight > 0
    ? values.reduce((total, entry) => total + entry.value * entry.weight, 0) /
        totalWeight
    : undefined
}

function linearTrend(values: Array<{ season: number; value: number }>) {
  if (values.length < 2) return undefined
  const meanSeason = average(values.map((entry) => entry.season))
  const meanValue = average(values.map((entry) => entry.value))
  if (meanSeason === undefined || meanValue === undefined) return undefined
  const denominator = values.reduce(
    (total, entry) => total + (entry.season - meanSeason) ** 2,
    0,
  )
  if (denominator === 0) return undefined
  return (
    values.reduce(
      (total, entry) =>
        total + (entry.season - meanSeason) * (entry.value - meanValue),
      0,
    ) / denominator
  )
}

function addSignal(
  team: RawTeam | undefined,
  key: string,
  value: number | undefined,
  source: string,
) {
  if (!team || value === undefined || !Number.isFinite(value)) return
  team.raw.set(key, value)
  team.sources.add(source)
}

function ratio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : undefined
}

function normalizeStatName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function statValue(
  row: Doc<'teamGameStats'>,
  aliases: ReadonlyArray<string>,
  ratioValue = false,
) {
  const names = new Set(aliases.map(normalizeStatName))
  const raw = row.stats.find((stat) =>
    names.has(normalizeStatName(stat.category)),
  )?.value
  if (!raw) return undefined
  if (ratioValue) {
    const parts = raw.match(/(-?\d+(?:\.\d+)?)\s*[-/]\s*(-?\d+(?:\.\d+)?)/)
    if (parts) {
      const made = Number(parts[1])
      const attempts = Number(parts[2])
      if (Number.isFinite(made) && Number.isFinite(attempts) && attempts > 0)
        return made / attempts
    }
  }
  const value = Number(raw.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(value) ? value : undefined
}

function aggregateGameStats(
  teams: Map<string, RawTeam>,
  stats: SeasonModelData['stats'],
) {
  const byGame = new Map<string, Array<Doc<'teamGameStats'>>>()
  for (const row of stats) {
    const key = String(row.gameId)
    byGame.set(key, [...(byGame.get(key) ?? []), row])
  }
  const aggregates = new Map<string, Map<string, Array<number>>>()
  const push = (programId: Id<'programs'>, key: string, value?: number) => {
    if (value === undefined || !Number.isFinite(value)) return
    const team = String(programId)
    const signals = aggregates.get(team) ?? new Map<string, Array<number>>()
    signals.set(key, [...(signals.get(key) ?? []), value])
    aggregates.set(team, signals)
  }

  for (const rows of byGame.values()) {
    if (rows.length !== 2) continue
    for (const row of rows) {
      const opponent = rows.find((candidate) => candidate._id !== row._id)
      if (!opponent) continue
      const passAttempts = statValue(row, ['passingAttempts', 'passAttempts'])
      const rushAttempts = statValue(row, ['rushingAttempts', 'rushAttempts'])
      const plays =
        statValue(row, ['totalPlays', 'plays']) ??
        (passAttempts !== undefined && rushAttempts !== undefined
          ? passAttempts + rushAttempts
          : undefined)
      const totalYards = statValue(row, ['totalYards'])
      const passYards = statValue(row, ['netPassingYards', 'passingYards'])
      const rushYards = statValue(row, ['rushingYards'])
      const opponentPassAttempts = statValue(opponent, [
        'passingAttempts',
        'passAttempts',
      ])
      const opponentRushAttempts = statValue(opponent, [
        'rushingAttempts',
        'rushAttempts',
      ])
      const opponentPlays =
        statValue(opponent, ['totalPlays', 'plays']) ??
        (opponentPassAttempts !== undefined &&
        opponentRushAttempts !== undefined
          ? opponentPassAttempts + opponentRushAttempts
          : undefined)
      const opponentYards = statValue(opponent, ['totalYards'])
      const opponentPassYards = statValue(opponent, [
        'netPassingYards',
        'passingYards',
      ])
      const opponentRushYards = statValue(opponent, ['rushingYards'])

      push(row.programId, 'gameStats.offense.plays', plays)
      push(
        row.programId,
        'gameStats.offense.yardsPerPlay',
        totalYards !== undefined && plays !== undefined
          ? ratio(totalYards, plays)
          : statValue(row, ['yardsPerPlay']),
      )
      push(
        row.programId,
        'gameStats.offense.passYpa',
        passYards !== undefined && passAttempts !== undefined
          ? ratio(passYards, passAttempts)
          : statValue(row, ['yardsPerPass']),
      )
      push(
        row.programId,
        'gameStats.offense.rushYpa',
        rushYards !== undefined && rushAttempts !== undefined
          ? ratio(rushYards, rushAttempts)
          : statValue(row, ['yardsPerRushAttempt']),
      )
      push(
        row.programId,
        'gameStats.offense.thirdDownRate',
        statValue(row, ['thirdDownEff', 'thirdDownEfficiency'], true),
      )
      push(
        row.programId,
        'gameStats.offense.turnovers',
        statValue(row, ['turnovers']),
      )
      push(
        row.programId,
        'gameStats.defense.yardsPerPlay',
        opponentYards !== undefined && opponentPlays !== undefined
          ? ratio(opponentYards, opponentPlays)
          : statValue(opponent, ['yardsPerPlay']),
      )
      push(
        row.programId,
        'gameStats.defense.passYpa',
        opponentPassYards !== undefined && opponentPassAttempts !== undefined
          ? ratio(opponentPassYards, opponentPassAttempts)
          : statValue(opponent, ['yardsPerPass']),
      )
      push(
        row.programId,
        'gameStats.defense.rushYpa',
        opponentRushYards !== undefined && opponentRushAttempts !== undefined
          ? ratio(opponentRushYards, opponentRushAttempts)
          : statValue(opponent, ['yardsPerRushAttempt']),
      )
      push(
        row.programId,
        'gameStats.defense.thirdDownRate',
        statValue(opponent, ['thirdDownEff', 'thirdDownEfficiency'], true),
      )
      const sacks = statValue(row, ['sacks'])
      const tacklesForLoss = statValue(row, ['tacklesForLoss', 'tfl'])
      push(
        row.programId,
        'gameStats.defense.havoc',
        sacks !== undefined || tacklesForLoss !== undefined
          ? (sacks ?? 0) + (tacklesForLoss ?? 0)
          : undefined,
      )
      push(
        row.programId,
        'gameStats.specialTeams.fieldGoalRate',
        statValue(row, ['fieldGoals', 'fieldGoalEff'], true),
      )
      push(
        row.programId,
        'gameStats.specialTeams.puntAverage',
        statValue(row, ['puntAverage', 'yardsPerPunt']),
      )
      push(
        row.programId,
        'gameStats.specialTeams.returnAverage',
        statValue(row, ['kickReturnAverage', 'yardsPerKickReturn']),
      )
    }
  }

  for (const [programId, signals] of aggregates) {
    const team = teams.get(programId)
    for (const [key, values] of signals)
      addSignal(team, key, average(values), 'game_stats')
  }
}

function addStandingsSignals(team: RawTeam, row: Doc<'teamSeasonStandings'>) {
  const add = (key: string, value: number | undefined) =>
    addSignal(team, `standings.${key}`, value, 'standings')
  add('srs', row.simpleRatingSystem)
  add('sos', row.strengthOfSchedule)
  add('winPercentage', row.winPercentage)
  add(
    'championshipScore',
    Number(row.conferenceChampion) +
      Number(row.fourTeamPlayoff || row.twelveTeamPlayoff) * 2 +
      Number(row.nationalChampion) * 3,
  )
  for (const [side, unit] of [
    ['offense', row.offense],
    ['defense', row.defense],
  ] as const) {
    add(`${side}.points`, unit.points)
    add(`${side}.yardsPerPlay`, unit.yardsPerPlay)
    add(`${side}.plays`, unit.plays)
    add(`${side}.passCompletionPercentage`, unit.passCompletionPercentage)
    add(`${side}.rushingYardsPerAttempt`, unit.rushingYardsPerAttempt)
    add(`${side}.turnovers`, unit.turnovers)
    add(`${side}.passYpa`, ratio(unit.passingYards, unit.passAttempts))
  }
}

const HISTORY_WEIGHTS = [1, 0.65, 0.4, 0.25] as const

function addHistoricalStandingsSignals(
  teams: Map<string, RawTeam>,
  rows: SeasonModelData['standings'],
  season: number,
) {
  const byProgram = new Map<string, Array<Doc<'teamSeasonStandings'>>>()
  for (const row of rows) {
    const offset = season - row.season
    if (offset < 1 || offset > HISTORY_WEIGHTS.length) continue
    const key = String(row.programId)
    byProgram.set(key, [...(byProgram.get(key) ?? []), row])
  }

  for (const [programId, history] of byProgram) {
    const team = teams.get(programId)
    const values = history.map((row) => ({
      row,
      weight: HISTORY_WEIGHTS[season - row.season - 1],
    }))
    const weighted = (select: (row: Doc<'teamSeasonStandings'>) => number) =>
      weightedAverage(
        values.map(({ row, weight }) => ({ value: select(row), weight })),
      )
    addSignal(
      team,
      'history.standingsSrs',
      weighted((row) => row.simpleRatingSystem),
      'standings',
    )
    addSignal(
      team,
      'history.standingsWinPercentage',
      weighted((row) => row.winPercentage),
      'standings',
    )
    addSignal(
      team,
      'history.standingsTrend',
      linearTrend(
        history.map((row) => ({
          season: row.season,
          value: row.simpleRatingSystem,
        })),
      ),
      'standings',
    )
  }
}

function addHistoricalGameSignals(
  teams: Map<string, RawTeam>,
  games: SeasonModelData['games'],
  season: number,
) {
  const samples = new Map<
    string,
    Array<{ adjustedMargin: number; season: number; win: boolean }>
  >()
  for (const game of games) {
    const offset = season - game.season
    if (
      offset < 1 ||
      offset > HISTORY_WEIGHTS.length ||
      !game.completed ||
      game.homePoints === undefined ||
      game.awayPoints === undefined
    )
      continue
    for (const side of ['home', 'away'] as const) {
      const isHome = side === 'home'
      const programId = isHome ? game.homeProgramId : game.awayProgramId
      const margin = isHome
        ? game.homePoints - game.awayPoints
        : game.awayPoints - game.homePoints
      const opponentElo = isHome
        ? (game.awayPregameElo ?? game.awayPostgameElo ?? 1500)
        : (game.homePregameElo ?? game.homePostgameElo ?? 1500)
      const venueAdjustment = game.neutralSite ? 0 : isHome ? -2.5 : 2.5
      const rows = samples.get(String(programId)) ?? []
      rows.push({
        adjustedMargin: margin + venueAdjustment + (opponentElo - 1500) / 20,
        season: game.season,
        win: margin > 0,
      })
      samples.set(String(programId), rows)
    }
  }

  for (const [programId, programSamples] of samples) {
    const team = teams.get(programId)
    const seasons = new Map<
      number,
      { adjustedMargin: Array<number>; wins: number }
    >()
    for (const sample of programSamples) {
      const summary = seasons.get(sample.season) ?? {
        adjustedMargin: [],
        wins: 0,
      }
      summary.adjustedMargin.push(sample.adjustedMargin)
      summary.wins += Number(sample.win)
      seasons.set(sample.season, summary)
    }
    const summaries = [...seasons].flatMap(([historySeason, summary]) => {
      const adjustedMargin = average(summary.adjustedMargin)
      return adjustedMargin === undefined
        ? []
        : [
            {
              adjustedMargin,
              season: historySeason,
              weight: HISTORY_WEIGHTS[season - historySeason - 1],
              winPercentage: summary.wins / summary.adjustedMargin.length,
            },
          ]
    })
    addSignal(
      team,
      'history.gamesAdjustedMargin',
      weightedAverage(
        summaries.map((summary) => ({
          value: summary.adjustedMargin,
          weight: summary.weight,
        })),
      ),
      'games',
    )
    addSignal(
      team,
      'history.gamesWinPercentage',
      weightedAverage(
        summaries.map((summary) => ({
          value: summary.winPercentage,
          weight: summary.weight,
        })),
      ),
      'games',
    )
    addSignal(
      team,
      'history.gamesTrend',
      linearTrend(
        summaries.map((summary) => ({
          season: summary.season,
          value: summary.adjustedMargin,
        })),
      ),
      'games',
    )
  }
}

const RECRUITING_DEVELOPMENT_WEIGHTS = [0.2, 0.55, 1, 0.85, 0.45] as const

function addRecruitingSignals(
  teams: Map<string, RawTeam>,
  rows: SeasonModelData['recruiting'],
  season: number,
) {
  const byProgramSeason = new Map<string, Doc<'teamRecruitingClasses'>>()
  for (const row of rows) {
    const key = `${row.programId}:${row.season}`
    const previous = byProgramSeason.get(key)
    if (!previous || row.points > previous.points) byProgramSeason.set(key, row)
  }
  for (const team of teams.values()) {
    const classes: Array<{
      blueChipRatio: number
      offset: number
      row: Doc<'teamRecruitingClasses'>
      weight: number
    }> = []
    for (
      let offset = 0;
      offset < RECRUITING_DEVELOPMENT_WEIGHTS.length;
      offset += 1
    ) {
      const row = byProgramSeason.get(`${team.programId}:${season - offset}`)
      if (!row) continue
      classes.push({
        blueChipRatio:
          row.commits > 0 ? (row.fiveStars + row.fourStars) / row.commits : 0,
        offset,
        row,
        weight: RECRUITING_DEVELOPMENT_WEIGHTS[offset],
      })
    }
    if (classes.length === 0) continue
    addSignal(
      team,
      'recruiting.developedPoints',
      weightedAverage(
        classes.map(({ row, weight }) => ({ value: row.points, weight })),
      ),
      'recruiting',
    )
    addSignal(
      team,
      'recruiting.developedRating',
      weightedAverage(
        classes.map(({ row, weight }) => ({
          value: row.averageRating,
          weight,
        })),
      ),
      'recruiting',
    )
    addSignal(
      team,
      'recruiting.blueChipPipeline',
      weightedAverage(
        classes.map(({ blueChipRatio, weight }) => ({
          value: blueChipRatio,
          weight,
        })),
      ),
      'recruiting',
    )
    const freshmanClass = classes.find(({ offset }) => offset === 0)?.row
    addSignal(
      team,
      'recruiting.freshmanStudImpact',
      freshmanClass === undefined
        ? undefined
        : freshmanClass.fiveStars + freshmanClass.fourStars * 0.35,
      'recruiting',
    )
    const coreClasses = classes.filter(
      ({ offset }) => offset === 2 || offset === 3,
    )
    addSignal(
      team,
      'recruiting.coreTalent',
      weightedAverage(
        coreClasses.map(({ row, weight }) => ({ value: row.points, weight })),
      ),
      'recruiting',
    )
  }
}

function addDraftSignals(
  teams: Map<string, RawTeam>,
  rows: SeasonModelData['draft'],
  season: number,
) {
  const eligibleRows = rows.filter(
    (row) => row.year <= season && season - row.year < 5,
  )
  const coveredYears = new Set(eligibleRows.map((row) => row.year))
  if (coveredYears.size === 0 || eligibleRows.length / coveredYears.size < 64)
    return
  const summaries = new Map<
    string,
    { earlyRoundPicks: number; picks: number; value: number }
  >(
    [...teams].map(([programId]) => [
      programId,
      { earlyRoundPicks: 0, picks: 0, value: 0 },
    ]),
  )
  for (const row of eligibleRows) {
    const key = String(row.programId)
    const summary = summaries.get(key)
    if (!summary) continue
    const recencyWeight = 1 / (season - row.year + 1)
    summary.picks += recencyWeight
    summary.value += row.pickValue * recencyWeight
    if (row.round <= 3) summary.earlyRoundPicks += recencyWeight
    summaries.set(key, summary)
  }
  for (const [programId, summary] of summaries) {
    const team = teams.get(programId)
    addSignal(team, 'draft.picks', summary.picks, 'draft')
    addSignal(team, 'draft.pickValue', summary.value, 'draft')
    addSignal(team, 'draft.earlyRoundPicks', summary.earlyRoundPicks, 'draft')
  }
}

function addGameSignals(
  teams: Map<string, RawTeam>,
  games: SeasonModelData['games'],
  eloByProgram: Map<string, number>,
) {
  const samples = new Map<
    string,
    Array<{
      adjusted: number
      margin: number
      road: boolean
      startTime: number
      win: boolean
      quality: boolean
    }>
  >()
  const qualityThreshold =
    average([...eloByProgram.values()].sort((a, b) => a - b)) ?? 1500
  for (const game of games) {
    if (
      !game.completed ||
      game.homePoints === undefined ||
      game.awayPoints === undefined
    )
      continue
    for (const side of ['home', 'away'] as const) {
      const isHome = side === 'home'
      const programId = isHome ? game.homeProgramId : game.awayProgramId
      const opponentId = isHome ? game.awayProgramId : game.homeProgramId
      const points = isHome ? game.homePoints : game.awayPoints
      const opponentPoints = isHome ? game.awayPoints : game.homePoints
      const margin = points - opponentPoints
      const venueAdjustment = game.neutralSite ? 0 : isHome ? -2.5 : 2.5
      const opponentElo =
        eloByProgram.get(String(opponentId)) ??
        (isHome
          ? (game.awayPregameElo ?? game.awayPostgameElo)
          : (game.homePregameElo ?? game.homePostgameElo)) ??
        1500
      const adjusted = margin + venueAdjustment + (opponentElo - 1500) / 20
      const rows = samples.get(String(programId)) ?? []
      rows.push({
        adjusted,
        margin,
        quality: opponentElo >= qualityThreshold,
        road: !game.neutralSite && !isHome,
        startTime: game.startTime,
        win: margin > 0,
      })
      samples.set(String(programId), rows)
    }
  }
  for (const [programId, rows] of samples) {
    const team = teams.get(programId)
    const recent = [...rows]
      .sort((left, right) => left.startTime - right.startTime)
      .slice(-5)
    const qualityGames = rows.filter((row) => row.quality)
    const road = rows.filter((row) => row.road)
    addSignal(
      team,
      'games.adjustedMargin',
      average(rows.map((row) => row.adjusted)),
      'games',
    )
    addSignal(
      team,
      'games.recentForm',
      average(recent.map((row) => row.adjusted)),
      'games',
    )
    addSignal(
      team,
      'games.seasonForm',
      average(rows.map((row) => row.margin)),
      'games',
    )
    addSignal(
      team,
      'games.roadForm',
      average(road.map((row) => row.adjusted)),
      'games',
    )
    const deviation = standardDeviation(rows.map((row) => row.adjusted))
    addSignal(
      team,
      'games.consistency',
      deviation === undefined ? undefined : -deviation,
      'games',
    )
    addSignal(team, 'games.volatility', deviation, 'games')
    addSignal(
      team,
      'games.qualityWinRate',
      qualityGames.length > 0
        ? qualityGames.filter((row) => row.win).length / qualityGames.length
        : undefined,
      'games',
    )
  }
}

function percentileMap(
  teams: Array<RawTeam>,
  key: string,
  direction: 'high' | 'low',
) {
  const values = teams
    .flatMap((team) => {
      const value = team.raw.get(key)
      return value === undefined ? [] : [{ id: String(team.programId), value }]
    })
    .sort((left, right) => left.value - right.value)
  const scores = new Map<string, number>()
  if (values.length === 1) {
    scores.set(values[0].id, 50)
    return scores
  }
  for (let start = 0; start < values.length;) {
    let end = start
    while (
      end + 1 < values.length &&
      values[end + 1].value === values[start].value
    )
      end += 1
    const percentile =
      ((start + end) / 2 / Math.max(values.length - 1, 1)) * 100
    const score = direction === 'high' ? percentile : 100 - percentile
    for (let index = start; index <= end; index += 1)
      scores.set(values[index].id, score)
    start = end + 1
  }
  return scores
}

export function buildSeasonRatings(
  data: SeasonModelData,
  season: number,
  generatedAt: number,
): Array<CompositeRating> {
  const programs = new Map(
    data.programs.map((program) => [String(program._id), program]),
  )
  const candidateRows =
    data.elo.length > 0
      ? data.elo
      : data.inputs.length > 0
        ? data.inputs
        : data.standings.length > 0
          ? data.standings
          : data.recruiting.filter((row) => row.season === season)
  const candidateIds = new Set(
    candidateRows.map((row) => String(row.programId)),
  )
  const teams = new Map<string, RawTeam>()
  for (const programId of candidateIds) {
    const program = programs.get(programId)
    if (!program) continue
    teams.set(programId, {
      name: program.name,
      programId: program._id,
      programKey: program.key,
      raw: new Map(),
      sources: new Set(),
    })
  }

  const eloByProgram = new Map<string, number>()
  for (const row of data.elo) {
    const team = teams.get(String(row.programId))
    if (team) {
      team.name = row.sourceProgramName
      team.conference = row.conference
    }
    addSignal(team, 'elo', row.rating, 'elo')
    eloByProgram.set(String(row.programId), row.rating)
  }
  for (const row of data.inputs) {
    const team = teams.get(String(row.programId))
    if (!team) continue
    team.name = row.sourceProgramName
    team.conference = row.conference ?? team.conference
    for (const signal of row.signals)
      addSignal(team, signal.key, signal.value, signal.key.split('.')[0])
  }
  for (const row of data.standings) {
    if (row.season !== season) continue
    const team = teams.get(String(row.programId))
    if (!team) continue
    team.name = row.sourceProgramName
    team.conference = row.conference
    addStandingsSignals(team, row)
  }
  addHistoricalStandingsSignals(teams, data.standings, season)
  addHistoricalGameSignals(teams, data.games, season)
  addRecruitingSignals(teams, data.recruiting, season)
  addDraftSignals(teams, data.draft, season)
  addGameSignals(
    teams,
    data.games.filter((game) => game.season === season),
    eloByProgram,
  )
  aggregateGameStats(teams, data.stats)

  const teamList = [...teams.values()]
  const percentileCache = new Map<string, Map<string, number>>()
  const scoreDimension = (
    team: RawTeam,
    definitions: Array<SignalDefinition>,
  ): ScoredDimension => {
    let weightedScore = 0
    let observedWeight = 0
    const totalWeight = definitions.reduce(
      (total, definition) => total + definition.weight,
      0,
    )
    for (const definition of definitions) {
      if (!team.raw.has(definition.key)) continue
      const direction = definition.direction ?? 'high'
      const cacheKey = `${definition.key}:${direction}`
      let scores = percentileCache.get(cacheKey)
      if (!scores) {
        scores = percentileMap(teamList, definition.key, direction)
        percentileCache.set(cacheKey, scores)
      }
      const score = scores.get(String(team.programId))
      if (score === undefined) continue
      weightedScore += score * definition.weight
      observedWeight += definition.weight
    }
    return {
      coverage: totalWeight > 0 ? observedWeight / totalWeight : 0,
      score: observedWeight > 0 ? weightedScore / observedWeight : 50,
    }
  }

  const ratings = teamList.map((team) => {
    const scored = Object.fromEntries(
      (Object.keys(DIMENSIONS) as Array<keyof RatingDimensions>).map(
        (dimension) => [dimension, scoreDimension(team, DIMENSIONS[dimension])],
      ),
    ) as Record<keyof RatingDimensions, ScoredDimension>
    const dimensions = Object.fromEntries(
      (Object.keys(scored) as Array<keyof RatingDimensions>).map(
        (dimension) => [dimension, round(scored[dimension].score)],
      ),
    ) as RatingDimensions
    const weightedDimensions = (
      Object.keys(DIMENSION_WEIGHTS) as Array<keyof RatingDimensions>
    ).filter((dimension) => DIMENSION_WEIGHTS[dimension] > 0)
    const totalWeight = weightedDimensions.reduce(
      (total, dimension) => total + DIMENSION_WEIGHTS[dimension],
      0,
    )
    const overall =
      weightedDimensions.reduce(
        (total, dimension) =>
          total + dimensions[dimension] * DIMENSION_WEIGHTS[dimension],
        0,
      ) / totalWeight
    const confidence = [...team.sources].reduce(
      (total, source) => total + (SOURCE_CONFIDENCE[source] ?? 0),
      0,
    )
    return {
      confidence: round(clamp(confidence), 0),
      conference: team.conference,
      dataSources: [...team.sources].sort(),
      dimensions,
      generatedAt,
      modelVersion: MODEL_VERSION,
      overall: round(overall),
      programId: team.programId,
      programKey: team.programKey,
      rank: 0,
      season,
      signalCount: team.raw.size,
      sourceProgramName: team.name,
    }
  })

  return ratings
    .sort(
      (left, right) =>
        right.overall - left.overall ||
        right.dimensions.power - left.dimensions.power ||
        left.sourceProgramName.localeCompare(right.sourceProgramName),
    )
    .map((rating, index) => ({ ...rating, rank: index + 1 }))
}

type MatchupTeam = Pick<
  CompositeRating,
  'confidence' | 'dimensions' | 'overall' | 'sourceProgramName'
>

function matchupEffectiveness(offense: number, opponentDefense: number) {
  return clamp(50 + (offense - opponentDefense) / 2)
}

export function buildMatchupProjection(
  teamA: MatchupTeam,
  teamB: MatchupTeam,
  venue: 'neutral' | 'team_a' | 'team_b',
  probabilityCalibration?: LogisticMarginCalibration,
) {
  const a = teamA.dimensions
  const b = teamB.dimensions
  const venueMargin = venue === 'team_a' ? 2.5 : venue === 'team_b' ? -2.5 : 0
  const offenseDefense = a.offense - b.defense - (b.offense - a.defense)
  const passing =
    a.passingOffense - b.passingDefense - (b.passingOffense - a.passingDefense)
  const rushing =
    a.rushingOffense - b.rushingDefense - (b.rushingOffense - a.rushingDefense)
  const situational =
    a.situationalOffense -
    b.situationalDefense -
    (b.situationalOffense - a.situationalDefense)
  const rawMargin =
    (teamA.overall - teamB.overall) * 0.18 +
    offenseDefense * 0.05 +
    passing * 0.018 +
    rushing * 0.018 +
    situational * 0.012 +
    (a.specialTeams - b.specialTeams) * 0.015 +
    (a.talent - b.talent) * 0.01 +
    (a.continuity - b.continuity) * 0.008 +
    (a.resume - b.resume) * 0.014 +
    (a.form - b.form) * 0.018 +
    venueMargin
  const confidence = Math.min(teamA.confidence, teamB.confidence)
  const projectedMargin = clamp(
    rawMargin * (0.55 + (confidence / 100) * 0.45),
    -35,
    35,
  )
  const teamAWinProbability = probabilityCalibration
    ? calibrateMargin(projectedMargin, probabilityCalibration) * 100
    : clamp(100 / (1 + Math.exp(-projectedMargin / 6.5)), 3, 97)
  const total = clamp(
    52 +
      ((a.offense + b.offense - a.defense - b.defense) / 4) * 0.18 +
      ((a.tempo + b.tempo) / 2 - 50) * 0.12,
    35,
    80,
  )
  const teamAScore = clamp((total + projectedMargin) / 2, 7, 65)
  const teamBScore = clamp((total - projectedMargin) / 2, 7, 65)

  return {
    confidence: round(confidence, 0),
    probabilityCalibrationVersion:
      probabilityCalibration?.version ?? 'fixed-logistic-v1',
    projectedMargin: round(projectedMargin),
    projectedScore: {
      teamA: round(teamAScore, 0),
      teamB: round(teamBScore, 0),
    },
    teamAWinProbability: round(teamAWinProbability, 0),
    teamBWinProbability: round(100 - teamAWinProbability, 0),
    unitMatchups: [
      {
        description: 'Full composite strength',
        key: 'overall',
        label: 'Overall',
        teamA: teamA.overall,
        teamB: teamB.overall,
      },
      {
        description: `${teamA.sourceProgramName} offense vs ${teamB.sourceProgramName} defense, and vice versa`,
        key: 'offense',
        label: 'Scoring matchup',
        teamA: matchupEffectiveness(a.offense, b.defense),
        teamB: matchupEffectiveness(b.offense, a.defense),
      },
      {
        description:
          'Passing efficiency, success, and explosiveness against pass defense',
        key: 'passing',
        label: 'Through the air',
        teamA: matchupEffectiveness(a.passingOffense, b.passingDefense),
        teamB: matchupEffectiveness(b.passingOffense, a.passingDefense),
      },
      {
        description:
          'Rushing efficiency and line performance against the opposing front',
        key: 'rushing',
        label: 'On the ground',
        teamA: matchupEffectiveness(a.rushingOffense, b.rushingDefense),
        teamB: matchupEffectiveness(b.rushingOffense, a.rushingDefense),
      },
      {
        description:
          'Down-and-distance success, finishing drives, havoc, and turnovers',
        key: 'situational',
        label: 'Situational',
        teamA: matchupEffectiveness(a.situationalOffense, b.situationalDefense),
        teamB: matchupEffectiveness(b.situationalOffense, a.situationalDefense),
      },
      {
        description: 'Field-position and kicking value',
        key: 'specialTeams',
        label: 'Special teams',
        teamA: a.specialTeams,
        teamB: b.specialTeams,
      },
      {
        description:
          'Roster talent, recruiting pipeline, and returning production',
        key: 'roster',
        label: 'Roster strength',
        teamA: (a.talent * 2 + a.continuity) / 3,
        teamB: (b.talent * 2 + b.continuity) / 3,
      },
      {
        description: 'Results earned and recent opponent-adjusted form',
        key: 'form',
        label: 'Résumé and form',
        teamA: (a.resume * 2 + a.form) / 3,
        teamB: (b.resume * 2 + b.form) / 3,
      },
      {
        description:
          'Higher means a wider range of plausible outcomes; it is not a strength score',
        key: 'volatility',
        label: 'Volatility',
        teamA: a.volatility,
        teamB: b.volatility,
      },
    ].map((matchup) => ({
      ...matchup,
      teamA: round(matchup.teamA),
      teamB: round(matchup.teamB),
    })),
  }
}
