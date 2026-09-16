import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { Medal } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { RankingTable, rankingControlClass } from './RankingTable'
import type { FunctionReturnType } from 'convex/server'
import { EmptyState, ErrorState, LoadingState } from '~/components/AppShell'

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
      includeProgramHonors: kind === 'program',
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
  const honorsByProgram = new Map(
    data?.honors.map((row) => [String(row.programId), row]) ?? [],
  )
  const detailHeadings = isProgram
    ? [
        'National titles',
        'Conference titles',
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
    <div className="w-fit max-w-full">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(8rem,auto)] gap-2">
        <input
          className={`${rankingControlClass} min-w-0 px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm`}
          aria-label={`Search ${title}`}
          placeholder="Search teams"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select
          className={`${rankingControlClass} min-w-0 max-w-40 px-2 py-1.5 text-xs sm:max-w-none sm:px-3 sm:py-2 sm:text-sm`}
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
          <RankingTable
            detailHeadings={detailHeadings}
            heading={`${title} · ${rows.length} of ${data.rows.length} teams`}
            primaryHeading={isProgram ? 'Program' : 'Résumé'}
            rows={rows.map((row) => {
              const record = recordByProgram.get(String(row.programId))
              const honors = honorsByProgram.get(String(row.programId))
              return {
                details: isProgram
                  ? [
                      {
                        label: 'National titles',
                        value: (
                          <NationalTitleMarks
                            currentSeason={season}
                            titleYears={honors?.nationalTitles ?? []}
                            windowSeasons={data.honorsWindowSeasons}
                          />
                        ),
                      },
                      {
                        label: 'Conference titles',
                        value: (
                          <ConferenceTitleMarks
                            currentSeason={season}
                            titleYears={honors?.conferenceTitles ?? []}
                            windowSeasons={data.honorsWindowSeasons}
                          />
                        ),
                      },
                      {
                        label: 'Results /50',
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
                    ],
                highlight: row.programKey === 'michigan',
                key: row._id,
                label: (
                  <Link
                    to="/national/teams/$programKey"
                    params={{ programKey: row.programKey }}
                    className="underline-offset-4 hover:underline focus-visible:outline"
                  >
                    {row.sourceProgramName}
                  </Link>
                ),
                primary:
                  (isProgram ? row.programRating : row.resume)?.toFixed(2) ??
                  '—',
                rank: (isProgram ? row.programRank : row.resumeRank) ?? 999,
                secondary: row.conference ?? 'Independent',
              }
            })}
          />
          {rows.length === 0 && (
            <EmptyState>No teams match these filters.</EmptyState>
          )}
        </>
      )}
    </div>
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

function NationalTitleMarks({
  currentSeason,
  titleYears,
  windowSeasons,
}: {
  currentSeason: number
  titleYears: Array<number>
  windowSeasons: number
}) {
  if (titleYears.length === 0) return '—'
  return (
    <span
      aria-label={`National championships: ${titleYears.join(', ')}`}
      className="flex min-w-12 items-center justify-end gap-0.5"
    >
      {titleYears.map((year) => (
        <img
          alt=""
          className="h-6 w-auto"
          key={year}
          src="/cfp-championship-trophy-icon.png"
          style={{ opacity: honorOpacity(year, currentSeason, windowSeasons) }}
          title={`${year} national champion`}
        />
      ))}
    </span>
  )
}

function ConferenceTitleMarks({
  currentSeason,
  titleYears,
  windowSeasons,
}: {
  currentSeason: number
  titleYears: Array<number>
  windowSeasons: number
}) {
  if (titleYears.length === 0) return '—'
  return (
    <span
      aria-label={`Conference championships: ${titleYears.join(', ')}`}
      className="flex min-w-12 items-center justify-end gap-0.5 text-amber-300"
    >
      {titleYears.map((year) => (
        <span
          key={year}
          style={{ opacity: honorOpacity(year, currentSeason, windowSeasons) }}
          title={`${year} conference champion`}
        >
          <Medal aria-hidden="true" className="size-4" />
        </span>
      ))}
    </span>
  )
}

function honorOpacity(
  honorSeason: number,
  currentSeason: number,
  windowSeasons: number,
) {
  const age = Math.max(0, currentSeason - honorSeason)
  const denominator = Math.max(1, windowSeasons - 1)
  return Math.max(0.18, 1 - (age / denominator) * 0.82)
}
