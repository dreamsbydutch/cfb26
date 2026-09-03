import { calibrateMargin } from './ratingBacktest.ts'
import type { LogisticMarginCalibration } from './ratingBacktest.ts'

export const POWER_MODEL_VERSION = 'cfb26-power-v1'

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
  modelVersion: typeof POWER_MODEL_VERSION
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
  modelVersion: 'cfb26-resume-v1'
  ratings: Array<ResumeTeamRating>
  referencePower: number
  season: number
  visible: boolean
  week: number
}

type ScoreObservation = {
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
      !Number.isFinite(game.awayPoints)
    ) {
      throw new Error(`Game ${game.id} has an invalid score.`)
    }
    const score = robustScores(game)
    const homeObservation = {
      home: !game.neutralSite,
      opponentId: game.awayTeamId,
      score: score.home,
      teamId: game.homeTeamId,
    }
    const awayObservation = {
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

  for (let iteration = 0; iteration < 60; iteration += 1) {
    const residualWeight = (observation: ScoreObservation) => {
      const prediction =
        leagueAveragePoints +
        (offense.get(observation.teamId) ?? 0) -
        (defense.get(observation.opponentId) ?? 0) +
        (observation.home ? (homeField.get(observation.teamId) ?? 0) : 0)
      const residual = Math.abs(observation.score - prediction)
      return residual <= 17 ? 1 : 17 / residual
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

      let numerator = priorValue(team, 'offense') * priorWeight
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

      numerator = priorValue(team, 'defense') * priorWeight
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
    for (const team of input.teams) {
      const fcsMultiplier = team.classification === 'fcs' ? 2.5 : 1
      const priorWeight = (team.prior?.effectiveGames ?? 0) * fcsMultiplier
      let numerator = (team.prior?.power ?? 0) * priorWeight
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
        const weight = residual <= 21 ? 1 : 21 / residual
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
          score.home -
          score.away -
          (power.get(game.homeTeamId) ?? 0) +
          (power.get(game.awayTeamId) ?? 0)
        denominator += 1
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
    modelVersion: POWER_MODEL_VERSION,
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
  const referenceTeams = publishedPower
    .filter((rating) => rating.rank !== undefined)
    .sort((left, right) => (left.rank ?? 999) - (right.rank ?? 999))
    .slice(0, 25)
  const referencePower = mean(referenceTeams.map((rating) => rating.power))
  const referenceHomeField = mean(
    referenceTeams.map((rating) => rating.homeFieldAdvantage),
  )
  const powerByTeam = new Map(
    input.powerEdition.ratings.map((rating) => [rating.teamId, rating]),
  )
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
        venueMargin: game.neutralSite
          ? 0
          : -(powerByTeam.get(game.homeTeamId)?.homeFieldAdvantage ?? 2.5),
      },
    ]) {
      const accumulator = accumulators.get(perspective.teamId)
      const opponent = powerByTeam.get(perspective.opponentId)
      if (!accumulator || !opponent) continue
      const expectedMargin =
        referencePower - opponent.power + perspective.venueMargin
      const expectedProbability = marginProbability(
        expectedMargin,
        input.powerEdition.calibration,
      )
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
      accumulator.dominanceWins += marginProbability(
        dominanceMargin,
        input.powerEdition.calibration,
      )
      accumulator.expectedDominanceWins += expectedProbability
    }
  }

  const ratings = [...accumulators.values()].map(
    (accumulator): Omit<ResumeTeamRating, 'resumeRank'> => {
      const scheduleComponent =
        accumulator.actualWins - accumulator.expectedWins
      const dominanceComponent =
        accumulator.dominanceWins - accumulator.expectedDominanceWins
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
        resume: round(scheduleComponent * 0.9 + dominanceComponent * 0.1, 3),
        scheduleComponent: round(scheduleComponent, 3),
        teamId: accumulator.power.teamId,
      }
    },
  )
  const ranked = ratings
    .sort(
      (left, right) =>
        right.resume - left.resume || left.name.localeCompare(right.name),
    )
    .map((rating, index): ResumeTeamRating => {
      const resumeRank = index + 1
      const rankDifference =
        rating.powerRank === undefined
          ? undefined
          : rating.powerRank - resumeRank
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
    modelVersion: 'cfb26-resume-v1',
    ratings: ranked,
    referencePower: round(referencePower),
    season: input.powerEdition.season,
    visible: input.week >= 7,
    week: input.week,
  }
}
