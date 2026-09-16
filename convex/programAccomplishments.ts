/** Prestige policy, not predictive coefficients. A team's deepest stage counts once per season. */
export const PROGRAM_ACCOMPLISHMENT_START = 2000
export const PROGRAM_HONORS_DISPLAY_SEASONS = 15
export type ProgramAccomplishment = {
  teamId: string
  season: number
  conferenceChampion: boolean
  playoffStage: number // 0 none, 1 appearance, 2 quarterfinal, 3 semifinal, 4 finalist, 5 champion
}

export type ProgramHonorSummary = {
  teamId: string
  nationalTitles: Array<number>
  conferenceTitles: Array<number>
}

export type AccomplishmentGame = {
  homeTeamId: string
  awayTeamId: string
  homeClassification?: string
  awayClassification?: string
  homePoints?: number
  awayPoints?: number
  season: number
  kickoffAt: number
  completed: boolean
  notes?: string
}

/** Only explicit FBS event labels establish honors; ordinary bowls and FCS titles do not. */
export function accomplishmentsFromGames(
  games: ReadonlyArray<AccomplishmentGame>,
  cutoffAt: number,
): Array<ProgramAccomplishment> {
  const earned = new Map<string, ProgramAccomplishment>()
  const record = (teamId: string, season: number) => {
    const key = `${season}:${teamId}`
    if (!earned.has(key))
      earned.set(key, {
        teamId,
        season,
        conferenceChampion: false,
        playoffStage: 0,
      })
    return earned.get(key)!
  }
  for (const game of games) {
    if (
      game.season < PROGRAM_ACCOMPLISHMENT_START ||
      game.homeClassification !== 'fbs' ||
      game.awayClassification !== 'fbs' ||
      !game.completed ||
      game.kickoffAt + 6 * 3600000 >= cutoffAt ||
      !Number.isFinite(game.homePoints) ||
      !Number.isFinite(game.awayPoints) ||
      game.homePoints === game.awayPoints
    )
      continue
    const notes = game.notes ?? ''
    const winner =
      game.homePoints! > game.awayPoints! ? game.homeTeamId : game.awayTeamId
    const isPlayoff = /college football playoff|\bcfp\b/i.test(notes)
    const stage = isPlayoff
      ? /national championship/i.test(notes)
        ? 4
        : /semifinal/i.test(notes)
          ? 3
          : /quarterfinal/i.test(notes)
            ? 2
            : /first round/i.test(notes)
              ? 1
              : 0
      : /\bbcs\b.*(national )?championship/i.test(notes)
        ? 4
        : 0
    if (stage > 0) {
      for (const teamId of [game.homeTeamId, game.awayTeamId]) {
        const row = record(teamId, game.season)
        row.playoffStage = Math.max(row.playoffStage, stage)
      }
      record(winner, game.season).playoffStage = Math.max(
        record(winner, game.season).playoffStage,
        stage + 1,
      )
    } else if (
      /\b(ACC|SEC|Big Ten|Big 10|Big 12|Big XII|Pac[ -]?(10|12)|MAC|Mid-American|Mountain West|MWC|Sun Belt|Conference USA|C-USA|American|AAC)\b.*championship/i.test(
        notes,
      )
    ) {
      record(winner, game.season).conferenceChampion = true
    }
  }
  return [...earned.values()]
}

export function programAccomplishmentCredit(
  rows: ReadonlyArray<ProgramAccomplishment>,
  season: number,
) {
  const seasons = new Map<number, ProgramAccomplishment>()
  for (const row of rows) {
    if (
      !Number.isInteger(row.season) ||
      !Number.isInteger(row.playoffStage) ||
      row.playoffStage < 0 ||
      row.playoffStage > 5
    )
      throw new Error('Invalid program accomplishment.')
    if (row.season > season || row.season < PROGRAM_ACCOMPLISHMENT_START)
      continue
    const prior = seasons.get(row.season)
    seasons.set(row.season, {
      ...row,
      conferenceChampion:
        row.conferenceChampion || (prior?.conferenceChampion ?? false),
      playoffStage: Math.max(row.playoffStage, prior?.playoffStage ?? 0),
    })
  }
  let recent = 0,
    legacy = 0
  for (const row of seasons.values()) {
    const points =
      (row.conferenceChampion ? 4 : 0) + [0, 4, 6, 10, 14, 26][row.playoffStage]
    const age = season - row.season
    recent += points * 0.74 ** age
    legacy += points * 0.97 ** age
  }
  // Diminishing returns bound prestige without a hard cliff or all-time brand override.
  const recentCredit = 20 * (1 - Math.exp(-recent / 20))
  const legacyCredit = 10 * (1 - Math.exp(-legacy / 40))
  return { recentCredit, legacyCredit, total: recentCredit + legacyCredit }
}

export function programHonorsForDisplay(
  rows: ReadonlyArray<ProgramAccomplishment>,
  season: number,
  windowSeasons = PROGRAM_HONORS_DISPLAY_SEASONS,
): Array<ProgramHonorSummary> {
  if (!Number.isInteger(season) || !Number.isInteger(windowSeasons))
    throw new Error('Invalid program honors display window.')
  if (windowSeasons < 1) throw new Error('Invalid program honors display window.')
  const firstSeason = Math.max(
    PROGRAM_ACCOMPLISHMENT_START,
    season - windowSeasons + 1,
  )
  const honors = new Map<
    string,
    { nationalTitles: Set<number>; conferenceTitles: Set<number> }
  >()
  for (const row of rows) {
    if (row.season < firstSeason || row.season > season) continue
    const summary = honors.get(row.teamId) ?? {
      nationalTitles: new Set<number>(),
      conferenceTitles: new Set<number>(),
    }
    if (row.playoffStage === 5) summary.nationalTitles.add(row.season)
    if (row.conferenceChampion) summary.conferenceTitles.add(row.season)
    honors.set(row.teamId, summary)
  }
  return [...honors.entries()]
    .map(([teamId, summary]) => ({
      teamId,
      nationalTitles: [...summary.nationalTitles].sort((a, b) => b - a),
      conferenceTitles: [...summary.conferenceTitles].sort((a, b) => b - a),
    }))
    .filter(
      (row) => row.nationalTitles.length > 0 || row.conferenceTitles.length > 0,
    )
}
