import { calibrateMargin } from './ratingBacktest.ts'
import type { LogisticMarginCalibration } from './ratingBacktest.ts'

export const POWER_MODEL_VERSION = 'cfb26-power-v2'
export const RESUME_MODEL_VERSION = 'cfb26-resume-v3'
export const RESUME_REFERENCE_POWER = 14
export const RESUME_DOMINANCE_WEIGHT = 0.3

export type RatingClassification = 'fbs' | 'fcs' | 'transitioning'

export type PowerRatingTeam = {
  classification: RatingClassification
  conference?: string
  id: string
  name: string
  prior?: {
    defense?: number
    effectiveGames: number
    offense?: number
    power?: number
    sources: Array<string>
    specialTeams?: number
  }
}

export type PowerRatingGame = {
  seasonType?: 'regular' | 'postseason'
  homeClassification?: RatingClassification
  awayClassification?: RatingClassification
  awayPoints: number
  awaySpecialTeamsValue?: number
  awayTeamId: string
  completed: boolean
  homePoints: number
  homeSpecialTeamsValue?: number
  homeTeamId: string
  id: string
  kickoffAt: number
  neutralSite: boolean
  overtimePeriods: number
  season: number
  week: number
  evidenceWeight?: number
}

export type PowerTeamRating = {
  classification: RatingClassification
  conference?: string
  dataSources: Array<string>
  defense: number
  gamesPlayed: number
  homeFieldAdvantage: number
  limitedSample: boolean
  name: string
  offense: number
  power: number
  priorWeight: number
  published: boolean
  rank?: number
  specialTeams: number
  specialTeamsAvailable: boolean
  teamId: string
}

export type PowerRatingEdition = {
  calibration?: LogisticMarginCalibration
  cutoffAt: number
  leagueAveragePoints: number
  modelVersion: string
  ratings: Array<PowerTeamRating>
  season: number
  week: number
}

export type ResumeTeamRating = {
  actualWins: number
  disagreementReasons: Array<
    | 'dominance'
    | 'opponent_adjusted_performance'
    | 'results'
    | 'roster_prior'
    | 'schedule_strength'
  >
  dominanceComponent: number
  expectedWins: number
  limitedSample: boolean
  name: string
  powerRank?: number
  rankDifference?: number
  resume: number
  resumeRank: number
  scheduleComponent: number
  teamId: string
}

export type ResumeRatingEdition = {
  cutoffAt: number
  modelVersion: typeof RESUME_MODEL_VERSION
  ratings: Array<ResumeTeamRating>
  referencePower: number
  season: number
  visible: boolean
  week: number
}

