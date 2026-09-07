import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { useMichiganRoster, useSeasonalStats } from './useMichiganRoster'
import type { Id } from '../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import {
  AppShell,
  EmptyState,
  Metric,
  SectionTabs,
} from '~/components/AppShell'

type View = 'compare' | 'development' | 'grades' | 'nfl' | 'rooms'
type Profile = NonNullable<FunctionReturnType<typeof api.players.getProfile>>
const CURRENT_SEASON = new Date().getFullYear()
const SEASONS = Array.from(
  { length: CURRENT_SEASON - 2014 },
  (_, index) => CURRENT_SEASON - index,
)
const TABS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'rooms', label: 'Position rooms' },
  { id: 'development', label: 'Development' },
  { id: 'grades', label: 'Player grades' },
  { id: 'compare', label: 'Compare' },
  { id: 'nfl', label: 'NFL alumni' },
]

export function RosterApp() {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [view, setView] = useState<View>('rooms')
  const [selected, setSelected] = useState<Id<'players'> | null>(null)
  const [comparison, setComparison] = useState<Array<Id<'players'>>>([])
  const dashboard = useMichiganRoster(season)
  const data = dashboard.data

  return (
    <AppShell
      active="michigan"
      eyebrow={`${season} Michigan Wolverines`}
      title="Every roster tells a story. Follow the whole one."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.14em]">
          Season
          <select
            value={season}
            onChange={(event) => setSeason(Number(event.target.value))}
            className="rounded-sm border border-slate-400 bg-white px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-[#00274c]"
          >
            {SEASONS.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <p className="max-w-xl text-right text-xs leading-5 text-slate-500">
          Owner-verified Michigan lifecycle data is separate from national
          source data and CFB26 evaluations.
        </p>
      </div>

      {dashboard.isLoading ? (
        <RosterLoading />
      ) : dashboard.isError ? (
        <RosterError />
      ) : !data ? (
        <EmptyState>
          No Michigan record exists for {season}. Source health preserves the
          last valid season instead of fabricating an empty roster.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Metric label="Rostered" value={data.entries.length} />
            <Metric label="Scholarships" value={data.scholarship.counted} />
            <Metric label="Exempt" value={data.scholarship.exempt} />
            <Metric label="Unknown" value={data.scholarship.unknown} />
            <Metric
              label="Returning"
              value={
                data.returningProduction.rate === null
                  ? '—'
                  : `${Math.round(data.returningProduction.rate * 100)}%`
              }
            />
          </div>
          {data.warnings.length > 0 && (
            <aside className="mb-6 border-l-4 border-amber-500 bg-amber-50 p-4 text-sm text-amber-950">
              <div className="font-black uppercase tracking-[0.12em]">
                Data checks
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {data.warnings.slice(0, 8).map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </aside>
          )}
          <SectionTabs active={view} onChange={setView} tabs={TABS} />
          {view === 'rooms' && (
            <Rooms
              entries={data.entries}
              comparison={comparison}
              onCompare={(playerId) =>
                setComparison((current) =>
                  current.includes(playerId)
                    ? current.filter((id) => id !== playerId)
                    : current.length < 4
                      ? [...current, playerId]
                      : current,
                )
              }
              onSelect={setSelected}
            />
          )}
          {view === 'development' && <Development data={data} />}
          {view === 'grades' && (
            <Grades season={season} onSelect={setSelected} />
          )}
          {view === 'compare' && (
            <Comparison ids={comparison} onClear={() => setComparison([])} />
          )}
          {view === 'nfl' && <NflAlumni onSelect={setSelected} />}
          {selected && (
            <PlayerProfile
              playerId={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      )}
    </AppShell>
  )
}

function Rooms({
  comparison,
  entries,
  onCompare,
  onSelect,
}: {
  comparison: Array<Id<'players'>>
  entries: NonNullable<
    FunctionReturnType<typeof api.rosters.getSeasonDashboard>
  >['entries']
  onCompare: (id: Id<'players'>) => void
  onSelect: (id: Id<'players'>) => void
}) {
  const rooms = useMemo(() => {
    const grouped = new Map<string, typeof entries>()
    for (const entry of entries) {
      const rows = grouped.get(entry.season.positionRoom) ?? []
      rows.push(entry)
      grouped.set(entry.season.positionRoom, rows)
    }
    return [...grouped].sort(([left], [right]) => left.localeCompare(right))
  }, [entries])
  if (rooms.length === 0)
    return (
      <EmptyState>No Player Seasons are recorded for this season.</EmptyState>
    )
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {rooms.map(([room, rows]) => (
        <section
          key={room}
          className="overflow-hidden rounded-sm border border-slate-300 bg-white shadow-sm"
        >
          <header className="flex items-center justify-between bg-[#00274c] px-4 py-3 text-white">
            <h2 className="font-serif text-xl font-black">{room}</h2>
            <span className="text-xs font-bold text-white/60">
              {rows.length} players
            </span>
          </header>
          <div className="divide-y divide-slate-200">
            {rows.map((entry) => {
              if (!entry.player) return null
              return (
                <div
                  key={entry.season._id}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-slate-50"
                >
                  <div className="w-8 text-center font-serif text-xl font-black text-[#00274c]">
                    {entry.season.jerseyNumber ?? '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelect(entry.player!._id)}
                    className="min-w-0 text-left focus-visible:outline-2 focus-visible:outline-[#00274c]"
                  >
                    <span className="block truncate font-black">
                      {entry.player.displayName}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {entry.season.listedPosition} · {entry.season.role} ·{' '}
                      {entry.season.scholarshipStatus.replace('_', ' ')}
                    </span>
                  </button>
                  <label className="flex cursor-pointer items-center gap-2 text-[10px] font-black uppercase tracking-[0.1em] text-slate-500">
                    <input
                      type="checkbox"
                      checked={comparison.includes(entry.player._id)}
                      onChange={() => onCompare(entry.player!._id)}
                      className="h-4 w-4 accent-[#00274c]"
                    />
                    Compare
                  </label>
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}

function Development({
  data,
}: {
  data: NonNullable<FunctionReturnType<typeof api.rosters.getSeasonDashboard>>
}) {
  const byRole = [
    ...data.entries.reduce((grouped, entry) => {
      grouped.set(entry.season.role, (grouped.get(entry.season.role) ?? 0) + 1)
      return grouped
    }, new Map<string, number>()),
  ]
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="rounded-sm border border-slate-300 bg-white p-5">
        <h2 className="font-serif text-2xl font-black text-[#00274c]">
          Eligibility &amp; development
        </h2>
        <div className="mt-4 divide-y divide-slate-200">
          {data.entries.map(
            (entry) =>
              entry.player && (
                <div
                  key={entry.season._id}
                  className="grid grid-cols-[1fr_auto] gap-4 py-3 text-sm"
                >
                  <div>
                    <b>{entry.player.displayName}</b>
                    <div className="text-xs text-slate-500">
                      {entry.season.positionRoom} · {entry.season.gamesPlayed}{' '}
                      games · {entry.season.starts} starts
                    </div>
                  </div>
                  <div className="text-right font-bold">
                    Through {entry.eligibility.eligibleThroughSeason}
                    <div className="text-xs font-normal text-slate-500">
                      {entry.eligibility.source}
                    </div>
                  </div>
                </div>
              ),
          )}
        </div>
      </section>
      <div className="space-y-6">
        <section className="rounded-sm border border-slate-300 bg-white p-5">
          <h2 className="font-serif text-2xl font-black text-[#00274c]">
            Role distribution
          </h2>
          <div className="mt-4 space-y-3">
            {byRole.map(([role, rows]) => (
              <div
                key={role}
                className="flex items-center justify-between border-b border-slate-200 pb-2 text-sm"
              >
                <span className="capitalize">{role}</span>
                <b>{rows}</b>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-sm border border-slate-300 bg-white p-5">
          <h2 className="font-serif text-2xl font-black text-[#00274c]">
            Commitments
          </h2>
          <div className="mt-4 space-y-2 text-sm">
            {data.commitments.length === 0
              ? 'No commitments in this season.'
              : data.commitments.map(({ commitment, player }) => (
                  <div key={commitment._id} className="flex justify-between">
                    <span>{player?.displayName ?? 'Unresolved person'}</span>
                    <b className="capitalize">{commitment.status}</b>
                  </div>
                ))}
          </div>
        </section>
      </div>
    </div>
  )
}

function Grades({
  season,
  onSelect,
}: {
  season: number
  onSelect: (id: Id<'players'>) => void
}) {
  const stats = useSeasonalStats(season)
  if (stats.isLoading) return <RosterLoading />
  const rows = stats.data ?? []
  if (rows.length === 0)
    return (
      <EmptyState>
        No CFB26 Player Grades have been entered for {season}. Unknown coverage
        is kept distinct from explicit zero snaps.
      </EmptyState>
    )
  return (
    <section className="overflow-x-auto rounded-sm border border-slate-300 bg-white">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[#00274c] text-xs uppercase tracking-[0.12em] text-white">
          <tr>
            <th className="p-4">Player</th>
            <th>Offense</th>
            <th>Defense</th>
            <th>Special teams</th>
            <th>Coverage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {rows.map(
            (row) =>
              row.player && (
                <tr key={row.player._id}>
                  <td className="p-4">
                    <button
                      type="button"
                      onClick={() => onSelect(row.player!._id)}
                      className="font-black text-[#00274c] underline decoration-[#ffcb05] decoration-2 underline-offset-4"
                    >
                      {row.player.displayName}
                    </button>
                  </td>
                  {(['offense', 'defense', 'specialTeams'] as const).map(
                    (phase) => (
                      <td key={phase} className="font-black">
                        {row.phases[phase].weightedGrade ?? '—'}
                      </td>
                    ),
                  )}
                  <td className="text-xs text-slate-500">
                    {row.playerGames.length} games ·{' '}
                    {row.phases.offense.unknownSnapGrades.length +
                      row.phases.defense.unknownSnapGrades.length +
                      row.phases.specialTeams.unknownSnapGrades.length}{' '}
                    grades without snaps
                  </td>
                </tr>
              ),
          )}
        </tbody>
      </table>
    </section>
  )
}

function Comparison({
  ids,
  onClear,
}: {
  ids: Array<Id<'players'>>
  onClear: () => void
}) {
  if (ids.length === 0)
    return (
      <EmptyState>
        Select up to four players from Position rooms, then return here.
      </EmptyState>
    )
  return <ComparisonResults ids={ids} onClear={onClear} />
}

function ComparisonResults({
  ids,
  onClear,
}: {
  ids: Array<Id<'players'>>
  onClear: () => void
}) {
  const result = useQuery(convexQuery(api.players.compare, { playerIds: ids }))
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={onClear}
          className="border border-slate-400 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em]"
        >
          Clear comparison
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {(result.data ?? []).map((row) => (
          <article
            key={row.player._id}
            className="border-t-8 border-[#ffcb05] bg-white p-5 shadow-sm"
          >
            <h2 className="font-serif text-2xl font-black text-[#00274c]">
              {row.player.displayName}
            </h2>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-500">
              {row.seasons.length} Michigan seasons
            </p>
            <dl className="mt-5 space-y-3 text-sm">
              {(['offense', 'defense', 'specialTeams'] as const).map(
                (phase) => (
                  <div
                    key={phase}
                    className="flex justify-between border-b border-slate-200 pb-2"
                  >
                    <dt className="capitalize">
                      {phase.replace('specialTeams', 'special teams')}
                    </dt>
                    <dd className="font-black">
                      {row.grades[phase].weightedGrade ?? 'Ungraded'}
                    </dd>
                  </div>
                ),
              )}
              <div className="flex justify-between">
                <dt>NFL seasons</dt>
                <dd className="font-black">{row.nfl.length}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </div>
  )
}

function NflAlumni({ onSelect }: { onSelect: (id: Id<'players'>) => void }) {
  const result = useQuery(
    convexQuery(api.players.listNflAlumni, { fromSeason: 2015, limit: 200 }),
  )
  const rows = result.data ?? []
  if (!result.isLoading && rows.length === 0)
    return (
      <EmptyState>No confirmed nflverse identities are loaded yet.</EmptyState>
    )
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map(
        (row) =>
          row.player && (
            <button
              key={row.identity._id}
              type="button"
              onClick={() => onSelect(row.player!._id)}
              className="border-l-8 border-[#00274c] bg-white p-5 text-left shadow-sm hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-[#00274c]"
            >
              <span className="font-serif text-2xl font-black text-[#00274c]">
                {row.player.displayName}
              </span>
              <span className="mt-2 block text-sm">
                {row.latestWeek
                  ? `${row.latestWeek.team} · Week ${row.latestWeek.week} · ${row.latestWeek.status.replace('_', ' ')}`
                  : 'No weekly status yet'}
              </span>
              <span className="mt-1 block text-xs text-slate-500">
                Entered via {row.identity.entryPath.replaceAll('_', ' ')} ·{' '}
                {row.seasons.reduce((sum, value) => sum + value.games, 0)} NFL
                games
              </span>
            </button>
          ),
      )}
    </div>
  )
}

function PlayerProfile({
  playerId,
  onClose,
}: {
  playerId: Id<'players'>
  onClose: () => void
}) {
  const result = useQuery(convexQuery(api.players.getProfile, { playerId }))
  const profile: Profile | undefined = result.data ?? undefined
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Player profile"
      className="fixed inset-0 z-50 flex justify-end bg-[#061b30]/70"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="h-full w-full max-w-2xl overflow-y-auto bg-[#f4f1e8] p-5 shadow-2xl sm:p-8">
        <button
          type="button"
          onClick={onClose}
          className="float-right border border-slate-400 bg-white px-3 py-2 text-xs font-black uppercase"
        >
          Close
        </button>
        {!profile ? (
          <RosterLoading />
        ) : (
          <>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Complete Michigan profile
            </p>
            <h2 className="mt-2 font-serif text-4xl font-black text-[#00274c]">
              {profile.player.displayName}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {profile.player.entrySeason}{' '}
              {profile.player.entryMethod.replace('_', ' ')} ·{' '}
              {profile.player.state}
            </p>
            <div className="mt-6 grid grid-cols-3 gap-3">
              {(['offense', 'defense', 'specialTeams'] as const).map(
                (phase) => (
                  <Metric
                    key={phase}
                    label={`${phase.replace('specialTeams', 'Special teams')} grade`}
                    value={profile.grades[phase].weightedGrade ?? '—'}
                  />
                ),
              )}
            </div>
            <h3 className="mt-8 font-serif text-2xl font-black text-[#00274c]">
              Player Seasons
            </h3>
            <div className="mt-3 divide-y divide-slate-300 border-y border-slate-300">
              {profile.seasons.map((season) => (
                <div
                  key={season._id}
                  className="grid grid-cols-[auto_1fr_auto] gap-4 py-3 text-sm"
                >
                  <b>{season.season}</b>
                  <span>
                    {season.listedPosition} · {season.role} ·{' '}
                    {season.gamesPlayed} GP / {season.starts} starts
                  </span>
                  <span>
                    eligible through {season.eligibility.eligibleThroughSeason}
                  </span>
                </div>
              ))}
            </div>
            <h3 className="mt-8 font-serif text-2xl font-black text-[#00274c]">
              Evaluations &amp; outcomes
            </h3>
            <div className="mt-3 space-y-2 text-sm">
              {profile.evaluations.map((evaluation) => (
                <div key={evaluation._id} className="bg-white p-3">
                  <b>{evaluation.provider}</b> · {evaluation.kind} ·{' '}
                  {evaluation.score ?? 'no score'} / {evaluation.scale}
                </div>
              ))}
              {profile.draft.map((draft) => (
                <div key={draft._id} className="bg-white p-3">
                  <b>
                    {draft.year} {draft.status.replaceAll('_', ' ')}
                  </b>
                  {draft.team ? ` · ${draft.team}` : ''}
                </div>
              ))}
              {profile.evaluations.length + profile.draft.length === 0 && (
                <span className="text-slate-500">
                  No evaluations or draft outcomes recorded.
                </span>
              )}
            </div>
            <h3 className="mt-8 font-serif text-2xl font-black text-[#00274c]">
              NFL career
            </h3>
            <p className="mt-2 text-sm">
              {profile.nfl.identity
                ? `${profile.nfl.seasons.length} seasons · ${profile.nfl.seasons.reduce((sum, row) => sum + row.games, 0)} games · ${profile.nfl.seasons.reduce((sum, row) => sum + row.starts, 0)} starts`
                : 'No confirmed NFL identity.'}
            </p>
          </>
        )}
      </section>
    </div>
  )
}

export function RosterLoading() {
  return (
    <div className="animate-pulse rounded-sm border border-slate-300 bg-white p-12 text-center text-sm font-bold text-slate-500">
      Loading the Michigan intelligence layer…
    </div>
  )
}

export function RosterError() {
  return (
    <AppShell
      active="michigan"
      eyebrow="Data unavailable"
      title="The last valid roster could not be loaded."
    >
      <EmptyState>
        Check the Convex connection and source-health dashboard. No empty
        response has replaced retained data.
      </EmptyState>
    </AppShell>
  )
}
