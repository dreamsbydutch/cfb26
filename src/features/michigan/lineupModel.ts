import {
  collegeYear,
  rosterEligibilityBand,
  rosterParticipation,
} from './rosterSheetModel.ts'
import type { RosterEntry } from '../roster/useMichiganRoster'

type Candidate = Pick<RosterEntry, 'player' | 'season' | 'eligibility'>
type Snapshot = { gamesPlayed: number; snaps: number; throughTeamGames: number }
export type SpecialTeamsTier =
  'core' | 'rotation' | 'limited' | 'none' | 'unknown'
export const SPECIAL_TEAMS_THRESHOLDS = { core: 10, rotation: 5 } as const
const POSITIONS = [
  'QB',
  'HB',
  'FB',
  'WR',
  'SLOT',
  'TE',
  'OT',
  'LT',
  'RT',
  'OG',
  'LG',
  'RG',
  'OC',
  'C',
  'DL',
  'DT',
  'NT',
  'DE',
  'EDGE',
  'LB',
  'ILB',
  'MLB',
  'OLB',
  'CB',
  'NB',
  'S',
  'FS',
  'SS',
  'K',
  'P',
  'LS',
]
const SPECIALISTS = new Set(['K', 'P', 'LS'])

export function specialTeamsUsage(snapshot?: Snapshot) {
  if (
    !snapshot ||
    !Number.isFinite(snapshot.snaps) ||
    snapshot.snaps < 0 ||
    !Number.isFinite(snapshot.throughTeamGames) ||
    snapshot.throughTeamGames <= 0
  ) {
    return { tier: 'unknown' as const, rate: null }
  }
  const rate = snapshot.snaps / snapshot.throughTeamGames
  const tier: SpecialTeamsTier =
    rate >= SPECIAL_TEAMS_THRESHOLDS.core
      ? 'core'
      : rate >= SPECIAL_TEAMS_THRESHOLDS.rotation
        ? 'rotation'
        : rate > 0
          ? 'limited'
          : 'none'
  return { tier, rate }
}

export function lineupPosition(position: string) {
  const normalized = position.trim().toUpperCase()
  return normalized === 'RB' ? 'HB' : normalized || 'Unknown'
}

export function buildLineup(
  entries: ReadonlyArray<Candidate>,
  season: number,
  visibleIds?: ReadonlySet<string>,
) {
  const seen = new Set<string>()
  const players = entries.flatMap((entry) => {
    if (
      !entry.player ||
      entry.season.rosterStatus !== 'active' ||
      seen.has(entry.player._id)
    )
      return []
    seen.add(entry.player._id)
    const participation = rosterParticipation(entry.season)
    const specialTeams = entry.season.participationTotals?.specialTeams
    return [
      {
        id: String(entry.player._id),
        name: entry.player.displayName,
        position: lineupPosition(entry.season.listedPosition),
        jersey: entry.season.jerseyNumber,
        height: entry.season.heightInches,
        weight: entry.season.weightPounds,
        role: entry.season.role,
        phase: participation.phase,
        games: participation.games,
        snaps: participation.snaps,
        throughTeamGames: participation.throughTeamGames,
        participationNote: participation.description,
        availability: entry.season.depthStatus,
        availabilityNote: entry.season.availabilityNote ?? null,
        year: collegeYear(
          entry.season.eligibilityEvidence.enrollmentSeason,
          season,
        ),
        band: rosterEligibilityBand({
          eligibleThroughSeason: entry.eligibility.eligibleThroughSeason,
          enrollmentSeason: entry.season.eligibilityEvidence.enrollmentSeason,
          season,
        }),
        roomOrder: entry.season.roomOrder,
        specialTeams: specialTeams
          ? { ...specialTeams, ...specialTeamsUsage(specialTeams) }
          : null,
      },
    ]
  })
  const positions = (rows: typeof players) =>
    [...new Set(rows.map((row) => row.position))].sort((a, b) => {
      const left = POSITIONS.indexOf(a),
        right = POSITIONS.indexOf(b)
      return (
        (left < 0 ? POSITIONS.length : left) -
          (right < 0 ? POSITIONS.length : right) || a.localeCompare(b)
      )
    })
  const order = (a: (typeof players)[number], b: (typeof players)[number]) =>
    (a.roomOrder ?? 999) - (b.roomOrder ?? 999) ||
    (b.snaps ?? -1) - (a.snaps ?? -1) ||
    a.name.localeCompare(b.name)
  const isVisible = (row: (typeof players)[number]) =>
    !visibleIds || visibleIds.has(row.id)
  const visiblePlayers = players.filter(isVisible)
  const assigned = visiblePlayers.filter(
    (row) => row.role === 'starter' || row.role === 'rotation',
  )
  const unit = (phase: 'offense' | 'defense') => {
    const rows = assigned.filter((row) => row.phase === phase).sort(order)
    return positions(rows).map((position) => ({
      position,
      starters: rows.filter(
        (row) => row.position === position && row.role === 'starter',
      ),
      rotation: rows.filter(
        (row) => row.position === position && row.role === 'rotation',
      ),
    }))
  }
  const stOrder = (a: (typeof players)[number], b: (typeof players)[number]) =>
    (b.specialTeams?.rate ?? -1) - (a.specialTeams?.rate ?? -1) ||
    (b.specialTeams?.snaps ?? -1) - (a.specialTeams?.snaps ?? -1) ||
    a.name.localeCompare(b.name)
  const specialists = players
    .filter((row) => SPECIALISTS.has(row.position))
    .sort(stOrder)
  const coveragePlayers = visiblePlayers
    .filter((row) => !SPECIALISTS.has(row.position))
    .sort(stOrder)
  return {
    offense: unit('offense'),
    defense: unit('defense'),
    unmapped: assigned.filter((row) => row.phase === null),
    specialTeams: {
      specialists: positions(specialists.filter(isVisible)).map((position) => {
        const rows = specialists.filter((row) => row.position === position)
        const known = rows.filter(
          (row) => row.specialTeams?.rate != null && row.specialTeams.rate > 0,
        )
        const maximum = known[0]?.specialTeams?.rate
        return {
          position,
          primary: known.filter(
            (row) => row.specialTeams?.rate === maximum && isVisible(row),
          ),
          others: known.filter(
            (row) => row.specialTeams?.rate !== maximum && isVisible(row),
          ),
          unknown: rows.filter(
            (row) =>
              (!row.specialTeams || row.specialTeams.tier === 'unknown') &&
              isVisible(row),
          ),
        }
      }),
      core: coveragePlayers.filter((row) => row.specialTeams?.tier === 'core'),
      rotation: coveragePlayers.filter(
        (row) => row.specialTeams?.tier === 'rotation',
      ),
      limited: coveragePlayers.filter(
        (row) => row.specialTeams?.tier === 'limited',
      ),
      unknownCount: visiblePlayers.filter(
        (row) => !row.specialTeams || row.specialTeams.tier === 'unknown',
      ).length,
      recordedCount: visiblePlayers.filter(
        (row) => row.specialTeams && row.specialTeams.tier !== 'unknown',
      ).length,
      cutoffs: [
        ...new Set(
          visiblePlayers.flatMap((row) =>
            row.specialTeams && row.specialTeams.tier !== 'unknown'
              ? [row.specialTeams.throughTeamGames]
              : [],
          ),
        ),
      ].sort((a, b) => a - b),
    },
  }
}

export type LineupPlayer = ReturnType<
  typeof buildLineup
>['specialTeams']['core'][number]
export type LineupPosition = ReturnType<typeof buildLineup>['offense'][number]
