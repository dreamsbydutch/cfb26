import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { seasonLabel, teamDefinitions } from '../../../convex/teamRosterFields'
import { metricValues } from './teamRosterModel'
import type { TeamSport, TeamValues } from '../../../convex/teamRosterFields'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PublicShell,
} from '~/components/AppShell'

export function TeamRoster({ sport }: { sport: TeamSport }) {
  const [season, setSeason] = useState(new Date().getFullYear())
  const [search, setSearch] = useState('')
  const roster = useQuery(convexQuery(api.teamRosters.list, { sport, season }))
  const definition = teamDefinitions[sport]
  const entries =
    roster.data?.entries.filter(
      (entry) =>
        entry.values.status !== 'Departed' &&
        String(entry.values.name).toLowerCase().includes(search.toLowerCase()),
    ) ?? []
  const groups = [...definition.groups, { name: 'Unassigned', positions: [] }]
  const known = definition.groups.flatMap((group) => group.positions)
  return (
    <PublicShell context={sport} active={sport}>
      <main className="mx-auto max-w-[1680px] px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="app-kicker">Michigan · {seasonLabel(season)}</p>
            <h1 className="app-title mt-2">{definition.name}</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-bold">
              Season
              <select
                className="app-control ml-2 px-3 py-2"
                value={season}
                onChange={(event) => setSeason(Number(event.target.value))}
              >
                {Array.from(
                  { length: 12 },
                  (_, i) => new Date().getFullYear() + 1 - i,
                ).map((year) => (
                  <option key={year} value={year}>
                    {seasonLabel(year)}
                  </option>
                ))}
              </select>
            </label>
            <input
              aria-label="Search roster"
              className="app-control px-3 py-2 text-sm"
              placeholder="Find a player"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </header>
        {roster.isPending ? (
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
              : `The ${seasonLabel(season)} roster is ready for owner entry.`}
          </EmptyState>
        ) : (
          <div className="grid items-start gap-5 xl:grid-cols-2">
            {groups.map((group) => {
              const rows = entries
                .filter((entry) =>
                  group.name === 'Unassigned'
                    ? !known.includes(String(entry.values.position))
                    : group.positions.includes(String(entry.values.position)),
                )
                .sort((a, b) =>
                  String(a.values.name).localeCompare(String(b.values.name)),
                )
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
                  className="overflow-hidden rounded-xl border border-slate-200"
                >
                  <h2 className="flex justify-between bg-[#00274c] px-4 py-3 font-bold text-[#ffffff]">
                    {group.name}
                    <span className="text-sm font-normal">
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
                            'Year',
                            'HT / WT',
                            'GP',
                            ...metrics,
                            ...(sport === 'hockey'
                              ? ['Hand', 'Line / pair']
                              : ['Role']),
                            'Recruit',
                          ].map((label) => (
                            <th
                              key={label}
                              className={`px-2 py-2 ${label === 'Player' ? 'sticky left-0 z-10 bg-slate-100' : ''}`}
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
                            <td className="px-2 py-3">
                              {row.values.jersey ?? '—'}
                            </td>
                            <th
                              scope="row"
                              className="sticky left-0 z-10 min-w-28 max-w-40 whitespace-normal bg-white px-2 py-3 text-sm"
                            >
                              {row.values.name}
                              <span className="block text-[10px] font-normal text-slate-500">
                                {row.values.status !== 'Active'
                                  ? row.values.status
                                  : ''}
                              </span>
                            </th>
                            <td className="px-2">
                              {row.values.position ?? '—'}
                            </td>
                            <td className="px-2">{row.values.year ?? '—'}</td>
                            <td className="px-2">
                              {height(row.values.height)} /{' '}
                              {row.values.weight ?? '—'}
                            </td>
                            <td className="px-2">{row.values.games ?? '—'}</td>
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
                            {sport === 'hockey' ? (
                              <>
                                <td className="px-2">
                                  {row.values.hand ?? '—'}
                                </td>
                                <td className="px-2">
                                  {goalie ? '—' : (row.values.line ?? '—')}
                                </td>
                              </>
                            ) : (
                              <td className="px-2">{row.values.role ?? '—'}</td>
                            )}
                            <td className="px-2">
                              {row.values.recruitRank === null
                                ? '—'
                                : `#${row.values.recruitRank}`}
                              {typeof row.values.recruitRating === 'number'
                                ? ` (${row.values.recruitRating === 1 ? '1.000' : row.values.recruitRating.toFixed(4)})`
                                : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            })}
          </div>
        )}
        {!!entries.length && (
          <p className="mt-4 text-xs text-slate-500">
            {sport === 'basketball'
              ? 'Minutes, points, rebounds and assists are per game. Shooting percentages use a 0–100 scale.'
              : 'Goalie save percentage and goals-against average are calculated from saved totals.'}{' '}
            A dash means unknown.
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
