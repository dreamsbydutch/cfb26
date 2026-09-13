import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Surface,
} from '~/components/AppShell'

export function RatingField({
  kind,
  records,
  season,
  week,
}: {
  kind: 'program' | 'resume'
  records: FunctionReturnType<typeof api.ratings.getWeeklyDashboard>['ratings']
  season: number
  week: number
}) {
  const [search, setSearch] = useState('')
  const [conference, setConference] = useState('all')
  const result = useQuery(
    convexQuery(api.ratings.getRatingField, {
      season,
      week,
      view: 'current',
    }),
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
  const recordByProgram = new Map(
    records.map((row) => [String(row.programId), row.record]),
  )
  const detailHeadings = [
    'Record',
    'Q1',
    'Q2',
    'Q3',
    'Q4',
    ...(isProgram
      ? ['Results', 'Acquisition', 'Development']
      : ['Results credit', 'Performance credit', 'Season strength']),
  ]
  return (
    <Surface className="p-3 sm:p-6">
      <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
      <div className="my-3 grid grid-cols-[minmax(0,1fr)_minmax(8rem,auto)] gap-2 sm:my-5">
        <input
          className="app-input min-w-0 rounded-lg border px-2 py-1.5 text-xs sm:p-2 sm:text-sm"
          aria-label={`Search ${title}`}
          placeholder="Search teams"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="min-w-0 max-w-40 rounded-lg border px-2 py-1.5 text-xs sm:max-w-none sm:p-2 sm:text-sm"
          aria-label="Ranking conference"
          value={conference}
          onChange={(event) => setConference(event.target.value)}
        >
          <option value="all">All conferences</option>
          {conferences.map((value) => (
            <option key={value}>{value}</option>
          ))}
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
          <p className="mb-2 text-xs sm:mb-3 sm:text-sm">
            {rows.length} of {data.rows.length} FBS teams · Updated{' '}
            {new Date(data.edition.cutoffAt).toLocaleString()}
          </p>
          <div className="overflow-x-auto">
            <table className="w-max min-w-full text-left text-sm">
              <caption className="sr-only">
                {title} ratings and components
              </caption>
              <thead>
                <tr>
                  {['Rank', 'Program', 'Rating', ...detailHeadings].map(
                    (label, index) => (
                      <th
                        scope="col"
                        className={`whitespace-nowrap border-b px-2 py-2.5 sm:px-3 ${index === 0 ? 'w-12' : index === 1 ? 'w-40 min-w-40 sm:w-52 sm:min-w-52' : index === 2 ? 'w-20 min-w-20 text-right sm:w-24 sm:min-w-24' : 'min-w-20 text-right sm:min-w-24'}`}
                        key={label}
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const record = recordByProgram.get(String(row.programId))
                  const details = [
                    { label: 'Record', value: formatRecord(record) },
                    ...(['Q1', 'Q2', 'Q3', 'Q4'] as const).map((quadrant) => ({
                      label: quadrant,
                      value: formatRecord(record?.quadrants[quadrant]),
                    })),
                    ...(isProgram
                      ? [
                          {
                            label: 'Results',
                            value: row.programResults?.toFixed(1) ?? '—',
                          },
                          {
                            label: 'Acquisition',
                            value: row.programAcquisition?.toFixed(1) ?? '—',
                          },
                          {
                            label: 'Development',
                            value: row.programDevelopment?.toFixed(1) ?? '—',
                          },
                        ]
                      : [
                          {
                            label: 'Results credit',
                            value: row.scheduleComponent?.toFixed(2) ?? '—',
                          },
                          {
                            label: 'Performance credit',
                            value: row.dominanceComponent?.toFixed(2) ?? '—',
                          },
                          {
                            label: 'Season strength',
                            value: row.seasonStrength?.toFixed(1) ?? '—',
                          },
                        ]),
                  ]
                  return (
                    <tr
                      key={row._id}
                      className={
                        row.programKey === 'michigan' ? 'michigan-accent' : ''
                      }
                    >
                      <td className="px-2 py-2.5 sm:p-3">
                        {isProgram ? row.programRank : row.resumeRank}
                      </td>
                      <th scope="row" className="px-2 py-2.5 sm:p-3">
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
                      </th>
                      <td className="whitespace-nowrap px-2 py-2.5 text-right font-bold sm:p-3">
                        {(isProgram ? row.programRating : row.resume)?.toFixed(
                          2,
                        ) ?? '—'}
                      </td>
                      {detailHeadings.map((heading) => (
                        <td
                          className="whitespace-nowrap px-2 py-2.5 text-right font-medium tabular-nums sm:p-3"
                          key={heading}
                        >
                          {details.find((detail) => detail.label === heading)
                            ?.value ?? '—'}
                        </td>
                      ))}
                    </tr>
                  )
                })}
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

function formatRecord(
  record:
    | {
        losses: number
        ties: number
        wins: number
      }
    | undefined,
) {
  if (!record) return '—'
  return `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`
}
