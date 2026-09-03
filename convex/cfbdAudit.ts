import type { CfbdGame, CfbdTeamGameStats } from './cfbdClient'

export type CfbdTeamSummary = {
  id: number
  school: string
}

export type CfbdAuditIssueCode =
  | 'DUPLICATE_GAME'
  | 'FUTURE_GAME'
  | 'INVALID_COMPLETED_SCORE'
  | 'INVALID_PARTICIPANTS'
  | 'MISSING_FBS_TEAM'
  | 'ORPHANED_STATS'
  | 'PARTICIPANT_MISMATCH'
  | 'WRONG_SEASON'

export type CfbdAuditIssue = {
  code: CfbdAuditIssueCode
  message: string
  severity: 'error' | 'warning'
}

export type CfbdSeasonAuditInput = {
  fbsTeams: Array<CfbdTeamSummary>
  games: Array<CfbdGame>
  season: number
  teamGameStats: Array<CfbdTeamGameStats>
  throughWeek: number
}

export type CfbdSeasonAuditReport = {
  counts: {
    completedGames: number
    crossDivisionGames: number
    fbsTeamsRepresented: number
    games: number
    postseasonGames: number
    teamGameStats: number
  }
  issues: Array<CfbdAuditIssue>
  ok: boolean
}

function issue(
  code: CfbdAuditIssueCode,
  message: string,
  severity: CfbdAuditIssue['severity'] = 'error',
): CfbdAuditIssue {
  return { code, message, severity }
}

export function auditCfbdSeason(
  input: CfbdSeasonAuditInput,
): CfbdSeasonAuditReport {
  const issues: Array<CfbdAuditIssue> = []
  const gameById = new Map<number, CfbdGame>()
  const duplicateIds = new Set<number>()

  for (const game of input.games) {
    if (gameById.has(game.id)) duplicateIds.add(game.id)
    else gameById.set(game.id, game)
  }
  for (const id of [...duplicateIds].sort((left, right) => left - right)) {
    issues.push(issue('DUPLICATE_GAME', `Game ${id} appears more than once.`))
  }

  const futureGames = input.games.filter(
    (game) => game.week > input.throughWeek,
  )
  if (futureGames.length > 0) {
    issues.push(
      issue(
        'FUTURE_GAME',
        `${futureGames.length} game(s) occur after Week ${input.throughWeek}.`,
      ),
    )
  }

  const wrongSeason = input.games.filter((game) => game.season !== input.season)
  if (wrongSeason.length > 0) {
    issues.push(
      issue(
        'WRONG_SEASON',
        `${wrongSeason.length} game(s) do not belong to ${input.season}.`,
      ),
    )
  }

  const invalidParticipants = input.games.filter(
    (game) => game.homeId === game.awayId || game.homeTeam === game.awayTeam,
  )
  if (invalidParticipants.length > 0) {
    issues.push(
      issue(
        'INVALID_PARTICIPANTS',
        `${invalidParticipants.length} game(s) repeat the same participant.`,
      ),
    )
  }

  const invalidScores = input.games.filter(
    (game) =>
      game.completed &&
      (game.homePoints === null ||
        game.awayPoints === null ||
        game.homePoints < 0 ||
        game.awayPoints < 0),
  )
  if (invalidScores.length > 0) {
    issues.push(
      issue(
        'INVALID_COMPLETED_SCORE',
        `${invalidScores.length} completed game(s) have invalid scores.`,
      ),
    )
  }

  const eligibleGames = input.games.filter(
    (game) => game.season === input.season && game.week <= input.throughWeek,
  )
  const representedTeamIds = new Set(
    eligibleGames.flatMap((game) => [game.homeId, game.awayId]),
  )
  const missingTeams = input.fbsTeams.filter(
    (team) => !representedTeamIds.has(team.id),
  )
  if (missingTeams.length > 0) {
    issues.push(
      issue(
        'MISSING_FBS_TEAM',
        `${missingTeams.length} FBS team(s) have no game through Week ${input.throughWeek}.`,
        'warning',
      ),
    )
  }

  const orphanedStats = input.teamGameStats.filter(
    (row) => !gameById.has(row.id),
  )
  if (orphanedStats.length > 0) {
    issues.push(
      issue(
        'ORPHANED_STATS',
        `${orphanedStats.length} box score(s) do not join to a game.`,
      ),
    )
  }

  const mismatchedStats = input.teamGameStats.filter((row) => {
    const game = gameById.get(row.id)
    if (!game) return false
    const ids = new Set(row.teams.map((team) => team.teamId))
    return !ids.has(game.homeId) || !ids.has(game.awayId)
  })
  if (mismatchedStats.length > 0) {
    issues.push(
      issue(
        'PARTICIPANT_MISMATCH',
        `${mismatchedStats.length} box score(s) disagree with game participants.`,
      ),
    )
  }

  return {
    counts: {
      completedGames: eligibleGames.filter((game) => game.completed).length,
      crossDivisionGames: eligibleGames.filter(
        (game) => game.homeClassification !== game.awayClassification,
      ).length,
      fbsTeamsRepresented: input.fbsTeams.filter((team) =>
        representedTeamIds.has(team.id),
      ).length,
      games: input.games.length,
      postseasonGames: eligibleGames.filter(
        (game) => game.seasonType === 'postseason',
      ).length,
      teamGameStats: input.teamGameStats.length,
    },
    issues,
    ok: issues.every((entry) => entry.severity !== 'error'),
  }
}
