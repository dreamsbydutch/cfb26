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
  const detailHeadings = isProgram
    ? [
        'Record',
        'Results /50',
        'Acquisition /15',
        'Development /5',
        'Honors /30',
      ]
    : [
        'Record',
        'Q1',
        'Q2',
        'Q3',
        'Q4',
        'Results contribution',
        'Performance contribution',
        'History bonus',
        'Season strength',
      ]
  return (
    <Surface className="overflow-hidden p-0">
      <div className="app-ranking-header flex items-center justify-between gap-3 border-b px-3 py-2 sm:px-4">
        <h2 className="font-display text-lg font-extrabold sm:text-xl">
          {title}
        </h2>
        {data && (
          <p className="text-right text-[10px] text-white/40 sm:text-xs">
            {rows.length} of {data.rows.length} teams
            <span className="hidden sm:inline">
              {' '}
              · {new Date(data.edition.cutoffAt).toLocaleString()}
            </span>
          </p>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,auto)] gap-2 border-b border-white/[0.07] p-2 sm:px-3">
        <input
          className="app-input min-h-9 min-w-0 rounded-lg border px-2 py-1 text-xs sm:text-sm"
          aria-label={`Search ${title}`}
          placeholder="Search teams"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className="min-h-9 min-w-0 max-w-40 rounded-lg border px-2 py-1 text-xs sm:max-w-none sm:text-sm"
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
                        className={`app-label whitespace-nowrap border-b bg-black/15 px-2 py-2 sm:px-3 ${index === 0 ? 'w-11' : index === 1 ? 'w-36 min-w-36 sm:w-48 sm:min-w-48' : index === 2 ? 'w-18 min-w-18 text-right sm:w-20 sm:min-w-20' : 'min-w-20 text-right'}`}
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
                  const details = isProgram
                    ? [
                        { label: 'Record', value: formatRecord(record) },
                        {
                          label: 'Results /50',
                          secondary:
                            row.programSustainedResults &&
                            row.programSustainedResults > 0
                              ? `includes +${row.programSustainedResults.toFixed(1)} sustained`
                              : undefined,
                          value: weighted(row.programResults, 0.5, 1),
                        },
                        {
                          label: 'Acquisition /15',
                          value: weighted(row.programAcquisition, 0.15, 1),
                        },
                        {
                          label: 'Development /5',
                          value: weighted(row.programDevelopment, 0.05, 1),
                        },
                        {
                          label: 'Honors /30',
                          secondary:
                            row.programRecentAccomplishments !== undefined &&
                            row.programLegacyAccomplishments !== undefined
                              ? `${row.programRecentAccomplishments.toFixed(1)} recent · ${row.programLegacyAccomplishments.toFixed(1)} legacy`
                              : undefined,
                          value: row.programAccomplishments?.toFixed(1) ?? '—',
                        },
                      ]
                    : [
                        { label: 'Record', value: formatRecord(record) },
                        ...(['Q1', 'Q2', 'Q3', 'Q4'] as const).map(
                          (quadrant) => ({
                            label: quadrant,
                            value: formatRecord(record?.quadrants[quadrant]),
                          }),
                        ),
                        {
                          label: 'Results contribution',
                          value: weighted(row.scheduleComponent, 0.7, 2),
                        },
                        {
                          label: 'Performance contribution',
                          value: weighted(row.dominanceComponent, 0.3, 2),
                        },
                        {
                          label: 'History bonus',
                          value: row.resumeProgramBonus?.toFixed(2) ?? '—',
                        },
                        {
                          label: 'Season strength',
                          value: row.seasonStrength?.toFixed(1) ?? '—',
                        },
                      ]
                  return (
                    <tr
                      key={row._id}
                      className={`border-t border-white/[0.07] hover:bg-white/[0.025] ${row.programKey === 'michigan' ? 'michigan-accent' : ''}`}
                    >
                      <td className="font-display app-accent-text px-2 py-1.5 text-lg font-extrabold tabular-nums sm:px-3">
                        {isProgram ? row.programRank : row.resumeRank}
                      </td>
                      <th scope="row" className="px-2 py-1.5 sm:px-3">
                        <Link
                          to="/national/teams/$programKey"
                          params={{ programKey: row.programKey }}
                          className="text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline"
                        >
                          {row.sourceProgramName}
                        </Link>
                        <div className="text-[10px] leading-3 font-normal text-white/40">
                          {row.conference ?? 'Independent'}
                          {row.classification === 'transitioning'
                            ? ' · Transitioning'
                            : ''}
                        </div>
                      </th>
                      <td className="font-display whitespace-nowrap px-2 py-1.5 text-right text-base font-extrabold tabular-nums sm:px-3">
                        {(isProgram ? row.programRating : row.resume)?.toFixed(
                          2,
                        ) ?? '—'}
                      </td>
                      {detailHeadings.map((heading) => {
                        const detail = details.find(
                          (item) => item.label === heading,
                        )
                        return (
                          <td
                            className="whitespace-nowrap px-2 py-1.5 text-right text-xs font-semibold tabular-nums text-white/70 sm:px-3"
                            key={heading}
                          >
                            {detail?.value ?? '—'}
                            {detail?.secondary ? (
                              <span className="ml-1 text-[9px] font-normal text-white/35">
                                · {detail.secondary}
                              </span>
                            ) : null}
                          </td>
                        )
                      })}
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

function weighted(
  value: number | null | undefined,
  weight: number,
  digits: number,
) {
  return value === null || value === undefined
    ? '—'
    : (value * weight).toFixed(digits)
}
