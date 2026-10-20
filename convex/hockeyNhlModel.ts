import { hockeyPlayerKey } from './hockeyDraftModel'
import type { HockeyDraft } from './hockeyDraftModel'
import type { NhlHistory, NhlStats } from './hockeyNhlFields'

export function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
function localized(value: unknown) {
  return typeof object(value).default === 'string'
    ? String(object(value).default)
    : ''
}
export function candidateIds(payload: unknown, name: string) {
  if (!Array.isArray(payload)) throw new Error('Invalid NHL search response.')
  const ids = [
    ...new Set(
      payload
        .filter(
          (entry: unknown) =>
            typeof object(entry).name === 'string' &&
            hockeyPlayerKey(String(object(entry).name)) ===
              hockeyPlayerKey(name),
        )
        .map((entry: unknown) => Number(object(entry).playerId))
        .filter((id) => Number.isSafeInteger(id) && id > 0),
    ),
  ]
  // Never choose an arbitrary player when an identity is ambiguous.
  return ids.length <= 3 ? ids : []
}

export function matchesMichiganPlayer(
  payload: unknown,
  playerId: number,
  name: string,
  season: number,
  drafts: Array<HockeyDraft>,
) {
  const player = object(payload)
  if (
    player.playerId !== playerId ||
    hockeyPlayerKey(
      `${localized(player.firstName)} ${localized(player.lastName)}`,
    ) !== hockeyPlayerKey(name)
  )
    return false
  if (!Array.isArray(player.seasonTotals))
    throw new Error('Invalid NHL player history.')
  const college = player.seasonTotals.some((entry: unknown) => {
    const row = object(entry)
    return (
      ['NCAA', 'CCHA', 'BIG10', 'BIGTEN', 'B10'].includes(
        String(row.leagueAbbrev)
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, ''),
      ) &&
      row.season === season * 10000 + season + 1 &&
      [
        'univofmichigan',
        'uofmichigan',
        'universityofmichigan',
        'michigan',
        'michiganwolverines',
      ].includes(hockeyPlayerKey(localized(row.teamName)))
    )
  })
  const draft = object(player.draftDetails)
  return (
    college ||
    drafts.some(
      (selection) =>
        selection.year === draft.year &&
        selection.overallPick === draft.overallPick &&
        selection.round === draft.round &&
        selection.year >= season - 8 &&
        selection.year <= season + 1,
    )
  )
}

function stats(value: unknown): NhlStats {
  const row = object(value)
  const metric = (key: string) =>
    typeof row[key] === 'number' && Number.isFinite(row[key]) ? row[key] : null
  return {
    gamesPlayed: metric('gamesPlayed'),
    goals: metric('goals'),
    assists: metric('assists'),
    points: metric('points'),
    plusMinus: metric('plusMinus'),
    pim: metric('pim'),
    wins: metric('wins'),
    losses: metric('losses'),
    otLosses: metric('otLosses'),
    savePctg: metric('savePctg'),
    goalsAgainstAvg: metric('goalsAgainstAvg'),
    shutouts: metric('shutouts'),
  }
}
export function normalizeNhlHistory(
  payload: unknown,
  fetchedAt: number,
): NhlHistory {
  const player = object(payload)
  if (
    !Number.isSafeInteger(player.playerId) ||
    !Array.isArray(player.seasonTotals) ||
    typeof player.position !== 'string' ||
    !localized(player.firstName) ||
    !localized(player.lastName)
  )
    throw new Error('Invalid NHL player history.')
  const seasons: NhlHistory['seasons'] = []
  for (const entry of player.seasonTotals) {
    const row = object(entry)
    if (
      row.leagueAbbrev !== 'NHL' ||
      (row.gameTypeId !== 2 && row.gameTypeId !== 3)
    )
      continue
    const season = Number(row.season)
    const year = Math.floor(season / 10000)
    if (
      !Number.isInteger(season) ||
      year < 1917 ||
      year > 2200 ||
      season % 10000 !== year + 1 ||
      !localized(row.teamName)
    )
      throw new Error('Invalid NHL season.')
    seasons.push({
      season,
      gameType: row.gameTypeId,
      team: localized(row.teamName),
      stats: stats(row),
    })
  }
  if (seasons.length > 200)
    throw new Error('NHL history exceeds expected size.')
  const totals = object(player.careerTotals)
  const totalStats = (value: unknown) =>
    Object.keys(object(value)).length ? stats(value) : null
  return {
    status: 'matched',
    playerId: Number(player.playerId),
    playerName: `${localized(player.firstName)} ${localized(player.lastName)}`,
    goalie: player.position === 'G',
    fetchedAt,
    regularSeason: totalStats(totals.regularSeason),
    playoffs: totalStats(totals.playoffs),
    // Traded seasons retain each club's row. Discard a redundant combined row.
    seasons: seasons
      .filter(
        (row) =>
          !/^(total|tot|\d+ teams?)$/i.test(row.team) ||
          !seasons.some(
            (other) =>
              other.season === row.season &&
              other.gameType === row.gameType &&
              !/^(total|tot|\d+ teams?)$/i.test(other.team),
          ),
      )
      .sort(
        (a, b) =>
          b.season - a.season ||
          a.gameType - b.gameType ||
          a.team.localeCompare(b.team),
      ),
  }
}

export function unmatchedHistory(name: string, fetchedAt: number): NhlHistory {
  return {
    status: 'unmatched',
    playerId: null,
    playerName: name,
    goalie: false,
    fetchedAt,
    regularSeason: null,
    playoffs: null,
    seasons: [],
  }
}
