import { Link } from '@tanstack/react-router'
import { CircleAlert, UserRoundPlus, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { buildLineup } from './lineupModel'
import type { LineupPlayer, LineupPosition } from './lineupModel'
import type { RosterEntry } from '~/features/roster/useMichiganRoster'
import { EmptyState } from '~/components/AppShell'

type Comparison = { ids: Array<string>; toggle: (id: string) => void }
const bands = {
  final: { color: 'bg-[#f7d9d9]', label: 'Final year' },
  nfl_window: { color: 'bg-[#fce8c9]', label: 'NFL window · can return' },
  underclassman: { color: 'bg-[#dfedd5]', label: 'Underclassmen · years 1–2' },
  incoming: { color: 'bg-[#d5e7f5]', label: 'Incoming recruits' },
  unknown: { color: 'bg-white', label: 'Eligibility unknown' },
}

export function TeamLineup({
  entries,
  rosterEntries,
  season,
  comparison,
}: {
  entries: Array<RosterEntry>
  rosterEntries: Array<RosterEntry>
  season: number
  comparison: Comparison
}) {
  const lineup = useMemo(
    () =>
      buildLineup(
        rosterEntries,
        season,
        new Set(
          entries.flatMap((entry) =>
            entry.player ? [String(entry.player._id)] : [],
          ),
        ),
      ),
    [entries, rosterEntries, season],
  )
  const [includeLimited, setIncludeLimited] = useState(false)
  const specialTeams = lineup.specialTeams
  const specialistCount = specialTeams.specialists.reduce(
    (sum, position) => sum + position.primary.length,
    0,
  )
  const regularCount =
    specialTeams.core.length + specialTeams.rotation.length + specialistCount
  return (
    <div className="text-[#00274c]">
      <nav
        aria-label="Team units"
        className="mb-2 flex flex-wrap gap-2 text-xs font-bold"
      >
        {(['Offense', 'Defense', 'Special teams'] as const).map((title) => (
          <a
            key={title}
            href={`#lineup-${title === 'Special teams' ? 'special-teams-section' : title.toLowerCase()}`}
            className="min-h-8 rounded border border-[#00274c]/20 bg-[#edf3f8] px-3 py-2 hover:bg-[#00274c]/10 focus-visible:outline-2 focus-visible:outline-[#00274c]"
          >
            {title}
          </a>
        ))}
      </nav>
      <div
        aria-label="Eligibility color legend"
        role="group"
        className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]"
      >
        {(['final', 'nfl_window', 'underclassman', 'unknown'] as const).map(
          (key) => (
            <span key={key} className="inline-flex items-center gap-1">
              <i
                aria-hidden="true"
                className={`size-2.5 border border-[#00274c]/20 ${bands[key].color}`}
              />
              {bands[key].label}
            </span>
          ),
        )}
      </div>
      <div className="grid items-start gap-3 xl:grid-cols-2">
        <Unit
          title="Offense"
          positions={lineup.offense}
          season={season}
          comparison={comparison}
        />
        <Unit
          title="Defense"
          positions={lineup.defense}
          season={season}
          comparison={comparison}
        />
      </div>
      {lineup.unmapped.length > 0 && (
        <p className="my-3 text-xs text-amber-900" role="status">
          {lineup.unmapped.length} assigned player
          {lineup.unmapped.length === 1 ? '' : 's'} cannot be placed on offense
          or defense because their position room is unknown:{' '}
          {lineup.unmapped.map((player) => player.name).join(', ')}.
        </p>
      )}
      <section
        aria-labelledby="lineup-special-teams"
        className="mt-3 scroll-mt-36 border border-[#00274c]/25"
        id="lineup-special-teams-section"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 bg-[#00274c] px-3 py-2 text-[#ffffff]">
          <h2
            id="lineup-special-teams"
            className="font-display m-0 text-xl font-bold"
          >
            Special teams
          </h2>
          <span className="text-xs">
            {regularCount} regular contributors · calculated from ST snaps
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#00274c]/20 bg-[#edf3f8] px-3 py-2 text-xs">
          <span>
            {specialTeams.cutoffs.length
              ? `Saved through ${specialTeams.cutoffs.join(' / ')} team games`
              : 'No ST snapshots'}{' '}
            · {specialTeams.recordedCount} players with known ST totals
            {specialTeams.unknownCount > 0
              ? ` · ${specialTeams.unknownCount} unknown`
              : ''}
          </span>
          <label className="flex min-h-8 cursor-pointer items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={includeLimited}
              onChange={(event) => setIncludeLimited(event.target.checked)}
              className="accent-[#00274c]"
            />{' '}
            Include limited appearances
          </label>
        </div>
        <div className="grid gap-4 p-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide">
              Specialists · most usage by position
            </h3>
            {specialTeams.specialists.length === 0 && (
              <p className="text-xs text-[#526578]">
                No specialists on this roster.
              </p>
            )}
            {specialTeams.specialists.map((position) => (
              <div key={position.position} className="mb-3">
                <h4 className="mb-1 text-xs font-bold">{position.position}</h4>
                <PlayerList
                  players={position.primary}
                  comparison={comparison}
                  season={season}
                  specialTeams
                  empty={
                    position.others.length
                      ? 'Primary specialist does not match these filters'
                      : position.unknown.length
                        ? 'ST usage unknown'
                        : 'No recorded ST appearances'
                  }
                />
                {includeLimited && position.others.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-[10px] font-bold uppercase text-[#526578]">
                      Other appearances
                    </p>
                    <PlayerList
                      players={position.others}
                      comparison={comparison}
                      season={season}
                      specialTeams
                    />
                  </div>
                )}
                {position.unknown.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[10px] font-semibold text-[#526578]">
                      {position.unknown.length} with unknown ST usage
                    </summary>
                    <PlayerList
                      players={position.unknown}
                      comparison={comparison}
                      season={season}
                      specialTeams
                    />
                  </details>
                )}
              </div>
            ))}
          </div>
          <div>
            <h3 className="mb-2 flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wide">
              <span>Core contributors</span>
              <span>{specialTeams.core.length}</span>
            </h3>
            <p className="mb-2 text-[11px] text-[#526578]">
              10+ ST snaps per team game
            </p>
            <PlayerList
              players={specialTeams.core}
              comparison={comparison}
              season={season}
              specialTeams
              empty="No players meet the core threshold."
            />
          </div>
          <div>
            <h3 className="mb-2 flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wide">
              <span>Rotation contributors</span>
              <span>{specialTeams.rotation.length}</span>
            </h3>
            <p className="mb-2 text-[11px] text-[#526578]">
              5 to under 10 ST snaps per team game
            </p>
            <PlayerList
              players={specialTeams.rotation}
              comparison={comparison}
              season={season}
              specialTeams
              empty="No players meet the rotation threshold."
            />
          </div>
        </div>
        {includeLimited && (
          <div className="border-t border-[#00274c]/20 p-3">
            <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide">
              Limited appearances · under 5 ST snaps per team game ·{' '}
              {specialTeams.limited.length}
            </h3>
            <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
              <PlayerList
                players={specialTeams.limited}
                comparison={comparison}
                season={season}
                specialTeams
                empty="No limited appearances recorded."
              />
            </div>
          </div>
        )}
        <details className="border-t border-[#00274c]/20 px-3 py-2 text-xs text-[#526578]">
          <summary className="cursor-pointer font-semibold text-[#00274c]">
            How special teams is calculated
          </summary>
          <p className="mt-2 max-w-4xl leading-5">
            ST snaps are divided by the saved number of team games, including
            games the player missed. Core contributors average at least 10;
            rotation contributors average at least 5. Specialists are ranked
            within K, P, or LS by that average, with ties shown together. These
            are usage groups; total ST snaps do not identify individual units or
            confirm starting assignments. Missing totals remain unknown. Offense
            and defense use the assigned playing roles independently.
          </p>
        </details>
      </section>
    </div>
  )
}

function Unit({
  title,
  positions,
  season,
  comparison,
}: {
  title: string
  positions: Array<LineupPosition>
  season: number
  comparison: Comparison
}) {
  const starters = positions.reduce(
    (sum, position) => sum + position.starters.length,
    0,
  )
  const rotation = positions.reduce(
    (sum, position) => sum + position.rotation.length,
    0,
  )
  return (
    <section
      id={`lineup-${title.toLowerCase()}`}
      aria-label={`${title} lineup`}
      className="min-w-0 scroll-mt-36 overflow-hidden border border-[#00274c]/25"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 bg-[#00274c] px-3 py-2 text-[#ffffff]">
        <h2 className="font-display m-0 text-xl font-bold">{title}</h2>
        <span className="text-xs">
          {starters} starters · {rotation} rotation
        </span>
      </header>
      {positions.length === 0 ? (
        <div className="p-4">
          <EmptyState title={`No ${title.toLowerCase()} lineup`}>
            No assigned starters or rotation players match this season and these
            filters.
          </EmptyState>
        </div>
      ) : (
        <table className="w-full table-fixed border-collapse text-left text-xs">
          <caption className="sr-only">
            {title} starters and rotation by listed position. Assigned roles are
            retained when a player has an availability exception.
          </caption>
          <colgroup>
            <col className="w-12 sm:w-14" />
            <col />
            <col />
          </colgroup>
          <thead className="border-b border-[#00274c]/25 bg-[#e9edf1]">
            <tr>
              <th scope="col" className="px-2 py-2">
                Pos.
              </th>
              <th scope="col" className="px-2 py-2">
                Starters
              </th>
              <th
                scope="col"
                className="border-l border-[#00274c]/15 px-2 py-2"
              >
                Rotation
              </th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
              <tr
                key={position.position}
                className="border-t-2 border-[#00274c]/25 align-top"
              >
                <th
                  scope="row"
                  className="bg-[#edf3f8] px-2 py-3 font-extrabold"
                >
                  {position.position}
                </th>
                <td className="p-1.5">
                  <PlayerList
                    players={position.starters}
                    comparison={comparison}
                    season={season}
                    empty="None assigned"
                  />
                </td>
                <td className="border-l border-[#00274c]/15 p-1.5">
                  <PlayerList
                    players={position.rotation}
                    comparison={comparison}
                    season={season}
                    empty="None assigned"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="border-t border-[#00274c]/15 px-3 py-2 text-[11px] text-[#526578]">
        Assigned roles · GP and snaps use {title.toLowerCase()} participation ·
        availability exceptions stay visible
      </p>
    </section>
  )
}

function PlayerList({
  players,
  comparison,
  season,
  specialTeams = false,
  empty = 'None',
}: {
  players: Array<LineupPlayer>
  comparison: Comparison
  season: number
  specialTeams?: boolean
  empty?: string
}) {
  if (players.length === 0)
    return <p className="px-1 py-2 text-[11px] text-[#526578]">{empty}</p>
  return (
    <>
      {players.map((player) => (
        <LineupPlayerRow
          key={player.id}
          player={player}
          comparison={comparison}
          season={season}
          specialTeams={specialTeams}
        />
      ))}
    </>
  )
}

function LineupPlayerRow({
  player,
  comparison,
  season,
  specialTeams,
}: {
  player: LineupPlayer
  comparison: Comparison
  season: number
  specialTeams: boolean
}) {
  const selected = comparison.ids.includes(player.id)
  const year =
    player.listedClass ??
    (player.year === null
      ? 'Year unknown'
      : (['FR', 'SO', 'JR', 'SR', '5TH'][player.year - 1] ??
        `${player.year}TH`))
  const participation = specialTeams ? player.specialTeams : null
  return (
    <article
      aria-label={`${player.name}, ${player.position}, ${bands[player.band].label}`}
      className={`mb-1 min-w-0 border border-[#00274c]/15 px-2 py-1.5 last:mb-0 ${bands[player.band].color}`}
    >
      <div className="flex items-start gap-1">
        <Link
          to="/michigan/players/$playerId"
          params={{ playerId: player.id }}
          search={{ season }}
          className="min-w-0 flex-1 text-[13px] font-bold leading-4 break-words hover:underline focus-visible:outline-2 focus-visible:outline-[#00274c]"
        >
          <span className="mr-1 text-[11px] font-normal text-[#526578]">
            {player.jersey === null ? '—' : `#${player.jersey}`}
          </span>
          {player.name}
        </Link>
        <button
          type="button"
          aria-label={`${selected ? 'Remove' : 'Add'} ${player.name} ${selected ? 'from' : 'to'} comparison`}
          aria-pressed={selected}
          disabled={!selected && comparison.ids.length >= 4}
          onClick={() => comparison.toggle(player.id)}
          className="-mr-1 -mt-1 flex size-6 shrink-0 items-center justify-center rounded text-[#526578] hover:bg-[#00274c]/10 focus-visible:outline-2 focus-visible:outline-[#00274c] disabled:opacity-30"
        >
          {selected ? (
            <X size={12} aria-hidden="true" />
          ) : (
            <UserRoundPlus size={12} aria-hidden="true" />
          )}
        </button>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-2 text-[10px] text-[#526578]">
        <span className="font-semibold">
          {player.position} · {year}
        </span>
        <span>
          {player.height === null
            ? '—'
            : `${Math.floor(player.height / 12)}′${player.height % 12}″`}{' '}
          / {player.weight ?? '—'} lb
        </span>
      </p>
      <p
        title={
          specialTeams
            ? participation
              ? `Special teams through ${participation.throughTeamGames} team games`
              : 'Special teams totals unknown'
            : player.participationNote
        }
        className="mt-1 text-[11px] tabular-nums"
      >
        {specialTeams ? (
          <>
            <strong>{participation?.snaps ?? '—'}</strong> ST snaps ·{' '}
            {participation?.rate == null
              ? '—'
              : participation.rate.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}{' '}
            / team game
            {participation && (
              <span className="text-[#526578]">
                {' '}
                · through {participation.throughTeamGames}
              </span>
            )}
          </>
        ) : (
          <>
            <strong>{player.games}</strong> GP ·{' '}
            <strong>{player.snaps ?? '—'}</strong> snaps
            {player.throughTeamGames !== null && (
              <span className="text-[#526578]">
                {' '}
                · through {player.throughTeamGames}
              </span>
            )}
          </>
        )}
      </p>
      {player.availability !== 'available' && (
        <p
          className={`mt-1 text-[10px] font-semibold ${player.availability === 'out' ? 'text-red-800' : 'text-amber-900'}`}
          title={player.availabilityNote ?? undefined}
        >
          <CircleAlert aria-hidden="true" size={10} className="mr-1 inline" />
          {player.availability === 'unknown'
            ? 'Availability unknown'
            : player.availability === 'limited'
              ? 'Limited'
              : 'Out'}
          {player.availabilityNote ? ` · ${player.availabilityNote}` : ''}
        </p>
      )}
    </article>
  )
}
