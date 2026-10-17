import { Link } from '@tanstack/react-router'
import { CircleAlert, UserRoundPlus, X } from 'lucide-react'
import { derivePositionRoom } from '../../../convex/playerDomain'
import type { RosterEntry } from '~/features/roster/useMichiganRoster'
import type {
  RosterEligibilityBand,
  RosterGroup,
} from '~/features/michigan/rosterSheetModel'
import { useMichiganRoster } from '~/features/roster/useMichiganRoster'
import {
  ROSTER_GROUPS,
  ROSTER_GROUP_DESCRIPTIONS,
  ROSTER_GROUP_LABELS,
  collegeYear,
  rosterEligibilityBand,
  rosterGroup,
  rosterParticipation,
} from '~/features/michigan/rosterSheetModel'
import { EmptyState } from '~/components/AppShell'

const POSITION_ORDER = [
  'QB',
  'RB',
  'HB',
  'FB',
  'WR',
  'SLOT',
  'OT',
  'LT',
  'RT',
  'OG',
  'LG',
  'RG',
  'OC',
  'C',
  'TE',
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
  'ATH',
]

const ELIGIBILITY = {
  final: {
    color: 'bg-[#f7d9d9]',
    label: 'Final year',
    description: 'Final retained season of college eligibility.',
  },
  nfl_window: {
    color: 'bg-[#fce8c9]',
    label: 'NFL window · can return',
    description:
      'Third college year or later, with college eligibility remaining. This is an experience band, not a confirmed NFL declaration.',
  },
  underclassman: {
    color: 'bg-[#dfedd5]',
    label: 'Underclassmen · years 1–2',
    description:
      'First or second college year, with college eligibility remaining.',
  },
  incoming: {
    color: 'bg-[#d5e7f5]',
    label: 'Incoming recruits',
    description:
      'Confirmed commitment for the next recruiting class; not yet enrolled on this roster.',
  },
  unknown: {
    color: 'bg-white',
    label: 'Eligibility unknown',
    description: 'College enrollment or remaining eligibility is unknown.',
  },
} satisfies Record<
  RosterEligibilityBand,
  { color: string; label: string; description: string }
>

type SheetRow = {
  band: RosterEligibilityBand
  eligibleThrough: number | null
  games: number | null
  height: number | null
  id: string
  incomingSeason: number | null
  name: string
  number: number | null
  playerId: string
  position: string
  group: RosterGroup
  roleUnassigned: boolean
  snaps: number | null
  participationNote: string | null
  status: string | null
  weight: number | null
  year: number | null
}

type Comparison = { ids: Array<string>; toggle: (id: string) => void }
type Filters = {
  availability: string
  eligibility: string
  entryMethod: string
  experience: string
  quality: string
  role: string
  room: string
  scholarship: string
  search: string
}

