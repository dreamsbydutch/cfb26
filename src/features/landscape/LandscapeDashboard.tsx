import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { RatingField } from './RatingField'
import type { Id } from '../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import {
  ContextBar,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageFrame,
  PageHero,
  PublicShell,
  StatusPill,
  Surface,
} from '~/components/AppShell'

export type LandscapeView =
  | 'ballot'
  | 'games'
  | 'methodology'
  | 'playoff'
  | 'power'
  | 'program'
  | 'resume'
  | 'simulator'
  | 'teams'
type Program = FunctionReturnType<typeof api.teamData.listPrograms>[number]
const CURRENT_SEASON = new Date().getFullYear()

export function LandscapeDashboard({
  programKey,
  view = 'games',
}: {
  programKey?: string
  view?: LandscapeView
}) {
  const { season, setSeason, setWeek, week } = useNationalParams()
  const dashboard = useQuery(
    convexQuery(api.ratings.getWeeklyDashboard, { season, week }),
  )
  const merit = useQuery(
    convexQuery(api.ratings.getMeritDashboard, {
      programKey: 'michigan',
      season,
      week,
    }),
  )
  const programs = useQuery(
    convexQuery(api.teamData.listPrograms, { limit: 1_000 }),
  )
  const data = dashboard.data
  return (
    <PublicShell active={view} context="national">
      <PageFrame>
        <PageHero
          eyebrow={`${season} · Week ${week} · National`}
          summary="Program measures sustained competitive health. Power predicts neutral-field strength today. Résumé rewards this season’s achievement."
          title="Three ratings. Three football questions."
        />
        <ContextBar>
          <div className="flex gap-3">
            <select
              value={season}
              onChange={(event) => setSeason(Number(event.target.value))}
              aria-label="Season"
              className={controlClass}
            >
              {Array.from({ length: CURRENT_SEASON - 2014 }, (_, index) => (
                <option key={index}>{CURRENT_SEASON - index}</option>
              ))}
            </select>
            <select
              value={week}
              onChange={(event) => setWeek(Number(event.target.value))}
              aria-label="Week"
              className={controlClass}
            >
              {Array.from({ length: 21 }, (_, index) => (
                <option key={index} value={index}>
                  Week {index}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto text-right text-xs text-white/40">
            {data?.edition
              ? `${data.edition.editionType} edition · ${data.edition.modelVersion} · ${new Date(data.edition.generatedAt).toLocaleString()}`
              : data
                ? `Complete fallback field · ${data.ratingCount} FBS teams`
                : 'Loading ranking basis'}
          </div>
        </ContextBar>
        {dashboard.isLoading ? (
          <LoadingState label="Building the selected national edition" />
        ) : dashboard.isError || !data ? (
          <EmptyState>
            No national edition is available for this selection.
          </EmptyState>
        ) : (
          <>
            {view === 'games' && <Games data={data} />}
            {view === 'power' && <Power data={data} />}
            {view === 'program' && (
              <RatingField kind="program" season={season} week={week} />
            )}
            {view === 'resume' && (
              <RatingField kind="resume" season={season} week={week} />
            )}
            {view === 'playoff' && <Playoff merit={merit.data ?? null} />}
            {view === 'teams' && (
              <Teams
                initialProgramKey={programKey}
                programs={programs.data ?? []}
                ratings={data.ratings}
                season={season}
              />
            )}
            {view === 'simulator' && (
              <Simulator programs={programs.data ?? []} season={season} />
            )}
            {view === 'ballot' && <Ballot season={season} week={week} />}
            {view === 'methodology' && <Methodology data={data} />}
          </>
        )}
      </PageFrame>
    </PublicShell>
  )
}

function Games({
  data,
}: {
  data: FunctionReturnType<typeof api.ratings.getWeeklyDashboard>
}) {
  const [lens, setLens] = useState<'quality' | 'playoff' | 'michigan'>(
    'quality',
  )
  const windows = useMemo(() => {
    const sorted = [...data.games].sort((left, right) => {
      const field =
        lens === 'quality'
          ? 'matchupQuality'
          : lens === 'playoff'
            ? 'playoffImportance'
            : 'michiganImportance'
      return left.startTime - right.startTime || right[field] - left[field]
    })
    const grouped = new Map<number, Array<(typeof data.games)[number]>>()
    for (const game of sorted) {
      const rows = grouped.get(game.startTime) ?? []
      rows.push(game)
      grouped.set(game.startTime, rows)
    }
    return [...grouped.entries()]
  }, [data.games, lens])
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['quality', 'playoff', 'michigan'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLens(option)}
              className={`${pillClass} ${lens === option ? 'app-filter-active' : 'text-white/45'}`}
            >
              {option[0].toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/40">
          Schedule badges use the complete {data.ratingCount}-team Power field.
        </p>
      </div>
      <section className="app-card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse text-sm">
            <caption className="sr-only">
              National games grouped by kickoff time
            </caption>
            <thead className="app-label bg-black/15">
              <tr>
                <th className="w-1/4 min-w-60 px-5 py-3 text-right" scope="col">
                  Away team
                </th>
                <th
                  className="w-1/2 min-w-[560px] px-4 py-3 text-center"
                  scope="col"
                >
                  Matchup · sorted by {lens}
                </th>
                <th className="w-1/4 min-w-60 px-5 py-3 text-left" scope="col">
                  Home team
                </th>
              </tr>
            </thead>
            {windows.map(([startTime, games]) => {
              const kickoff = new Date(startTime)
              return (
                <tbody key={startTime}>
                  <tr className="app-ranking-header border-y border-white/10">
                    <th className="px-4 py-2.5" colSpan={3} scope="rowgroup">
                      <div className="flex items-center gap-3">
                        <time
                          className="font-display app-accent-text text-lg font-extrabold uppercase tracking-wide"
                          dateTime={kickoff.toISOString()}
                        >
                          {kickoff.toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </time>
                        <span className="text-xs font-bold text-white/50">
                          {kickoff.toLocaleDateString([], {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                        <span className="h-px flex-1 bg-white/10" />
                        <span className="text-xs font-normal text-white/35">
                          {games.length} {games.length === 1 ? 'game' : 'games'}
                        </span>
                      </div>
                    </th>
                  </tr>
                  {games.map((game) => {
                    const highlightsMichigan =
                      isMichiganProgram(game.awaySourceName) ||
                      isMichiganProgram(game.homeSourceName)
                    return (
                      <tr
                        key={game._id}
                        className={`border-b border-white/[0.065] hover:bg-white/[0.025] ${highlightsMichigan ? 'michigan-highlight' : ''}`}
                      >
                        <td className="px-5 py-3 text-right align-middle">
                          <ScheduleTeam
                            align="right"
                            name={game.awaySourceName}
                            rank={game.awayRank}
                            rating={game.awayRating}
                          />
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <div className="grid grid-cols-[1fr_1fr_auto_1fr_1fr] items-center gap-2">
                            <GameMetric
                              active={lens === 'quality'}
                              label="Quality"
                              value={game.matchupQuality}
                            />
                            <GameMetric
                              active={lens === 'playoff'}
                              label="Playoff"
                              value={game.playoffImportance}
                            />
                            <span className="font-display app-accent-text grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-black/20 text-xs font-extrabold">
                              {game.neutralSite ? 'VS' : 'AT'}
                            </span>
                            <GameMetric
                              active={lens === 'michigan'}
                              label="Michigan"
                              tone="michigan"
                              value={game.michiganImportance}
                            />
                            <GameMetric
                              label="Home margin"
                              value={`${game.projectedMargin > 0 ? '+' : ''}${game.projectedMargin.toFixed(1)}`}
                            />
                          </div>
                          <p className="mt-1.5 text-center text-[10px] leading-4 text-white/35">
                            Week {game.week} ·{' '}
                            {game.conferenceGame
                              ? 'Conference game'
                              : 'Nonconference'}{' '}
                            ·{' '}
                            {game.neutralSite
                              ? 'Neutral site'
                              : (game.venue ?? 'Venue TBD')}
                            {game.tvOutlets?.length
                              ? ` · ${game.tvOutlets.join(', ')}`
                              : ''}
                            {' · '}
                            {game.michiganRelation}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-left align-middle">
                          <ScheduleTeam
                            name={game.homeSourceName}
                            rank={game.homeRank}
                            rating={game.homeRating}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              )
            })}
          </table>
        </div>
      </section>
    </>
  )
}

function GameMetric({
  active = false,
  label,
  tone = 'default',
  value,
}: {
  active?: boolean
  label: string
  tone?: 'default' | 'michigan'
  value: number | string
}) {
  return (
    <div
      className={`rounded-lg px-2 py-1 text-center ${active ? 'bg-white/[0.045]' : ''}`}
    >
      <b
        className={`font-display block text-lg leading-none tabular-nums ${tone === 'michigan' ? 'michigan-accent' : active ? 'app-accent-text' : 'text-white'}`}
      >
        {value}
      </b>
      <span className="mt-1 block whitespace-nowrap text-[9px] font-bold uppercase tracking-wide text-white/35">
        {label}
      </span>
    </div>
  )
}

function ScheduleTeam({
  align,
  name,
  rank,
  rating,
}: {
  align?: 'right'
  name: string
  rank?: number
  rating: number
}) {
  const highlightsMichigan = isMichiganProgram(name)
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div
        className={`font-display text-xl font-extrabold leading-tight ${highlightsMichigan ? 'michigan-accent' : 'text-white'}`}
      >
        {rank !== undefined ? (
          <span
            className={`mr-1.5 align-middle text-sm ${highlightsMichigan ? 'michigan-accent' : 'app-accent-text'}`}
          >
            #{rank}
          </span>
        ) : null}
        {name}
      </div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-white/35">
        Power{' '}
        <span className="text-sm tracking-normal text-white/70 tabular-nums">
          {rating > 0 ? '+' : ''}
          {rating.toFixed(1)}
        </span>
      </div>
    </div>
  )
}

function Power({
  data,
}: {
  data: FunctionReturnType<typeof api.ratings.getWeeklyDashboard>
}) {
  const [search, setSearch] = useState('')
  const [conference, setConference] = useState('all')
  const [view, setView] = useState<
    'current' | 'weekly' | 'selection' | 'final'
  >('current')
  const field = useQuery({
    ...convexQuery(api.ratings.getRatingField, {
      season: data.season,
      week: data.week,
      view,
    }),
    enabled: view !== 'current',
  })
  const ratingRows =
    view === 'current'
      ? data.ratings
      : (field.data?.rows ?? []).map((row) => ({
          ...row,
          rankingBasis: 'weekly_edition' as const,
          sourceSeason: data.season,
          confidence: undefined,
          signalCount: undefined,
        }))
  const conferences = [
    ...new Set(ratingRows.map((row) => row.conference).filter(Boolean)),
  ].sort()
  const rows = ratingRows
    .filter(
      (row) =>
        row.published &&
        (conference === 'all' || row.conference === conference) &&
        row.sourceProgramName
          .toLowerCase()
          .includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => (a.powerRank ?? 999) - (b.powerRank ?? 999))
    .map((row) => ({
      highlight: isMichiganProgram(row.sourceProgramName),
      label: row.sourceProgramName,
      primary: signed(row.power),
      rank: row.powerRank ?? 999,
      secondary: `${row.conference ?? 'Independent'} · ${rankingBasisLabel(row.rankingBasis, row.sourceSeason)}`,
      details: [
        { label: 'Offense', value: signed(row.offense) },
        { label: 'Defense', value: signed(row.defense) },
        {
          label: 'Special teams',
          value: row.specialTeamsAvailable
            ? signed(row.specialTeams)
            : 'Not separated',
        },
        { label: 'Home field', value: signed(row.homeFieldAdvantage) },
        {
          label: 'Prior weight',
          value: `${Math.round(row.priorWeight * 100)}%`,
        },
        {
          label: 'Evidence',
          value: row.limitedSample
            ? `Limited sample · ${row.gamesPlayed} games`
            : `${row.gamesPlayed} games`,
        },
      ],
      note: `Sources: ${row.dataSources.map(sourceLabel).join(', ')}${row.confidence === undefined ? '' : ` · coverage confidence ${row.confidence}%`}${row.signalCount === undefined ? '' : ` · ${row.signalCount} signals`}`,
    }))
  return (
    <div>
      <p className="mb-4 text-sm leading-6">
        Neutral-field strength under normal conditions. The current model uses
        game results and historical carryover; national injury and coaching
        adjustments are not yet covered consistently. Small rating gaps are
        uncertain, especially early in the season.
      </p>
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <input
          aria-label="Search Power rankings"
          className={controlClass}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search all FBS teams"
          value={search}
        />
        <select
          aria-label="Filter by conference"
          className={controlClass}
          onChange={(event) => setConference(event.target.value)}
          value={conference}
        >
          <option value="all">All conferences</option>
          {conferences.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className={controlClass}
          aria-label="Power publication"
          value={view}
          onChange={(event) => setView(event.target.value as typeof view)}
        >
          <option value="current">Current edition</option>
          <option value="weekly">Frozen weekly</option>
          <option value="selection">Selection day</option>
          <option value="final">Final postseason</option>
        </select>
      </div>
      {view !== 'current' &&
        (field.isPending ? (
          <LoadingState label="Loading Power edition" />
        ) : field.isError ? (
          <ErrorState>{field.error.message}</ErrorState>
        ) : !field.data ? (
          <EmptyState>
            No published Power edition exists for this selection.
          </EmptyState>
        ) : (
          <p className="mb-3 text-sm">
            {field.data.edition.modelVersion} ·{' '}
            {new Date(field.data.edition.cutoffAt).toLocaleString()}
          </p>
        ))}
      <RankingTable
        detailHeadings={[
          'Offense',
          'Defense',
          'Special teams',
          'Home field',
          'Prior weight',
          'Evidence',
        ]}
        heading={`DbyD CFB Power · ${rows.length} of ${ratingRows.length} teams`}
        noteHeading="Sources & coverage"
        primaryHeading="Power"
        rows={rows}
      />
    </div>
  )
}

function Playoff({
  merit,
}: {
  merit: FunctionReturnType<typeof api.ratings.getMeritDashboard>
}) {
  if (!merit?.playoff)
    return (
      <EmptyState>
        A deterministic selected-today field appears once a Résumé edition and
        season-specific playoff rules are available.
      </EmptyState>
    )
  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Field" value={merit.playoff.field.length} />
        <Metric label="Rules" value={merit.playoff.rulesVersion} />
        <Metric label="Week" value={merit.playoff.week} />
        <Metric
          label="First out"
          value={merit.playoff.firstTeamOut?.name ?? '—'}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {merit.playoff.field.map((entry) => (
          <article
            key={entry.seed}
            className={`app-card border-t-4 p-5 ${entry.program?.key === 'michigan' ? 'michigan-highlight' : 'border-white/20'}`}
          >
            <div className="flex justify-between">
              <span
                className={`font-display text-4xl font-extrabold ${entry.program?.key === 'michigan' ? 'michigan-accent' : 'app-accent-text'}`}
              >
                {entry.seed}
              </span>
              <span className="text-xs font-black uppercase text-white/35">
                {entry.bid.replace('_', ' ')}
                {entry.bye ? ' · Bye' : ''}
              </span>
            </div>
            <h2 className="font-display mt-4 text-2xl font-extrabold text-white">
              {entry.program?.name ?? 'Unknown program'}
            </h2>
            <p className="mt-2 text-sm leading-5 text-white/45">
              {entry.explanation}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}

function Teams({
  initialProgramKey,
  programs,
  ratings,
  season,
}: {
  initialProgramKey?: string
  programs: Array<Program>
  ratings: FunctionReturnType<typeof api.ratings.getWeeklyDashboard>['ratings']
  season: number
}) {
  if (initialProgramKey) {
    return (
      <ProgramProfile
        programKey={initialProgramKey}
        ratings={ratings}
        season={season}
      />
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...programs]
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((program) => (
          <Link
            className={`app-card group flex items-center justify-between gap-3 p-4 transition hover:bg-white/[0.07] ${program.key === 'michigan' ? 'michigan-highlight' : ''}`}
            key={program._id}
            params={{ programKey: program.key }}
            to="/national/teams/$programKey"
          >
            <span>
              <strong
                className={`block ${program.key === 'michigan' ? 'michigan-accent' : 'group-hover:text-white'}`}
              >
                {program.name}
              </strong>
              <small className="mt-1 block text-white/35">
                {program.conference ?? 'Independent'}
              </small>
            </span>
            <span className="font-display text-lg font-extrabold tabular-nums text-white/35">
              #
              {ratings.find((row) => row.programId === program._id)
                ?.powerRank ?? '—'}
            </span>
          </Link>
        ))}
    </div>
  )
}
export function ProgramProfile({
  programKey,
  ratings,
  season,
}: {
  programKey: string
  ratings: FunctionReturnType<typeof api.ratings.getWeeklyDashboard>['ratings']
  season: number
}) {
  const result = useQuery(
    convexQuery(api.teamData.getProgramProfile, { programKey, season }),
  )
  const data = result.data
  if (!data) return <EmptyState>No team profile is available.</EmptyState>
  const completed = data.games.filter((game) => game.completed)
  const ratingByProgram = new Map(
    ratings.map((rating) => [String(rating.programId), rating]),
  )
  const ownRating = ratingByProgram.get(String(data.program._id))
  return (
    <div>
      <Link
        className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-white/45 hover:text-white"
        to="/national/teams"
      >
        ← All teams
      </Link>
      <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
        <Surface className="p-6">
          <p
            className={`text-xs font-black uppercase tracking-[0.14em] ${data.program.key === 'michigan' ? 'michigan-accent' : 'app-accent-text'}`}
          >
            {data.program.conference ?? 'Independent'}
          </p>
          <h2 className="font-display mt-2 text-4xl font-extrabold uppercase">
            {data.program.name}
          </h2>
          <p className="mt-2 text-sm text-white/50">
            {data.program.mascot ?? 'Mascot unavailable'} ·{' '}
            {data.program.classification?.toUpperCase() ??
              'Classification unknown'}
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Metric
              label="DbyD Power"
              value={ownRating?.powerRank ? `#${ownRating.powerRank}` : '—'}
            />
            <Metric
              label="Recruit rank"
              value={data.profile?.recruitingRank ?? '—'}
            />
            <Metric
              label="Talent"
              value={data.profile?.talent?.toFixed(1) ?? '—'}
            />
            <Metric
              label="Returning PPA"
              value={
                data.profile?.returningPpa === null ||
                data.profile?.returningPpa === undefined
                  ? '—'
                  : `${Math.round(data.profile.returningPpa * 100)}%`
              }
            />
            <Metric label="Draft picks (5y)" value={data.draft.length} />
          </div>
        </Surface>
        <Surface className="p-6">
          <h3 className="font-display text-2xl font-extrabold text-white">
            Season schedule
          </h3>
          <div className="mt-4 divide-y divide-white/[0.07]">
            {data.games.map((game) => {
              const opponentId =
                game.homeProgramId === data.program._id
                  ? game.awayProgramId
                  : game.homeProgramId
              const opponentRank = ratingByProgram.get(
                String(opponentId),
              )?.powerRank
              return (
                <div
                  key={game._id}
                  className="flex justify-between gap-4 py-3 text-sm"
                >
                  <span>
                    W{game.week} ·{' '}
                    {opponentRank && opponentRank <= 50
                      ? `#${opponentRank} `
                      : ''}
                    <span
                      className={
                        isMichiganProgram(game.awaySourceName)
                          ? 'michigan-accent font-bold'
                          : undefined
                      }
                    >
                      {game.awaySourceName}
                    </span>{' '}
                    at{' '}
                    <span
                      className={
                        isMichiganProgram(game.homeSourceName)
                          ? 'michigan-accent font-bold'
                          : undefined
                      }
                    >
                      {game.homeSourceName}
                    </span>
                  </span>
                  <b>
                    {game.completed
                      ? `${game.awayPoints ?? '—'}–${game.homePoints ?? '—'}`
                      : new Date(game.startTime).toLocaleDateString()}
                  </b>
                </div>
              )
            })}
          </div>
          <p className="mt-4 text-xs text-white/40">
            {completed.length} completed games · {data.affiliations.length}{' '}
            retained affiliation editions ·{' '}
            {data.venues[0]?.venue?.name ?? 'Venue unavailable'}
          </p>
        </Surface>
      </div>
    </div>
  )
}

function Simulator({
  programs,
  season,
}: {
  programs: Array<Program>
  season: number
}) {
  const [a, setAState] = useState(() => readStringParam('teamA', 'michigan'))
  const [b, setBState] = useState(() => readStringParam('teamB', 'ohio-state'))
  const [venue, setVenueState] = useState<'neutral' | 'team_a' | 'team_b'>(
    () => {
      const value = readStringParam('venue', 'team_a')
      return value === 'neutral' || value === 'team_b' ? value : 'team_a'
    },
  )
  const [adjustment, setAdjustmentState] = useState(() =>
    readNumericParam('adjustment', 0),
  )
  const setA = (value: string) => {
    setAState(value)
    setUrlParam('teamA', value)
  }
  const setB = (value: string) => {
    setBState(value)
    setUrlParam('teamB', value)
  }
  const setVenue = (value: typeof venue) => {
    setVenueState(value)
    setUrlParam('venue', value)
  }
  const setAdjustment = (value: number) => {
    setAdjustmentState(value)
    setUrlParam('adjustment', String(value))
  }
  const result = useQuery(
    convexQuery(api.ratings.getMatchup, {
      programKeyA: a,
      programKeyB: b,
      season,
      venue,
    }),
  )
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProgramSelect programs={programs} value={a} onChange={setA} />
        <ProgramSelect programs={programs} value={b} onChange={setB} />
        <select
          value={venue}
          onChange={(event) => setVenue(event.target.value as typeof venue)}
          className={controlClass}
        >
          <option value="team_a">Team A home</option>
          <option value="neutral">Neutral</option>
          <option value="team_b">Team B home</option>
        </select>
        <label className="grid gap-1 text-xs font-bold text-white/45">
          Your adjustment (Team A points)
          <input
            className={controlClass}
            max={21}
            min={-21}
            onChange={(event) => setAdjustment(Number(event.target.value))}
            step={0.5}
            type="number"
            value={adjustment}
          />
        </label>
      </div>
      {result.data ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric
            label="Model baseline A"
            value={`${result.data.projection.projectedMargin > 0 ? '+' : ''}${result.data.projection.projectedMargin}`}
          />
          <Metric
            label="Adjusted margin A"
            note={`Your adjustment ${adjustment >= 0 ? '+' : ''}${adjustment}`}
            value={`${result.data.projection.projectedMargin + adjustment > 0 ? '+' : ''}${(result.data.projection.projectedMargin + adjustment).toFixed(1)}`}
          />
          <Metric
            label="A win probability"
            value={`${result.data.projection.teamAWinProbability}%`}
          />
          <Metric label="Meetings" value={result.data.history.meetings} />
          <Metric
            label="Model confidence"
            value={`${result.data.projection.confidence}%`}
          />
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState>
            Both programs need a rating in the selected season.
          </EmptyState>
        </div>
      )}
    </div>
  )
}

function Ballot({ season, week }: { season: number; week: number }) {
  const token =
    typeof window === 'undefined'
      ? ''
      : (window.localStorage.getItem('cfb26-owner-session') ?? '')
  const ballot = useQuery(
    convexQuery(api.ratings.getBallot, {
      season,
      sessionToken: token || undefined,
      week,
    }),
  )
  const initialize = useMutation(api.ratings.initializeBallot)
  const move = useMutation(api.ratings.moveBallotTeam)
  const submit = useMutation(api.ratings.submitBallot)
  const [busy, setBusy] = useState(false)
  const [draggedId, setDraggedId] = useState<Id<'programs'> | null>(null)
  if (!ballot.data)
    return (
      <div className="max-w-xl">
        <EmptyState>
          {token
            ? 'Start the all-FBS identity-blind ballot from this week’s Résumé seed.'
            : 'A submitted ballot is public. Sign in through Owner to create or continue a private blind draft.'}
        </EmptyState>
        {token && (
          <button
            type="button"
            className={`${primaryButton} mt-4`}
            onClick={() => {
              setBusy(true)
              void initialize({ season, sessionToken: token, week }).finally(
                () => {
                  setBusy(false)
                  void ballot.refetch()
                },
              )
            }}
            disabled={busy}
          >
            Start ballot
          </button>
        )}
      </div>
    )
  const data = ballot.data
  const moveEntry = (programId: Id<'programs'>, targetRank: number) =>
    void move({
      programId,
      season,
      sessionToken: token,
      targetRank,
      week,
    }).then(() => ballot.refetch())
  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <b className="font-display text-2xl font-extrabold text-white">
            {data.status === 'draft'
              ? 'Identity-blind draft'
              : 'Revealed ballot'}
          </b>
          <p className="text-xs text-white/40">
            Rank achievement: wins, schedule, and dominance. Identity stays
            hidden until submission; every move autosaves. Drag, use Arrow keys,
            or enter a rank.
          </p>
        </div>
        {data.status === 'draft' && (
          <div className="flex gap-2">
            <button
              type="button"
              className={pillClass}
              onClick={() =>
                window.confirm('Replace this draft with the Résumé seed?') &&
                void initialize({
                  restart: true,
                  season,
                  sessionToken: token,
                  week,
                }).then(() => ballot.refetch())
              }
            >
              Start over
            </button>
            <button
              type="button"
              className={primaryButton}
              onClick={() =>
                void submit({ season, sessionToken: token, week }).then(() =>
                  ballot.refetch(),
                )
              }
            >
              Submit & reveal
            </button>
          </div>
        )}
      </div>
      <div className="space-y-2">
        {data.entries.map((entry) => (
          <div
            key={entry.programId}
            draggable={data.status === 'draft'}
            tabIndex={data.status === 'draft' ? 0 : undefined}
            aria-label={
              data.status === 'draft'
                ? `Blind team ${entry.seedRank}, rank ${entry.rank}. Use arrow keys to move.`
                : undefined
            }
            onDragStart={() => setDraggedId(entry.programId)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedId) moveEntry(draggedId, entry.rank)
              setDraggedId(null)
            }}
            onKeyDown={(event) => {
              if (data.status !== 'draft') return
              if (event.key === 'ArrowUp' && entry.rank > 1) {
                event.preventDefault()
                moveEntry(entry.programId, entry.rank - 1)
              }
              if (
                event.key === 'ArrowDown' &&
                entry.rank < data.entries.length
              ) {
                event.preventDefault()
                moveEntry(entry.programId, entry.rank + 1)
              }
            }}
            className={`app-card grid grid-cols-[3rem_1fr_auto] items-center gap-3 p-3 focus-visible:outline-2 ${entry.program?.key === 'michigan' ? 'michigan-highlight' : ''}`}
          >
            <b
              className={`font-display text-2xl ${entry.program?.key === 'michigan' ? 'michigan-accent' : 'app-accent-text'}`}
            >
              {entry.rank}
            </b>
            <div>
              <b>{entry.program?.name ?? `Blind team ${entry.seedRank}`}</b>
              <div className="mt-1 text-xs text-white/40">
                Seed {entry.seedRank} · {entry.evidence?.actualWins ?? '—'} wins
                · schedule {entry.evidence?.schedule?.toFixed(1) ?? '—'} ·
                dominance {entry.evidence?.dominance?.toFixed(1) ?? '—'}
                {data.status === 'submitted'
                  ? ` · Power ${entry.evidence?.powerRank ?? '—'} · AP ${entry.evidence?.apRank ?? '—'} · CFP ${entry.evidence?.cfpRank ?? '—'} · previous ${entry.evidence?.previousRank ?? '—'}`
                  : ''}
              </div>
            </div>
            {data.status === 'draft' && (
              <input
                aria-label={`Move blind team ${entry.seedRank} to rank`}
                type="number"
                min={1}
                max={data.entries.length}
                defaultValue={entry.rank}
                onBlur={(event) => {
                  const targetRank = Number(event.target.value)
                  if (targetRank !== entry.rank)
                    moveEntry(entry.programId, targetRank)
                }}
                className="app-control w-16 px-2 py-1 text-white"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RankingTable({
  detailHeadings = [],
  heading,
  noteHeading,
  primaryHeading,
  rows,
}: {
  detailHeadings?: Array<string>
  heading: string
  noteHeading?: string
  primaryHeading: string
  rows: Array<{
    label: string
    primary: string
    rank: number
    secondary: string
    details?: Array<{ label: string; value: string }>
    highlight?: boolean
    note?: string
  }>
}) {
  return (
    <section className="app-card overflow-hidden p-0">
      <h2 className="app-ranking-header font-display border-b border-white/10 px-5 py-4 text-2xl font-extrabold text-white">
        {heading}
      </h2>
      <div className="overflow-x-auto">
        <table
          className={`w-full border-collapse text-left text-sm ${detailHeadings.length > 0 ? 'min-w-[1180px]' : 'min-w-[620px]'}`}
        >
          <thead className="app-label bg-black/15">
            <tr>
              <th className="w-16 px-4 py-3" scope="col">
                Rank
              </th>
              <th className="min-w-52 px-4 py-3" scope="col">
                Team
              </th>
              <th className="px-4 py-3 text-right" scope="col">
                {primaryHeading}
              </th>
              {detailHeadings.map((detailHeading) => (
                <th
                  className="whitespace-nowrap px-4 py-3 text-right"
                  key={detailHeading}
                  scope="col"
                >
                  {detailHeading}
                </th>
              ))}
              {noteHeading && (
                <th className="min-w-64 px-4 py-3" scope="col">
                  {noteHeading}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.rank}:${row.label}`}
                className={`border-t border-white/[0.07] hover:bg-white/[0.025] ${row.highlight ? 'michigan-highlight' : ''}`}
              >
                <td
                  className={`font-display px-4 py-3 text-2xl font-extrabold tabular-nums ${row.highlight ? 'michigan-accent' : 'app-accent-text'}`}
                >
                  {row.rank}
                </td>
                <th className="px-4 py-3" scope="row">
                  <span
                    className={`block ${row.highlight ? 'michigan-accent' : ''}`}
                  >
                    {row.label}
                  </span>
                  <span className="mt-0.5 block text-xs font-normal text-white/40">
                    {row.secondary}
                  </span>
                </th>
                <td className="px-4 py-3 text-right text-lg font-extrabold tabular-nums">
                  {row.primary}
                </td>
                {detailHeadings.map((detailHeading) => (
                  <td
                    className="whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums text-white/70"
                    key={detailHeading}
                  >
                    {row.details?.find(
                      (detail) => detail.label === detailHeading,
                    )?.value ?? '—'}
                  </td>
                ))}
                {noteHeading && (
                  <td className="px-4 py-3 text-xs leading-5 text-white/40">
                    {row.note ?? '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Methodology({
  data,
}: {
  data: FunctionReturnType<typeof api.ratings.getWeeklyDashboard>
}) {
  const edition = data.edition
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(19rem,0.65fr)]">
      <div className="grid gap-5">
        <Surface className="p-5 sm:p-6">
          <p className="app-kicker">Sustained competitive health</p>
          <h2 className="mt-2 text-3xl font-bold">State of the Program</h2>
          <p className="mt-3 text-sm leading-6">
            Ten seasons of evidence, with the recent five carrying most weight.
            Competitive results contribute 70%, talent acquisition 20%, and
            development 10%. Partial seasons contribute in proportion to games
            played. Brand recognition earns no points. Missing evidence remains
            visible and increases uncertainty.
          </p>
          <Link
            to="/national/program"
            className="mt-3 inline-block font-semibold underline"
          >
            Explore every FBS program
          </Link>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <p className="app-kicker">Predictive model</p>
          <h2 className="mt-2 text-3xl font-bold">CFB26 Power</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">
            Power is expected points above or below an average FBS team on a
            neutral field. The model jointly estimates opponent-adjusted offense
            and defense, fits robust margin strength, strongly shrinks special
            teams, and keeps home-field value outside the neutral rank.
          </p>
          <div className="app-accent-soft-text mt-5 rounded-2xl bg-black/20 p-4 font-mono text-sm">
            Power = reconciled neutral margin strength (offense, defense,
            special teams, prior)
          </div>
          <ul className="mt-5 grid gap-2 pl-5 text-sm leading-6 text-white/50">
            <li>
              Regulation margins cap at 35; overtime margins cap at seven.
            </li>
            <li>
              Huber residual weights reduce the influence of extreme results.
            </li>
            <li>
              The active baseline weights current-season games equally; recency
              challengers require held-out validation.
            </li>
            <li>
              Up to four prior seasons fade recursively as games accumulate.
            </li>
            <li>
              FCS teams participate in adjustment with stronger shrinkage but
              are not published.
            </li>
          </ul>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <p className="app-kicker">Earned record model</p>
          <h2 className="mt-2 text-3xl font-bold">CFB26 Résumé</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">
            Résumé measures results against a fixed playoff-contender standard.
            Opponent quality is fitted from current-season games without
            historical priors; venue changes expected wins. It has no talent,
            conference, rivalry, championship, bowl, playoff, or human bonus.
          </p>
          <div className="app-accent-soft-text mt-5 rounded-2xl bg-black/20 p-4 font-mono text-sm">
            Résumé = 0.70 × results credit + 0.30 × performance credit
          </div>
          <p className="mt-4 text-sm leading-6 text-white/50">
            Provisional rows remain hidden until entering Week 7. Losses never
            earn positive game credit; blowout rewards diminish. Teams with
            fewer than five games remain ranked afterward and carry a
            limited-sample flag.
          </p>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <p className="app-kicker">Evaluation and limits</p>
          <h2 className="mt-2 text-3xl font-bold">What earns promotion</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Rolling held-out seasons evaluate margin mean absolute error and
            Brier score as co-primary objectives; calibration error is reported
            separately. A challenger must improve both aggregate objectives in
            most comparable seasons without a material single-season or
            calibration regression. The repository does not yet hold historical
            weekly as-of forecasts, so no accuracy improvement beyond the
            checked-in baseline is claimed.
          </p>
        </Surface>
      </div>
      <aside className="space-y-4">
        <Surface className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="app-kicker">Active edition</p>
              <h2 className="mt-2 text-2xl font-bold">
                {edition?.editionType ?? 'Fallback'}
              </h2>
            </div>
            <StatusPill tone={edition ? 'success' : 'neutral'}>
              {edition ? 'Immutable' : 'Labeled fallback'}
            </StatusPill>
          </div>
          <dl className="mt-5 grid gap-4 text-sm">
            <MethodRow
              label="Power model"
              value={
                edition?.modelVersion ??
                data.ratings.at(0)?.modelVersion ??
                'Unavailable'
              }
            />
            <MethodRow
              label="Résumé model"
              value={edition?.resumeModelVersion ?? 'Not active'}
            />
            <MethodRow
              label="Calibration"
              value={edition?.calibrationVersion ?? 'fixed-logistic-v1'}
            />
            <MethodRow label="Field" value={`${data.ratingCount} FBS teams`} />
            <MethodRow
              label="Basis"
              value={rankingModeLabel(data.rankingMode)}
            />
            <MethodRow
              label="Cutoff"
              value={
                edition
                  ? new Date(edition.cutoffAt).toLocaleString()
                  : 'Live fallback evidence'
              }
            />
            <MethodRow
              label="Revision"
              value={edition ? String(edition.revision) : '—'}
            />
          </dl>
        </Surface>
        <Surface className="p-5">
          <p className="app-kicker">Publication universe</p>
          <p className="mt-3 text-sm leading-6 text-white/50">
            The selected season&apos;s FBS schedule defines the field. Ranks run
            continuously from 1 through that field size—138 today when 138 teams
            are present, fewer in older seasons, and more if membership expands.
          </p>
        </Surface>
      </aside>
    </div>
  )
}

function MethodRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="app-label">{label}</dt>
      <dd className="m-0 mt-1 font-semibold text-white/75">{value}</dd>
    </div>
  )
}

function isMichiganProgram(name: string) {
  const normalized = name.trim().toLowerCase()
  return normalized === 'michigan' || normalized === 'michigan wolverines'
}

function signed(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}

function sourceLabel(source: string) {
  return source.replaceAll('_', ' ')
}

function rankingBasisLabel(basis: string, sourceSeason: number | null) {
  if (basis === 'weekly_edition') return 'weekly edition'
  if (basis === 'season_composite') return 'season composite'
  if (basis === 'current_season_elo') return 'current-season Elo fallback'
  if (basis === 'prior_season_composite')
    return `${sourceSeason ?? 'prior'} composite carryover`
  if (basis === 'prior_season_elo')
    return `${sourceSeason ?? 'prior'} Elo carryover`
  return 'neutral baseline · no current or prior rating'
}

function rankingModeLabel(
  mode: 'fallback' | 'season_composite' | 'weekly_edition',
) {
  if (mode === 'weekly_edition') return 'weekly Power edition'
  if (mode === 'season_composite') return 'season composite'
  return 'complete-field fallback'
}

function ProgramSelect({
  onChange,
  programs,
  value,
}: {
  onChange: (value: string) => void
  programs: Array<Program>
  value: string
}) {
  return (
    <select
      aria-label="Program"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={controlClass}
    >
      {programs.map((program) => (
        <option key={program._id} value={program.key}>
          {program.name}
        </option>
      ))}
    </select>
  )
}

function useNationalParams() {
  const [season, setSeasonState] = useState(() =>
    readNumericParam('season', CURRENT_SEASON),
  )
  const [week, setWeekState] = useState(() => {
    const selected = readNumericParam('week', 1)
    return selected >= 0 && selected <= 20 ? selected : 1
  })
  useEffect(() => {
    setUrlParam('season', String(season))
    setUrlParam('week', String(week))
  }, [season, week])
  return {
    season,
    setSeason(value: number) {
      setSeasonState(value)
      setUrlParam('season', String(value))
    },
    setWeek(value: number) {
      setWeekState(value)
      setUrlParam('week', String(value))
    },
    week,
  }
}

function readNumericParam(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback
  const stored = window.localStorage.getItem(`dbyd-national-${key}`)
  const raw = new URLSearchParams(window.location.search).get(key) ?? stored
  if (raw === null) return fallback
  const value = Number(raw)
  return Number.isFinite(value) ? value : fallback
}

function readStringParam(key: string, fallback: string) {
  if (typeof window === 'undefined') return fallback
  return new URLSearchParams(window.location.search).get(key) || fallback
}

function setUrlParam(key: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url)
  if (key === 'season' || key === 'week') {
    window.localStorage.setItem(`dbyd-national-${key}`, value)
  }
}

const controlClass =
  'app-control min-h-11 px-3 py-2 text-sm font-bold text-white focus-visible:outline-2'
const pillClass =
  'rounded-full border border-white/10 px-4 py-2 text-xs font-black uppercase tracking-[0.1em] transition'
const primaryButton =
  'app-primary-button min-h-11 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-[0.12em] shadow-[0_6px_18px_var(--app-accent-shadow)] disabled:opacity-40'
export function LandscapeLoading() {
  return <LoadingState label="Building the selected national edition" />
}
export function LandscapeError() {
  return (
    <PublicShell active="games" context="national">
      <PageFrame>
        <ErrorState>
          The last valid national edition could not be loaded. Official editions
          remain immutable and are never replaced by an empty response.
        </ErrorState>
      </PageFrame>
    </PublicShell>
  )
}
