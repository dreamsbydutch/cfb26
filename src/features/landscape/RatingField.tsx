import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Surface,
} from '~/components/AppShell'

export function RatingField({
  kind,
  season,
  week,
}: {
  kind: 'program' | 'resume'
  season: number
  week: number
}) {
  const [view, setView] = useState<
    'current' | 'weekly' | 'selection' | 'final'
  >('current')
  const [search, setSearch] = useState('')
  const [conference, setConference] = useState('all')
  const result = useQuery(
    convexQuery(api.ratings.getRatingField, { season, week, view }),
  )
  const data = result.data
  const isProgram = kind === 'program'
  const title = isProgram ? 'State of the Program' : 'Season Résumé'
  const conferences = [
    ...new Set(data?.rows.map((row) => row.conference ?? 'Independent') ?? []),
  ].sort()
  const rows = (data?.rows ?? [])
    .filter(
      (row) =>
        row.sourceProgramName.toLowerCase().includes(search.toLowerCase()) &&
        (conference === 'all' ||
          (row.conference ?? 'Independent') === conference),
    )
    .sort((a, b) =>
      isProgram
        ? (a.programRank ?? 999) - (b.programRank ?? 999)
        : (a.resumeRank ?? 999) - (b.resumeRank ?? 999),
    )
  return (
    <Surface className="p-4 sm:p-6">
      <h2 className="font-display text-3xl font-bold">{title}</h2>
      <div className="my-5 flex flex-wrap gap-3">
        <input
          className="app-input min-w-0 flex-1 rounded-lg border p-2"
          aria-label={`Search ${title}`}
          placeholder="Search every FBS team"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="rounded-lg border p-2"
          aria-label="Ranking conference"
          value={conference}
          onChange={(event) => setConference(event.target.value)}
        >
          <option value="all">All conferences</option>
          {conferences.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
        <select
          className="rounded-lg border p-2"
          aria-label="Rating publication"
          value={view}
          onChange={(event) => setView(event.target.value as typeof view)}
        >
          <option value="current">Current edition</option>
          <option value="weekly">Frozen weekly</option>
          <option value="selection">Selection day</option>
          <option value="final">Final postseason</option>
        </select>
      </div>
      {result.isPending ? (
        <LoadingState label="Loading rankings" />
      ) : result.isError ? (
        <ErrorState>Ratings could not load: {result.error.message}</ErrorState>
      ) : !data ? (
        <EmptyState>No published edition exists for this selection.</EmptyState>
      ) : !isProgram && !data.edition.resumeVisible ? (
        <EmptyState>Résumé opens in Week 7.</EmptyState>
      ) : isProgram && !data.edition.programModelVersion ? (
        <EmptyState>
          This historical edition predates the Program rating. Its original
          rankings are preserved.
        </EmptyState>
      ) : (
        <>
          <p className="mb-3 text-sm">
            {rows.length} of {data.rows.length} FBS teams · Updated{' '}
            {new Date(data.edition.cutoffAt).toLocaleString()}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">
                {title} ratings and components
              </caption>
              <thead>
                <tr>
                  {[
                    'Rank',
                    'Program',
                    'Rating',
                    ...(isProgram
                      ? ['Results', 'Acquisition', 'Development']
                      : [
                          'Wins',
                          'Results credit',
                          'Performance credit',
                          'Season strength',
                        ]),
                  ].map((label, index) => (
                    <th
                      scope="col"
                      className={`whitespace-nowrap border-b p-3 ${index >= 3 ? 'hidden sm:table-cell' : ''}`}
                      key={label}
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
                    className={
                      row.programKey === 'michigan' ? 'michigan-accent' : ''
                    }
                  >
                    <td className="px-2 py-3 sm:p-3">
                      {isProgram ? row.programRank : row.resumeRank}
                    </td>
                    <th scope="row" className="min-w-0 px-2 py-3 sm:p-3">
                      <Link
                        to="/national/teams/$programKey"
                        params={{ programKey: row.programKey }}
                        className="font-semibold underline-offset-4 hover:underline focus-visible:outline"
                      >
                        {row.sourceProgramName}
                      </Link>
                      <div className="text-xs font-normal">
                        {row.conference ?? 'Independent'}
                        {row.classification === 'transitioning'
                          ? ' · Transitioning'
                          : ''}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] font-normal sm:hidden">
                        {(isProgram
                          ? [
                              ['Results', row.programResults?.toFixed(1)],
                              [
                                'Acquisition',
                                row.programAcquisition?.toFixed(1),
                              ],
                              [
                                'Development',
                                row.programDevelopment?.toFixed(1),
                              ],
                            ]
                          : [
                              ['Wins', String(row.actualWins)],
                              [
                                'Results credit',
                                row.scheduleComponent?.toFixed(2),
                              ],
                              [
                                'Performance credit',
                                row.dominanceComponent?.toFixed(2),
                              ],
                              [
                                'Season strength',
                                row.seasonStrength?.toFixed(1),
                              ],
                            ]
                        ).map(([label, value]) => (
                          <span className="whitespace-nowrap" key={label}>
                            {label} <b>{value ?? 'â€”'}</b>
                          </span>
                        ))}
                      </div>
                    </th>
                    <td className="whitespace-nowrap px-2 py-3 text-right font-bold sm:p-3 sm:text-left">
                      {(isProgram ? row.programRating : row.resume)?.toFixed(
                        2,
                      ) ?? '—'}
                    </td>
                    {isProgram ? (
                      <>
                        <td className="hidden p-3 sm:table-cell">
                          {row.programResults?.toFixed(1) ?? '—'}
                        </td>
                        <td className="hidden p-3 sm:table-cell">
                          {row.programAcquisition?.toFixed(1) ?? '—'}
                        </td>
                        <td className="hidden p-3 sm:table-cell">
                          {row.programDevelopment?.toFixed(1) ?? '—'}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="hidden p-3 sm:table-cell">
                          {row.actualWins}
                        </td>
                        <td className="hidden p-3 sm:table-cell">
                          {row.scheduleComponent?.toFixed(2)}
                        </td>
                        <td className="hidden p-3 sm:table-cell">
                          {row.dominanceComponent?.toFixed(2)}
                        </td>
                        <td className="hidden p-3 sm:table-cell">
                          {row.seasonStrength?.toFixed(1) ?? '—'}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && (
            <EmptyState>No teams match these filters.</EmptyState>
          )}
        </>
      )}
    </Surface>
  )
}