export function RosterSheet({
  comparison,
  entries,
  filters,
  rosterPlayerIds,
  season,
}: {
  comparison: Comparison
  entries: Array<RosterEntry & { player: NonNullable<RosterEntry['player']> }>
  filters: Filters
  rosterPlayerIds: Array<string>
  season: number
}) {
  const incoming = useMichiganRoster(season + 1)
  const rows: Array<SheetRow> = entries.map((entry) => {
    const participation = rosterParticipation(entry.season)
    return {
      band: rosterEligibilityBand({
        eligibleThroughSeason: entry.eligibility.eligibleThroughSeason,
        enrollmentSeason: entry.season.eligibilityEvidence.enrollmentSeason,
        season,
      }),
      eligibleThrough: entry.eligibility.eligibleThroughSeason,
      games: participation.games,
      height: entry.season.heightInches,
      id: String(entry.season._id),
      incomingSeason: null,
      name: entry.player.displayName,
      number: entry.season.jerseyNumber,
      playerId: String(entry.player._id),
      position: entry.season.listedPosition.trim().toUpperCase(),
      group: rosterGroup({
        enrollmentSeason: entry.season.eligibilityEvidence.enrollmentSeason,
        role: entry.season.role,
        season,
      }),
      roleUnassigned: entry.season.role === 'unassigned',
      snaps: participation.snaps,
      participationNote: participation.description,
      status:
        entry.season.depthStatus === 'available'
          ? null
          : entry.season.depthStatus.replaceAll('_', ' '),
      weight: entry.season.weightPounds,
      year: collegeYear(
        entry.season.eligibilityEvidence.enrollmentSeason,
        season,
      ),
    }
  })
  const enrolled = new Set(rosterPlayerIds)
  const seenRecruits = new Set<string>()
  const search = filters.search.trim().toLowerCase()
  const showRecruits =
    [
      filters.availability,
      filters.eligibility,
      filters.experience,
      filters.scholarship,
    ].every((value) => value === 'all') &&
    (filters.role === 'all' || filters.role === 'recruit')
  if (showRecruits) {
    for (const { commitment, player } of incoming.data?.commitments ?? []) {
      if (
        !player ||
        commitment.status !== 'committed' ||
        enrolled.has(String(player._id)) ||
        seenRecruits.has(String(player._id))
      )
        continue
      const position = commitment.initialPosition.trim().toUpperCase()
      if (
        search &&
        !player.displayName.toLowerCase().includes(search) &&
        !position.toLowerCase().includes(search)
      )
        continue
      if (
        filters.room !== 'all' &&
        derivePositionRoom(position) !== filters.room
      )
        continue
      if (
        filters.entryMethod !== 'all' &&
        player.entryMethod !== filters.entryMethod
      )
        continue
      if (
        filters.quality !== 'all' &&
        commitment.dataQuality !== filters.quality
      )
        continue
      seenRecruits.add(String(player._id))
      const annual = incoming.data?.entries.find(
        (entry) => entry.season.playerId === player._id,
      )?.season
      rows.push({
        band: 'incoming',
        eligibleThrough: null,
        games: null,
        height: annual?.heightInches ?? null,
        id: String(commitment._id),
        incomingSeason: commitment.season,
        name: player.displayName,
        number: null,
        playerId: String(player._id),
        position,
        group: 'recruit',
        roleUnassigned: false,
        snaps: null,
        participationNote: null,
        status: null,
        weight: annual?.weightPounds ?? null,
        year: null,
      })
    }
  }
  const positions = [...new Set(rows.map((row) => row.position))].sort(
    (a, b) => {
      const aIndex = POSITION_ORDER.indexOf(a)
      const bIndex = POSITION_ORDER.indexOf(b)
      return (
        (aIndex < 0 ? POSITION_ORDER.length : aIndex) -
          (bIndex < 0 ? POSITION_ORDER.length : bIndex) || a.localeCompare(b)
      )
    },
  )
  return (
    <div>
      <div
        aria-label="Eligibility color legend"
        className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[#00274c]"
        role="group"
      >
        {Object.entries(ELIGIBILITY).map(([key, band]) => (
          <span
            className="inline-flex items-center gap-1"
            key={key}
            title={band.description}
          >
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 border border-black/15 ${band.color}`}
            />
            {band.label}
            {key === 'incoming' ? ` · ${season + 1}` : ''}
          </span>
        ))}
      </div>
      <details className="mb-2 text-[11px] text-[#00274c]">
        <summary className="w-fit cursor-pointer py-1 font-semibold">
          Roster group definitions
        </summary>
        <dl className="my-1 grid gap-1 sm:grid-cols-2">
          {ROSTER_GROUPS.map((group) => (
            <div key={group}>
              <dt className="inline font-bold">
                {ROSTER_GROUP_LABELS[group]}:{' '}
              </dt>
              <dd className="m-0 inline">{ROSTER_GROUP_DESCRIPTIONS[group]}</dd>
            </div>
          ))}
        </dl>
        <p className="my-1">
          Starting and rotation roles are owner-assigned. Games played alone do
          not establish meaningful playing time. Unassigned roles are
          provisional; unknown college year stays on the bench.
        </p>
        <p className="my-1">
          GP and Snaps use offense or defense by position, and special teams for
          specialists. Imported values show participation through their saved
          cutoff. When phase totals are unavailable, GP uses the annual overall
          count and Snaps stays unknown.
        </p>
      </details>
      {showRecruits && incoming.isLoading && (
        <p className="my-2 text-xs text-[var(--app-muted)]" role="status">
          Loading incoming recruits…
        </p>
      )}
      {showRecruits && incoming.isError && (
        <p className="my-2 text-xs text-amber-800" role="status">
          Incoming recruits are temporarily unavailable. Enrolled players are
          shown.
        </p>
      )}
      {rows.length === 0 && !(showRecruits && incoming.isLoading) && (
        <EmptyState title="No players match">
          Clear one or more filters to see the roster.
        </EmptyState>
      )}
      <div className="grid items-start gap-3 xl:grid-cols-2 min-[1800px]:grid-cols-3">
        {positions.map((position) => {
          const players = rows.filter((row) => row.position === position)
          const recruits = players.filter(
            (row) => row.band === 'incoming',
          ).length
          return (
            <section
              aria-label={`${position} position group`}
              className="min-w-0 overflow-hidden border border-[#00274c]/25 bg-white"
              key={position}
            >
              <h2 className="m-0 flex items-center justify-between gap-2 bg-[#00274c] px-2 py-1 font-display text-lg font-bold leading-6 text-[#ffffff]">
                <span>{position}</span>
                <span className="font-sans text-[11px] font-medium text-[#ffffff]">
                  {players.length - recruits} players
                  {recruits > 0 ? ` · ${recruits} incoming` : ''}
                </span>
              </h2>
              <div
                aria-label={`${position} player details, scroll for additional columns`}
                className="relative overflow-x-auto focus-visible:outline-offset-[-3px]"
                role="region"
                tabIndex={0}
              >
                <table className="w-[568px] table-fixed border-collapse text-left text-xs tabular-nums sm:w-full sm:min-w-[676px]">
                  <caption className="sr-only">
                    {season} {position} roster. Row colors follow the
                    eligibility legend. Year means college year from first
                    enrollment. Incoming players are the {season + 1} recruiting
                    class.
                  </caption>
                  <colgroup>
                    <col className="w-7" />
                    <col className="w-28 sm:w-44" />
                    <col className="w-[5.5rem]" />
                    <col className="w-8" />
                    <col className="w-12" />
                    <col className="w-9" />
                    <col className="w-[4.5rem]" />
                    <col className="w-14" />
                    <col className="w-16" />
                    <col className="w-8" />
                  </colgroup>
                  <thead className="bg-[#e9edf1] text-[10px] font-bold text-[#00274c]">
                    <tr>
                      <th
                        className="sticky left-0 z-10 bg-[#e9edf1] px-1 py-1 text-center"
                        scope="col"
                      >
                        #
                      </th>
                      <th
                        className="sticky left-7 z-10 bg-[#e9edf1] px-1 py-1"
                        scope="col"
                      >
                        Player
                      </th>
                      <th className="px-1 py-1" scope="col">
                        <abbr
                          className="no-underline"
                          title="Height in feet/inches / weight in pounds"
                        >
                          HT / WT
                        </abbr>
                      </th>
                      <th className="px-1 py-1 text-center" scope="col">
                        <abbr
                          className="no-underline"
                          title="Games played in the main phase when imported; otherwise overall games played"
                        >
                          GP
                        </abbr>
                      </th>
                      <th className="px-1 py-1 text-center" scope="col">
                        <abbr
                          className="no-underline"
                          title="Main-phase snaps: offense or defense by position; special teams for specialists"
                        >
                          Snaps
                        </abbr>
                      </th>
                      <th className="px-1 py-1 text-center" scope="col">
                        Year
                      </th>
                      <th className="px-1 py-1" scope="col">
                        Group
                      </th>
                      <th className="px-1 py-1 text-center" scope="col">
                        <abbr
                          className="no-underline"
                          title="Eligible through season"
                        >
                          Elig.
                        </abbr>
                      </th>
                      <th className="px-1 py-1" scope="col">
                        Status
                      </th>
                      <th scope="col">
                        <span className="sr-only">Compare</span>
                      </th>
                    </tr>
                  </thead>
                  {ROSTER_GROUPS.map((group) => {
                    const members = players.filter((row) => row.group === group)
                    if (members.length === 0) return null
                    return (
                      <tbody
                        aria-label={`${position} ${ROSTER_GROUP_LABELS[group]}`}
                        key={group}
                      >
                        <tr className="border-t-2 border-[#00274c] bg-[#e9edf1] text-[#00274c]">
                          <th
                            className="px-0 py-0.5 text-left"
                            colSpan={10}
                            scope="rowgroup"
                          >
                            <span
                              className="sticky left-0 inline-block px-2 text-[10px] font-bold uppercase tracking-wide"
                              title={ROSTER_GROUP_DESCRIPTIONS[group]}
                            >
                              {ROSTER_GROUP_LABELS[group]} · {members.length}
                            </span>
                          </th>
                        </tr>
                        {members.map((row) => (
                          <SheetPlayer
                            comparison={comparison}
                            key={row.id}
                            row={row}
                            season={season}
                          />
                        ))}
                      </tbody>
                    )
                  })}
                </table>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function SheetPlayer({
  comparison,
  row,
  season,
}: {
  comparison: Comparison
  row: SheetRow
  season: number
}) {
  const selected = comparison.ids.includes(row.playerId)
  const band = ELIGIBILITY[row.band]
  return (
    <tr className={`border-t border-[#00274c]/10 ${band.color}`}>
      <td
        className={`sticky left-0 z-10 px-1 text-center text-[11px] text-[#00274c]/70 ${band.color}`}
      >
        {row.number ?? '—'}
      </td>
      <th
        className={`sticky left-7 z-10 px-1 text-xs font-semibold sm:text-[13px] ${band.color}`}
        scope="row"
      >
        <Link
          className="block min-h-8 content-center py-1 leading-tight break-words text-[#00274c] hover:underline sm:whitespace-nowrap"
          params={{ playerId: row.playerId }}
          search={{ season: row.incomingSeason ?? season }}
          to="/michigan/players/$playerId"
        >
          {row.name}
          <span className="sr-only">
            {' '}
            · {band.label}
            {row.incomingSeason ? `, ${row.incomingSeason}` : ''}
          </span>
          {row.status && (
            <CircleAlert
              aria-label={row.status}
              className="ml-1 inline text-amber-800"
              size={12}
            />
          )}
        </Link>
      </th>
      <td className="whitespace-nowrap px-1 text-[#00274c]">
        <span className="sr-only">Height: </span>
        {row.height === null
          ? '—'
          : `${Math.floor(row.height / 12)}′${row.height % 12}″`}
        {' / '}
        <span className="sr-only">Weight in pounds: </span>
        {row.weight ?? '—'}
      </td>
      <td
        className="px-1 text-center"
        title={row.participationNote ?? undefined}
      >
        {row.games ?? '—'}
      </td>
      <td
        className="px-1 text-center"
        title={row.participationNote ?? undefined}
      >
        {row.snaps ?? '—'}
      </td>
      <td className="px-1 text-center">{row.year ?? '—'}</td>
      <td
        className="px-1 text-[11px]"
        title={
          row.roleUnassigned
            ? 'Playing role unassigned; provisional group uses college year. Unknown college year stays on the bench.'
            : ROSTER_GROUP_DESCRIPTIONS[row.group]
        }
      >
        {ROSTER_GROUP_LABELS[row.group]}
        {row.roleUnassigned && (
          <span className="block text-[10px] text-[#00274c]/70">
            Unassigned
          </span>
        )}
      </td>
      <td className="px-1 text-center">{row.eligibleThrough ?? '—'}</td>
      <td className="px-1 text-[11px] capitalize">{row.status ?? '—'}</td>
      <td>
        <button
          aria-label={`${selected ? 'Remove' : 'Add'} ${row.name} ${selected ? 'from' : 'to'} comparison`}
          aria-pressed={selected}
          className={`grid h-8 w-8 place-items-center disabled:opacity-35 ${selected ? 'bg-[#ffcb05] text-[#00274c]' : 'text-[#00274c]/60 hover:bg-[#00274c]/10'}`}
          disabled={!selected && comparison.ids.length >= 4}
          onClick={() => comparison.toggle(row.playerId)}
          type="button"
        >
          {selected ? (
            <X aria-hidden="true" size={13} />
          ) : (
            <UserRoundPlus aria-hidden="true" size={13} />
          )}
        </button>
      </td>
    </tr>
  )
}