type ScoreObservation = {
  weight: number
  home: boolean
  opponentId: string
  score: number
  teamId: string
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

function round(value: number, precision = 2) {
  const scale = 10 ** precision
  return Math.round(value * scale) / scale
}

function mean(values: ReadonlyArray<number>) {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length
}

function robustScores(game: PowerRatingGame) {
  const rawMargin = game.homePoints - game.awayPoints
  const marginLimit = game.overtimePeriods > 0 ? 7 : 35
  const margin = clamp(rawMargin, -marginLimit, marginLimit)
  const total = clamp(game.homePoints + game.awayPoints, 20, 100)
  return {
    away: (total - margin) / 2,
    home: (total + margin) / 2,
  }
}

function priorValue(team: PowerRatingTeam, unit: 'defense' | 'offense') {
  const direct = team.prior?.[unit]
  if (direct !== undefined) return direct
  return (team.prior?.power ?? 0) / 2
}

function sourceSet(
  team: PowerRatingTeam,
  gamesPlayed: number,
  special: boolean,
) {
  return [
    ...(gamesPlayed > 0 ? ['games'] : []),
    ...(special ? ['game_special_teams'] : []),
    ...(team.prior?.sources ?? []),
  ].filter((source, index, values) => values.indexOf(source) === index)
}

export function buildPowerRatingEdition(input: {
  /** False only when reconstructing the retired model for comparison. */
  divisionAdjustment?: boolean
  calibration?: LogisticMarginCalibration
  cutoffAt: number
  games: ReadonlyArray<PowerRatingGame>
  season: number
  teams: ReadonlyArray<PowerRatingTeam>
  week: number
}): PowerRatingEdition {
  const teams = new Map(input.teams.map((team) => [team.id, team]))
  if (teams.size !== input.teams.length) {
    throw new Error('Power Rating team identifiers must be unique.')
  }
  const games = input.games.filter((game) => {
    if (!game.completed || game.season !== input.season) return false
    if (game.kickoffAt >= input.cutoffAt) {
      throw new Error(`Game ${game.id} is not available before the cutoff.`)
    }
    if (!teams.has(game.homeTeamId) || !teams.has(game.awayTeamId)) {
      throw new Error(`Game ${game.id} references an unknown team.`)
    }
    return true
  })
  const observations: Array<ScoreObservation> = []
  const observationsAgainst = new Map<string, Array<ScoreObservation>>()
  const observationsByTeam = new Map<string, Array<ScoreObservation>>()
  const gamesByTeam = new Map<string, Array<PowerRatingGame>>()
  const gamesPlayed = new Map<string, number>()
  const specialValues = new Map<string, Array<number>>()
  for (const game of games) {
    if (
      !Number.isFinite(game.homePoints) ||
      !Number.isFinite(game.awayPoints) ||
      game.homePoints < 0 ||
      game.awayPoints < 0 ||
      (game.evidenceWeight !== undefined &&
        (!Number.isFinite(game.evidenceWeight) ||
          game.evidenceWeight <= 0 ||
          game.evidenceWeight > 1))
    ) {
      throw new Error(`Game ${game.id} has an invalid score.`)
    }
    const score = robustScores(game)
    const homeObservation = {
      weight: game.evidenceWeight ?? 1,
      home: !game.neutralSite,
      opponentId: game.awayTeamId,
      score: score.home,
      teamId: game.homeTeamId,
    }
    const awayObservation = {
      weight: game.evidenceWeight ?? 1,
      home: false,
      opponentId: game.homeTeamId,
      score: score.away,
      teamId: game.awayTeamId,
    }
    observations.push(homeObservation, awayObservation)
    for (const observation of [homeObservation, awayObservation]) {
      observationsByTeam.set(observation.teamId, [
        ...(observationsByTeam.get(observation.teamId) ?? []),
        observation,
      ])
      observationsAgainst.set(observation.opponentId, [
        ...(observationsAgainst.get(observation.opponentId) ?? []),
        observation,
      ])
    }
    gamesByTeam.set(game.homeTeamId, [
      ...(gamesByTeam.get(game.homeTeamId) ?? []),
      game,
    ])
    gamesByTeam.set(game.awayTeamId, [
      ...(gamesByTeam.get(game.awayTeamId) ?? []),
      game,
    ])
    gamesPlayed.set(
      game.homeTeamId,
      (gamesPlayed.get(game.homeTeamId) ?? 0) + 1,
    )
    gamesPlayed.set(
      game.awayTeamId,
      (gamesPlayed.get(game.awayTeamId) ?? 0) + 1,
    )
    if (game.homeSpecialTeamsValue !== undefined) {
      specialValues.set(game.homeTeamId, [
        ...(specialValues.get(game.homeTeamId) ?? []),
        game.homeSpecialTeamsValue,
      ])
    }
    if (game.awaySpecialTeamsValue !== undefined) {
      specialValues.set(game.awayTeamId, [
        ...(specialValues.get(game.awayTeamId) ?? []),
        game.awaySpecialTeamsValue,
      ])
    }
  }

  const offense = new Map<string, number>()
  const defense = new Map<string, number>()
  const homeField = new Map<string, number>()
  const specialTeams = new Map<string, number>()
  for (const team of input.teams) {
    offense.set(team.id, priorValue(team, 'offense'))
    defense.set(team.id, priorValue(team, 'defense'))
    homeField.set(team.id, 2.5)
    const values = specialValues.get(team.id) ?? []
    const prior = team.prior?.specialTeams ?? 0
    const priorWeight = (team.prior?.effectiveGames ?? 0) + 16
    specialTeams.set(
      team.id,
      (values.reduce((sum, value) => sum + value, 0) + prior * priorWeight) /
        (values.length + priorWeight),
    )
  }
  let leagueAveragePoints =
    observations.length > 0 ? mean(observations.map((row) => row.score)) : 28

  // Estimate the subdivision location from cross-division games. Individual
  // sparse FCS opponents shrink toward this population, never toward FBS zero.
  // All evidence is already filtered to this edition's season and cutoff.
  const crossDivision = games.filter(
    (game) =>
      (teams.get(game.homeTeamId)?.classification === 'fcs') !==
      (teams.get(game.awayTeamId)?.classification === 'fcs'),
  )
  const subdivisionBaseline = (ratings: ReadonlyMap<string, number>) => {
    if (input.divisionAdjustment === false) return 0
    if (crossDivision.length === 0) {
      const priors = input.teams.filter(
        (team) =>
          team.classification === 'fcs' && team.prior?.power !== undefined,
      )
      return priors.length
        ? mean(priors.map((team) => team.prior?.power ?? 0))
        : 0
    }
    let numerator = 0
    let denominator = 0
    for (const game of crossDivision) {
      const fcsHome = teams.get(game.homeTeamId)?.classification === 'fcs'
      const score = robustScores(game)
      const margin = score.home - score.away
      const venue = game.neutralSite
        ? 0
        : (homeField.get(game.homeTeamId) ?? 2.5)
      const opponent =
        ratings.get(fcsHome ? game.awayTeamId : game.homeTeamId) ?? 0
      const weight = game.evidenceWeight ?? 1
      numerator +=
        weight * (opponent + (fcsHome ? margin - venue : -margin + venue))
      denominator += weight
    }
    return numerator / denominator
  }
  const initialBaseline = subdivisionBaseline(
    new Map(input.teams.map((team) => [team.id, team.prior?.power ?? 0])),
  )

  for (let iteration = 0; iteration < 60; iteration += 1) {
    const residualWeight = (observation: ScoreObservation) => {
      const prediction =
        leagueAveragePoints +
        (offense.get(observation.teamId) ?? 0) -
        (defense.get(observation.opponentId) ?? 0) +
        (observation.home ? (homeField.get(observation.teamId) ?? 0) : 0)
      const residual = Math.abs(observation.score - prediction)
      return observation.weight * (residual <= 17 ? 1 : 17 / residual)
    }

    let interceptNumerator = 0
    let interceptDenominator = 0
    for (const observation of observations) {
      const weight = residualWeight(observation)
      interceptNumerator +=
        weight *
        (observation.score -
          (offense.get(observation.teamId) ?? 0) +
          (defense.get(observation.opponentId) ?? 0) -
          (observation.home ? (homeField.get(observation.teamId) ?? 0) : 0))
      interceptDenominator += weight
    }
    if (interceptDenominator > 0) {
      leagueAveragePoints = interceptNumerator / interceptDenominator
    }

    for (const team of input.teams) {
      const own = observationsByTeam.get(team.id) ?? []
      const against = observationsAgainst.get(team.id) ?? []
      const fcsMultiplier = team.classification === 'fcs' ? 2.5 : 1
      const priorWeight = (team.prior?.effectiveGames ?? 0) * fcsMultiplier
      const unitRidge = 1.5 * fcsMultiplier

      const unitBaseline =
        team.classification === 'fcs' ? initialBaseline / 2 : 0
      let numerator =
        priorValue(team, 'offense') * priorWeight + unitBaseline * unitRidge
      let denominator = priorWeight + unitRidge
      for (const observation of own) {
        const weight = residualWeight(observation)
        numerator +=
          weight *
          (observation.score -
            leagueAveragePoints +
            (defense.get(observation.opponentId) ?? 0) -
            (observation.home ? (homeField.get(team.id) ?? 0) : 0))
        denominator += weight
      }
      offense.set(team.id, numerator / denominator)

      numerator =
        priorValue(team, 'defense') * priorWeight + unitBaseline * unitRidge
      denominator = priorWeight + unitRidge
      for (const observation of against) {
        const weight = residualWeight(observation)
        numerator +=
          weight *
          (leagueAveragePoints +
            (offense.get(observation.teamId) ?? 0) +
            (observation.home ? (homeField.get(observation.teamId) ?? 0) : 0) -
            observation.score)
        denominator += weight
      }
      defense.set(team.id, numerator / denominator)

      const homeRows = own.filter((row) => row.home)
      numerator = 2.5 * 10 * fcsMultiplier
      denominator = 10 * fcsMultiplier
      for (const observation of homeRows) {
        const weight = residualWeight(observation)
        numerator +=
          weight *
          (observation.score -
            leagueAveragePoints -
            (offense.get(team.id) ?? 0) +
            (defense.get(observation.opponentId) ?? 0))
        denominator += weight
      }
      homeField.set(team.id, clamp(numerator / denominator, 0, 8))
    }

    const publishedTeams = input.teams.filter(
      (team) => team.classification !== 'fcs',
    )
    const offenseCenter = mean(
      publishedTeams.map((team) => offense.get(team.id) ?? 0),
    )
    const defenseCenter = mean(
      publishedTeams.map((team) => defense.get(team.id) ?? 0),
    )
    const specialCenter = mean(
      publishedTeams.map((team) => specialTeams.get(team.id) ?? 0),
    )
    for (const team of input.teams) {
      offense.set(team.id, (offense.get(team.id) ?? 0) - offenseCenter)
      defense.set(team.id, (defense.get(team.id) ?? 0) - defenseCenter)
      specialTeams.set(
        team.id,
        (specialTeams.get(team.id) ?? 0) - specialCenter,
      )
    }
    leagueAveragePoints += offenseCenter - defenseCenter
  }

  const power = new Map(
    input.teams.map((team) => [team.id, team.prior?.power ?? 0]),
  )
  for (let iteration = 0; iteration < 60; iteration += 1) {
    const fcsBaseline = subdivisionBaseline(power)
    for (const team of input.teams) {
      const fcsMultiplier = team.classification === 'fcs' ? 2.5 : 1
      const priorWeight = (team.prior?.effectiveGames ?? 0) * fcsMultiplier
      let numerator =
        (team.prior?.power ?? 0) * priorWeight +
        (team.classification === 'fcs' ? fcsBaseline * 1.5 * fcsMultiplier : 0)
      let denominator = priorWeight + 1.5 * fcsMultiplier
      for (const game of gamesByTeam.get(team.id) ?? []) {
        const score = robustScores(game)
        const homeMargin = score.home - score.away
        const homeAdvantage = game.neutralSite
          ? 0
          : (homeField.get(game.homeTeamId) ?? 2.5)
        const teamIsHome = game.homeTeamId === team.id
        const opponentId = teamIsHome ? game.awayTeamId : game.homeTeamId
        const target = teamIsHome
          ? homeMargin + (power.get(opponentId) ?? 0) - homeAdvantage
          : -homeMargin + (power.get(opponentId) ?? 0) + homeAdvantage
        const residual = Math.abs(target - (power.get(team.id) ?? 0))
        const weight =
          (game.evidenceWeight ?? 1) * (residual <= 21 ? 1 : 21 / residual)
        numerator += weight * target
        denominator += weight
      }
      power.set(team.id, numerator / denominator)
    }
    for (const team of input.teams) {
      const fcsMultiplier = team.classification === 'fcs' ? 2.5 : 1
      let numerator = 2.5 * 10 * fcsMultiplier
      let denominator = 10 * fcsMultiplier
      for (const game of gamesByTeam.get(team.id) ?? []) {
        if (game.neutralSite || game.homeTeamId !== team.id) continue
        const score = robustScores(game)
        numerator +=
          (game.evidenceWeight ?? 1) *
          (score.home -
            score.away -
            (power.get(game.homeTeamId) ?? 0) +
            (power.get(game.awayTeamId) ?? 0))
        denominator += game.evidenceWeight ?? 1
      }
      homeField.set(team.id, clamp(numerator / denominator, 0, 8))
    }
    const publishedTeams = input.teams.filter(
      (team) => team.classification !== 'fcs',
    )
    const center = mean(publishedTeams.map((team) => power.get(team.id) ?? 0))
    for (const team of input.teams) {
      power.set(team.id, (power.get(team.id) ?? 0) - center)
    }
  }

  for (const team of input.teams) {
    const modeledPower = power.get(team.id) ?? 0
    const unitPower =
      (offense.get(team.id) ?? 0) +
      (defense.get(team.id) ?? 0) +
      (specialTeams.get(team.id) ?? 0)
    const reconciliation = (modeledPower - unitPower) / 2
    offense.set(team.id, (offense.get(team.id) ?? 0) + reconciliation)
    defense.set(team.id, (defense.get(team.id) ?? 0) + reconciliation)
  }

  const ratings = input.teams.map((team): PowerTeamRating => {
    const played = gamesPlayed.get(team.id) ?? 0
    const effectivePriorGames = team.prior?.effectiveGames ?? 0
    const specialAvailable = (specialValues.get(team.id)?.length ?? 0) > 0
    const offenseRating = offense.get(team.id) ?? 0
    const defenseRating = defense.get(team.id) ?? 0
    const specialTeamsRating = specialTeams.get(team.id) ?? 0
    return {
      classification: team.classification,
      conference: team.conference,
      dataSources: sourceSet(team, played, specialAvailable),
      defense: round(defenseRating),
      gamesPlayed: played,
      homeFieldAdvantage: round(homeField.get(team.id) ?? 2.5),
      limitedSample: played < 5,
      name: team.name,
      offense: round(offenseRating),
      power: round(power.get(team.id) ?? 0),
      priorWeight: round(
        effectivePriorGames / Math.max(effectivePriorGames + played, 1),
        4,
      ),
      published: team.classification !== 'fcs',
      specialTeams: round(specialTeamsRating),
      specialTeamsAvailable: specialAvailable,
      teamId: team.id,
    }
  })
  const ranked = ratings
    .filter((rating) => rating.published)
    .sort(
      (left, right) =>
        right.power - left.power || left.name.localeCompare(right.name),
    )
  for (const [index, rating] of ranked.entries()) rating.rank = index + 1

  return {
    calibration: input.calibration,
    cutoffAt: input.cutoffAt,
    leagueAveragePoints: round(leagueAveragePoints),
    modelVersion:
      input.divisionAdjustment === false
        ? 'cfb26-power-v1'
        : POWER_MODEL_VERSION,
    ratings: [...ranked, ...ratings.filter((rating) => !rating.published)],
    season: input.season,
    week: input.week,
  }
}

export function projectPowerMatchup(
  edition: PowerRatingEdition,
  teamAId: string,
  teamBId: string,
  venue: 'neutral' | 'team_a' | 'team_b',
) {
  const teamA = edition.ratings.find((rating) => rating.teamId === teamAId)
  const teamB = edition.ratings.find((rating) => rating.teamId === teamBId)
  if (!teamA || !teamB) throw new Error('Both matchup teams must be rated.')
  const venueMargin =
    venue === 'team_a'
      ? teamA.homeFieldAdvantage
      : venue === 'team_b'
        ? -teamB.homeFieldAdvantage
        : 0
  const projectedMargin = teamA.power - teamB.power + venueMargin
  const teamAWinProbability = edition.calibration
    ? calibrateMargin(projectedMargin, edition.calibration)
    : clamp(1 / (1 + Math.exp(-projectedMargin / 6.5)), 0.03, 0.97)
  const teamAScore =
    edition.leagueAveragePoints +
    teamA.offense -
    teamB.defense +
    teamA.specialTeams +
    (venue === 'team_a' ? teamA.homeFieldAdvantage : 0)
  const teamBScore =
    edition.leagueAveragePoints +
    teamB.offense -
    teamA.defense +
    teamB.specialTeams +
    (venue === 'team_b' ? teamB.homeFieldAdvantage : 0)
  return {
    probabilityCalibrationVersion:
      edition.calibration?.version ?? 'fixed-logistic-v1',
    projectedMargin: round(projectedMargin, 1),
    projectedScore: {
      teamA: round(clamp(teamAScore, 0, 80), 1),
      teamB: round(clamp(teamBScore, 0, 80), 1),
    },
    teamAWinProbability: round(teamAWinProbability, 4),
    teamBWinProbability: round(1 - teamAWinProbability, 4),
  }
}

export type WeeklyMatchupScore = {
  competitiveness: number
  matchupQuality: number
  playoffImportance: number
  playoffLeverage: number
  projectedMargin: number
}

function rankingLeverage(rank: number | undefined) {
  if (rank === undefined) return 0
  return clamp(103.5 - rank * 3.5, 0, 100)
}

export function scoreWeeklyMatchup(input: {
  awayPower: number
  awayPowerRank?: number
  awayResumeRank?: number
  conferenceGame: boolean
  homeFieldAdvantage: number
  homePower: number
  homePowerRank?: number
  homeResumeRank?: number
  neutralSite: boolean
}): WeeklyMatchupScore {
  const projectedMargin =
    input.homePower -
    input.awayPower +
    (input.neutralSite ? 0 : input.homeFieldAdvantage)
  const competitiveness = clamp(100 - Math.abs(projectedMargin) * 4, 0, 100)
  const homeStrength = clamp(50 + input.homePower * 2, 0, 100)
  const awayStrength = clamp(50 + input.awayPower * 2, 0, 100)
  const pairedStrength =
    Math.max(homeStrength, awayStrength) * 0.4 +
    Math.min(homeStrength, awayStrength) * 0.6
  const matchupQuality = clamp(
    pairedStrength * 0.7 + competitiveness * 0.3,
    0,
    100,
  )
  const homeRank = Math.min(
    input.homePowerRank ?? Number.POSITIVE_INFINITY,
    input.homeResumeRank ?? Number.POSITIVE_INFINITY,
  )
  const awayRank = Math.min(
    input.awayPowerRank ?? Number.POSITIVE_INFINITY,
    input.awayResumeRank ?? Number.POSITIVE_INFINITY,
  )
  const rankScores = [
    rankingLeverage(Number.isFinite(homeRank) ? homeRank : undefined),
    rankingLeverage(Number.isFinite(awayRank) ? awayRank : undefined),
  ].sort((left, right) => right - left)
  const playoffLeverage = clamp(
    rankScores[0] * 0.6 + rankScores[1] * 0.3 + (input.conferenceGame ? 10 : 0),
    0,
    100,
  )
  const playoffImportance = clamp(
    matchupQuality * 0.55 + playoffLeverage * 0.45,
    0,
    100,
  )
  return {
    competitiveness: round(competitiveness),
    matchupQuality: round(matchupQuality),
    playoffImportance: round(playoffImportance),
    playoffLeverage: round(playoffLeverage),
    projectedMargin: round(projectedMargin, 1),
  }
}

function marginProbability(
  margin: number,
  calibration: LogisticMarginCalibration | undefined,
) {
  return calibration
    ? calibrateMargin(margin, calibration)
    : clamp(1 / (1 + Math.exp(-margin / 6.5)), 0.03, 0.97)
}

export function buildResumeRatingEdition(input: {
  games: ReadonlyArray<PowerRatingGame>
  powerEdition: PowerRatingEdition
  week: number
}): ResumeRatingEdition {
  const publishedPower = input.powerEdition.ratings.filter(
    (rating) => rating.published,
  )
  if (publishedPower.length === 0) {
    throw new Error('Résumé Rating requires published Power Ratings.')
  }
  // Separate opponent evidence from predictive priors and current availability.
  // Refitting each edition allows earlier opponents to gain/lose earned strength.
  const earnedEdition = buildPowerRatingEdition({
    cutoffAt: input.powerEdition.cutoffAt,
    season: input.powerEdition.season,
    week: input.week,
    games: input.games
      .filter(
        (game) =>
          game.completed &&
          game.season === input.powerEdition.season &&
          game.kickoffAt < input.powerEdition.cutoffAt,
      )
      .map((game) => ({ ...game, evidenceWeight: 1 })),
    teams: input.powerEdition.ratings.map((rating) => ({
      id: rating.teamId,
      name: rating.name,
      classification: rating.classification,
    })),
  })
  const referencePower = RESUME_REFERENCE_POWER
  const referenceHomeField = 2.5
  const powerByTeam = new Map(
    earnedEdition.ratings.map((rating) => [rating.teamId, rating]),
  )
  // Exclude the evaluated team's own games from opponent estimates. Otherwise
  // beating someone decisively makes that opponent look weak and can perversely
  // reduce the winner's credit. Cache one independent fit per evaluated team.
  const opponentEvidence = new Map<string, Map<string, PowerTeamRating>>()
  for (const team of publishedPower) {
    const independent = buildPowerRatingEdition({
      cutoffAt: input.powerEdition.cutoffAt,
      season: input.powerEdition.season,
      week: input.week,
      teams: input.powerEdition.ratings.map((row) => ({
        id: row.teamId,
        name: row.name,
        classification: row.classification,
      })),
      games: input.games
        .filter(
          (game) =>
            game.completed &&
            game.season === input.powerEdition.season &&
            game.kickoffAt < input.powerEdition.cutoffAt &&
            game.homeTeamId !== team.teamId &&
            game.awayTeamId !== team.teamId,
        )
        .map((game) => ({ ...game, evidenceWeight: 1 })),
    })
    opponentEvidence.set(
      team.teamId,
      new Map(independent.ratings.map((row) => [row.teamId, row])),
    )
  }
  const accumulators = new Map(
    publishedPower.map((rating) => [
      rating.teamId,
      {
        actualWins: 0,
        dominanceWins: 0,
        expectedDominanceWins: 0,
        expectedWins: 0,
        games: 0,
        power: rating,
      },
    ]),
  )

  for (const game of input.games) {
    if (
      !game.completed ||
      game.season !== input.powerEdition.season ||
      game.kickoffAt >= input.powerEdition.cutoffAt
    ) {
      continue
    }
    for (const perspective of [
      {
        actualMargin: game.homePoints - game.awayPoints,
        opponentId: game.awayTeamId,
        overtimePeriods: game.overtimePeriods,
        teamId: game.homeTeamId,
        venueMargin: game.neutralSite ? 0 : referenceHomeField,
      },
      {
        actualMargin: game.awayPoints - game.homePoints,
        opponentId: game.homeTeamId,
        overtimePeriods: game.overtimePeriods,
        teamId: game.awayTeamId,
        venueMargin: game.neutralSite ? 0 : -referenceHomeField,
      },
    ]) {
      const accumulator = accumulators.get(perspective.teamId)
      const opponent =
        opponentEvidence.get(perspective.teamId)?.get(perspective.opponentId) ??
        powerByTeam.get(perspective.opponentId)
      if (!accumulator || !opponent) continue
      const expectedMargin =
        referencePower - opponent.power + perspective.venueMargin
      const expectedProbability = marginProbability(expectedMargin, undefined)
      const dominanceMargin = clamp(
        perspective.actualMargin,
        perspective.overtimePeriods > 0 ? -7 : -21,
        perspective.overtimePeriods > 0 ? 7 : 21,
      )
      accumulator.games += 1
      accumulator.actualWins +=
        perspective.actualMargin === 0
          ? 0.5
          : perspective.actualMargin > 0
            ? 1
            : 0
      accumulator.expectedWins += expectedProbability
      const result =
        perspective.actualMargin > 0
          ? 1
          : perspective.actualMargin < 0
            ? 0
            : 0.5
      const dominance = marginProbability(dominanceMargin, undefined)
      // Bound each game's contribution by its result: a loss never earns credit
      // and a win never costs credit, even against a very weak opponent.
      const performanceCredit =
        result > 0.5
          ? (1 - expectedProbability) * (2 * dominance - 1)
          : result < 0.5
            ? -expectedProbability * (1 + (1 - 2 * dominance))
            : 0.5 - expectedProbability
      accumulator.dominanceWins += performanceCredit
      accumulator.expectedDominanceWins += expectedProbability
    }
  }

  const ratings = [...accumulators.values()].map(
    (accumulator): Omit<ResumeTeamRating, 'resumeRank'> => {
      const scheduleComponent =
        accumulator.actualWins - accumulator.expectedWins
      const dominanceComponent = accumulator.dominanceWins
      const disagreementReasons: ResumeTeamRating['disagreementReasons'] = []
      if (Math.abs(scheduleComponent) >= 0.1) {
        disagreementReasons.push('schedule_strength')
      }
      if (
        accumulator.games > 0 &&
        Math.abs(accumulator.actualWins / accumulator.games - 0.5) >= 0.2
      ) {
        disagreementReasons.push('results')
      }
      if (Math.abs(dominanceComponent) >= 0.05) {
        disagreementReasons.push('dominance')
      }
      if (accumulator.power.priorWeight >= 0.25) {
        disagreementReasons.push('roster_prior')
      }
      return {
        actualWins: round(accumulator.actualWins, 3),
        disagreementReasons,
        dominanceComponent: round(dominanceComponent, 3),
        expectedWins: round(accumulator.expectedWins, 3),
        limitedSample: accumulator.games < 5,
        name: accumulator.power.name,
        powerRank: accumulator.power.rank,
        resume: round(
          scheduleComponent * (1 - RESUME_DOMINANCE_WEIGHT) +
            dominanceComponent * RESUME_DOMINANCE_WEIGHT,
          3,
        ),
        scheduleComponent: round(scheduleComponent, 3),
        teamId: accumulator.power.teamId,
      }
    },
  )
  const ranked = ratings.sort(
    (left, right) =>
      Math.round(right.resume * 100) - Math.round(left.resume * 100) ||
      left.teamId.localeCompare(right.teamId),
  )
  // Rank tied groups together to avoid non-transitive pairwise head-to-head
  // comparators when A beats B, B beats C, and C beats A.
  for (let start = 0; start < ranked.length;) {
    let end = start + 1
    while (
      end < ranked.length &&
      Math.round(ranked[end].resume * 100) ===
        Math.round(ranked[start].resume * 100)
    )
      end++
    const group = ranked.slice(start, end)
    const ids = new Set(group.map((row) => row.teamId))
    const records = new Map(group.map((row) => [row.teamId, 0]))
    for (const game of input.games) {
      if (
        !game.completed ||
        game.season !== input.powerEdition.season ||
        game.kickoffAt >= input.powerEdition.cutoffAt ||
        !ids.has(game.homeTeamId) ||
        !ids.has(game.awayTeamId)
      )
        continue
      const result = Math.sign(game.homePoints - game.awayPoints)
      records.set(game.homeTeamId, (records.get(game.homeTeamId) ?? 0) + result)
      records.set(game.awayTeamId, (records.get(game.awayTeamId) ?? 0) - result)
    }
    group.sort(
      (a, b) =>
        (records.get(b.teamId) ?? 0) - (records.get(a.teamId) ?? 0) ||
        a.expectedWins - b.expectedWins ||
        b.actualWins - a.actualWins ||
        a.teamId.localeCompare(b.teamId),
    )
    ranked.splice(start, group.length, ...group)
    start = end
  }
  const rankedRows = ranked.map((rating, index): ResumeTeamRating => {
    const resumeRank = index + 1
    const rankDifference =
      rating.powerRank === undefined ? undefined : rating.powerRank - resumeRank
    return {
      ...rating,
      disagreementReasons:
        rankDifference !== undefined && Math.abs(rankDifference) >= 5
          ? [...rating.disagreementReasons, 'opponent_adjusted_performance']
          : rating.disagreementReasons,
      rankDifference,
      resumeRank,
    }
  })

  return {
    cutoffAt: input.powerEdition.cutoffAt,
    modelVersion: RESUME_MODEL_VERSION,
    ratings: rankedRows,
    referencePower: round(referencePower),
    season: input.powerEdition.season,
    visible: input.week >= 7,
    week: input.week,
  }
}
