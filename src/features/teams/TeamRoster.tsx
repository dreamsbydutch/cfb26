import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { seasonLabel, teamDefinitions } from '../../../convex/teamRosterFields'
import { hockeyPlayerKey } from '../../../convex/hockeyDraftModel'
import { metricValues } from './teamRosterModel'
import { compareSeasonPlayers } from './teamSeasonModel'
import { TeamSchedule } from './TeamSchedule'
import { SeasonHome } from './SeasonHome'
import { useTeamSchedule } from './useTeamSchedule'
import { HockeyDraftCell } from './HockeyDraftCell'
import { HockeyNhlCareer } from './HockeyNhlCareer'
import type { TeamSport, TeamValues } from '../../../convex/teamRosterFields'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PublicShell,
} from '~/components/AppShell'

export function TeamRoster({ sport }: { sport: TeamSport }) {
  const [season, setSeason] = useState(() => {
    const value =
      typeof window === 'undefined'
        ? NaN
        : Number(new URLSearchParams(window.location.search).get('season'))
    return Number.isInteger(value) &&
      value >= 2005 &&
      value <= new Date().getFullYear() + 1
      ? value
      : new Date().getFullYear()
  })
  const [search, setSearch] = useState('')
  const [view, setView] = useState<'season' | 'roster' | 'schedule'>(() => {
    const value =
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('view')
    return value === 'roster' || value === 'schedule' ? value : 'season'
  })
  const schedule = useTeamSchedule(sport, season)
  const changeView = (value: 'season' | 'roster' | 'schedule') => {
    setView(value)
    updateUrl('view', value)
  }
  const roster = useQuery(
    convexQuery(api.teamRosters.list, { sport, season, liveStats: true }),
  )
  const hockeyDrafts = useQuery(
    convexQuery(
      api.hockeyDrafts.forSeason,
      sport === 'hockey' && view === 'roster' ? { season } : 'skip',
    ),
  )
  const draftByPlayer = new Map(
    hockeyDrafts.data?.map((player) => [player.playerKey, player.selections]),
  )
  const projectionByPlayer = new Map(
    hockeyDrafts.data?.map((player) => [player.playerKey, player.projection]),
  )
  const definition = teamDefinitions[sport]
  const entries =
    roster.data?.entries.filter(
      (entry) =>
        entry.values.status !== 'Departed' &&
        String(entry.values.name).toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  const groups = [...definition.groups, { name: 'Unassigned', positions: [] }]
  const columns =
    sport === 'hockey'
      ? [
          groups.filter((group) => group.name === 'Forwards'),
          groups.filter((group) =>
            ['Defensemen', 'Goalies'].includes(group.name),
          ),
          groups.filter((group) => group.name === 'Unassigned'),
        ]
      : groups.map((group) => [group])
  const known = definition.groups.flatMap((group) => group.positions)
  return (
    <PublicShell context={sport} active={sport}>
      <main className="mx-auto w-full max-w-[1680px] px-2 py-1.5 sm:px-4 lg:px-6">
        <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h1 className="m-0 text-2xl font-extrabold text-[#00274c] sm:text-3xl">
            Michigan {sport === 'basketball' ? 'basketball' : 'hockey'}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-bold">
              Season
              <select
                className="min-h-9 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs ml-2"
                value={season}
                onChange={(event) => {
                  setSeason(Number(event.target.value))
                  updateUrl('season', event.target.value)
                }}
              >
                {Array.from(
                  { length: new Date().getFullYear() - 2003 },
                  (_, i) => new Date().getFullYear() + 1 - i,
                ).map((year) => (
                  <option key={year} value={year}>
                    {seasonLabel(year)}
                  </option>
                ))}
              </select>
            </label>
            {view === 'roster' && (
              <input
                aria-label="Search roster"
                className="min-h-9 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs"
                placeholder="Find a player"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            )}
          </div>
        </header>
        {
          <div
            className="mb-2 flex flex-wrap gap-1 border-b border-slate-200"
            role="group"
            aria-label={`${sport} view`}
          >
            {(['season', 'roster', 'schedule'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                className={`min-h-9 border-b-2 px-3 py-1.5 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 ${view === value ? 'border-[#00274c] text-[#00274c]' : 'border-transparent text-slate-500 hover:text-[#00274c]'}`}
                onClick={() => changeView(value)}
              >
                {value === 'season'
                  ? 'Season home'
                  : value === 'roster'
                    ? 'Roster & stats'
                    : 'Schedule & results'}
              </button>
            ))}
          </div>
        }
        {view === 'season' ? (
          <SeasonHome
            key={`${sport}-${season}`}
            sport={sport}
            season={season}
            roster={roster}
            schedule={schedule}
            onRoster={() => changeView('roster')}
          />
        ) : view === 'schedule' ? (
          <TeamSchedule
            key={`${sport}-${season}`}
            sport={sport}
            season={season}
            schedule={schedule}
          />
        ) : roster.isPending ? (
          <LoadingState />
        ) : roster.isError ? (
          <ErrorState>
            Could not load this roster. Reload to try again.
          </ErrorState>
        ) : entries.length === 0 ? (
          <EmptyState
            title={search ? 'No matching players' : 'No players added yet'}
          >
            {search
              ? 'Try another name.'
              : `No roster is available for ${seasonLabel(season)}.`}
          </EmptyState>
        ) : (
          <div className="grid items-start gap-3 xl:grid-cols-2">
            {columns.map((column) => {
              const sections = column
                .map((group) => {
                  const rows = entries
                    .filter((entry) =>
                      group.name === 'Unassigned'
                        ? !known.includes(String(entry.values.position))
                        : group.positions.includes(
                            String(entry.values.position),
                          ),
                    )
                    .sort((a, b) => compareSeasonPlayers(sport, a, b))
                  if (!rows.length) return null
                  const goalie = sport === 'hockey' && group.name === 'Goalies'
                  const metrics =
                    sport === 'basketball'
                      ? ['MPG', 'PPG', 'RPG', 'APG', 'FG%', '3P%', 'FT%']
                      : goalie
                        ? ['W', 'SV%', 'GAA', 'SO']
                        : ['G', 'A', 'PTS', 'SOG', 'PIM']
                  return (
                    <section
                      key={group.name}
                      className="overflow-hidden rounded border border-slate-200"
                    >
                      <h2 className="flex justify-between bg-[#00274c] px-2 py-1.5 text-xs font-bold text-[#ffffff]">
                        {group.name}
                        <span className="text-[11px] font-normal">
                          {rows.length} players
                        </span>
                      </h2>
                      <div
                        role="region"
                        aria-label={`${group.name} roster`}
                        tabIndex={0}
                        className="overflow-x-auto"
                      >
                        <table className="w-full whitespace-nowrap text-left text-xs">
                          <thead className="bg-slate-100">
                            <tr>
                              {[
                                '#',
                                'Player',
                                'Pos',
                                ...(sport === 'hockey' ? ['Hand'] : []),
                                'Year',
                                'HT / WT',
                                'GP',
                                ...metrics,
                                ...(sport === 'basketball' ? ['Role'] : []),
                                sport === 'hockey' ? 'NHL draft' : 'Recruit',
                              ].map((label) => (
                                <th
                                  key={label}
                                  className={`px-2 py-1 ${label === 'Player' ? 'sticky left-0 z-10 bg-slate-100' : ''}`}
                                >
                                  {label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr
                                key={row._id}
                                className="border-t border-slate-200 bg-white"
                              >
                                <td className="px-2 py-1.5">
                                  {row.values.jersey ?? '—'}
                                </td>
                                <th
                                  scope="row"
                                  className="sticky left-0 z-10 min-w-28 max-w-40 whitespace-normal bg-white px-2 py-1.5 text-xs"
                                >
                                  {sport === 'hockey' ? (
                                    <HockeyNhlCareer
                                      rosterId={row._id}
                                      name={String(row.values.name ?? '')}
                                    />
                                  ) : (
                                    row.values.name
                                  )}
                                  <span className="block text-[10px] font-normal text-slate-500">
                                    {row.values.status !== 'Active'
                                      ? row.values.status
                                      : ''}
                                  </span>
                                </th>
                                <td className="px-2">
                                  {row.values.position ?? '—'}
                                </td>
                                {sport === 'hockey' && (
                                  <td className="px-2">
                                    {row.values.hand ?? '—'}
                                  </td>
                                )}
                                <td className="px-2">
                                  {row.values.year ?? '—'}
                                </td>
                                <td className="px-2">
                                  {height(row.values.height)} /{' '}
                                  {row.values.weight ?? '—'}
                                </td>
                                <td className="px-2">
                                  {row.values.games ?? '—'}
                                </td>
                                {metricValues(sport, goalie, row.values).map(
                                  (value, i) => (
                                    <td
                                      key={metrics[i]}
                                      className="px-2 tabular-nums"
                                    >
                                      {value}
                                    </td>
                                  ),
                                )}
                                {sport === 'basketball' && (
                                  <td className="px-2">
                                    {row.values.role ?? '—'}
                                  </td>
                                )}
                                <td className="px-2">
                                  {sport === 'hockey' ? (
                                    <HockeyDraftCell
                                      projection={projectionByPlayer.get(
                                        hockeyPlayerKey(
                                          String(row.values.name ?? ''),
                                        ),
                                      )}
                                      selections={draftByPlayer.get(
                                        hockeyPlayerKey(
                                          String(row.values.name ?? ''),
                                        ),
                                      )}
                                      unavailable={hockeyDrafts.isError}
                                    />
                                  ) : (
                                    <>
                                      {row.values.recruitRank === null
                                        ? '—'
                                        : `#${row.values.recruitRank}`}
                                      {typeof row.values.recruitRating ===
                                      'number'
                                        ? ` (${row.values.recruitRating === 1 ? '1.000' : row.values.recruitRating.toFixed(4)})`
                                        : ''}
                                    </>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  )
                })
                .filter((section) => section !== null)
              return sections.length ? (
                <div key={column[0].name} className="grid min-w-0 gap-3">
                  {sections}
                </div>
              ) : null
            })}
          </div>
        )}
        {view === 'roster' && !!entries.length && (
          <p className="mt-2 text-[11px] text-slate-500">
            {sport === 'basketball'
              ? 'Sorted by total minutes. Minutes, points, rebounds and assists are per game. Shooting percentages use a 0–100 scale.'
              : 'Skaters are sorted by points; goalies by minutes. Goalie save percentage and goals-against average are calculated from saved totals. Select a player name for NHL career history.'}{' '}
            A dash means unknown.
            {sport === 'hockey' && (
              <>
                {' '}
                {hockeyDrafts.isError
                  ? 'Draft history could not load; reload to retry.'
                  : hockeyDrafts.isPending
                    ? 'Loading draft history…'
                    : ''}
              </>
            )}
          </p>
        )}
      </main>
    </PublicShell>
  )
}

function height(value: TeamValues[string]) {
  return typeof value === 'number'
    ? `${Math.floor(value / 12)}′${value % 12}″`
    : '—'
}

function updateUrl(key: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url)
}
