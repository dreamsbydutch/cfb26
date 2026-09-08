import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
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
          summary="Power estimates team strength. Résumé measures what a team has earned. Every view names the edition and evidence it uses."
          title="Strength predicts. Résumé earns. Keep the questions separate."
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
            {view === 'resume' && <Resume merit={merit.data ?? null} />}
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
              {option}
            </button>
          ))}
        </div>
        <p className="text-xs text-white/40">
          Schedule badges use the complete {data.ratingCount}-team Power field.
        </p>
      </div>
      <div className="grid gap-7">
        {windows.map(([startTime, games]) => (
          <section key={startTime}>
            <div className="mb-3 flex items-center gap-3">
              <time className="font-display text-xl font-extrabold uppercase tracking-wide">
                {new Date(startTime).toLocaleString([], {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </time>
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-xs text-white/35">
                {games.length} games
              </span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {games.map((game) => (
                <article
                  key={game._id}
                  className={`app-card relative overflow-hidden p-5 ${isMichiganProgram(game.awaySourceName) || isMichiganProgram(game.homeSourceName) ? 'michigan-highlight' : ''}`}
                >
                  <div
                    className={`absolute inset-y-3 left-0 w-1 rounded-r-full ${isMichiganProgram(game.awaySourceName) || isMichiganProgram(game.homeSourceName) ? 'michigan-marker' : 'app-list-marker'}`}
                  />
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.14em] text-white/35">
                    <span>
                      Week {game.week} ·{' '}
                      {game.conferenceGame ? 'Conference' : 'Nonconference'}
                    </span>
                    <span>{new Date(game.startTime).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                    <Team
                      name={game.awaySourceName}
                      rank={game.awayRank}
                      rating={game.awayRating}
                    />
                    <div className="text-center text-xs font-black text-white/25">
                      AT
                    </div>
                    <Team
                      name={game.homeSourceName}
                      rank={game.homeRank}
                      rating={game.homeRating}
                      align="right"
                    />
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/10 pt-4 text-center text-xs text-white/40">
                    <div>
                      <b className="font-display block text-xl text-white">
                        {game.matchupQuality}
                      </b>
                      quality
                    </div>
                    <div>
                      <b className="font-display block text-xl text-white">
                        {game.playoffImportance}
                      </b>
                      playoff
                    </div>
                    <div>
                      <b className="font-display block text-xl text-white">
                        {game.projectedMargin > 0 ? '+' : ''}
                        {game.projectedMargin.toFixed(1)}
                      </b>
                      home margin
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-white/40">
                    {game.michiganRelation} ·{' '}
                    {game.neutralSite
                      ? 'Neutral site'
                      : (game.venue ?? 'Venue TBD')}
                    {game.tvOutlets?.length
                      ? ` · ${game.tvOutlets.join(', ')}`
                      : ''}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  )
}

function Team({
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
        className={`font-display text-xl font-extrabold ${highlightsMichigan ? 'michigan-accent' : 'text-white'}`}
      >
        {rank ? (
          <span
            className={`mr-1 text-sm ${highlightsMichigan ? 'michigan-accent' : 'app-accent-text'}`}
          >
            #{rank}
          </span>
        ) : null}
        {name}
      </div>
      <div className="mt-1 text-xs text-white/40">
        Power {rating > 0 ? '+' : ''}
        {rating.toFixed(1)}
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
  const conferences = [
    ...new Set(data.ratings.map((row) => row.conference).filter(Boolean)),
  ].sort()
  const rows = data.ratings
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
      <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
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
      </div>
      <RankingTable
        detailHeadings={[
          'Offense',
          'Defense',
          'Special teams',
          'Home field',
          'Prior weight',
          'Evidence',
        ]}
        heading={`DbyD CFB Power · ${rows.length} of ${data.ratingCount} teams`}
        noteHeading="Sources & coverage"
        primaryHeading="Power"
        rows={rows}
      />
    </div>
  )
}

function Resume({
  merit,
}: {
  merit: FunctionReturnType<typeof api.ratings.getMeritDashboard>
}) {
  if (!merit?.edition.resumeVisible)
    return (
      <EmptyState title="Résumé unlocks in Week 7">
        Résumé needs enough completed-game evidence to measure achievement.
        Until then, use{' '}
        <Link className="app-accent-text font-bold" to="/national/power">
          Power
        </Link>{' '}
        for strength estimates.
      </EmptyState>
    )
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <RankingTable
        heading="CFB26 Résumé"
        primaryHeading="Résumé"
        rows={merit.rankings.map(({ program, snapshot }) => ({
          highlight:
            program?.key === 'michigan' ||
            isMichiganProgram(snapshot.sourceProgramName),
          label: program?.name ?? snapshot.sourceProgramName,
          primary: snapshot.resume?.toFixed(1) ?? '—',
          rank: snapshot.resumeRank ?? 999,
          secondary: `${snapshot.actualWins ?? 0} wins · ${snapshot.expectedWins?.toFixed(1) ?? '—'} expected`,
        }))}
      />
      <div className="space-y-5">
        <h2 className="michigan-accent font-display text-2xl font-extrabold">
          Michigan schedule strength
        </h2>
        {merit.schedule ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Metric
                label="Played avg Power"
                value={merit.schedule.played.averageOpponentPower ?? '—'}
              />
              <Metric
                label="Full avg Power"
                value={merit.schedule.full.averageOpponentPower ?? '—'}
              />
              <Metric
                label="Top-25 expected wins"
                value={merit.schedule.full.benchmarkExpectedWins}
              />
              <Metric
                label="Remaining games"
                value={merit.schedule.remaining.games}
              />
            </div>
            {merit.schedule.quadrants.map((quadrant) => (
              <div
                key={quadrant.quadrant}
                className="rounded-2xl border-l-4 border-[#ffcb05] bg-white/[0.04] p-4"
              >
                <b>{quadrant.quadrant}</b>
                <span className="float-right">
                  {quadrant.games.length} completed FBS games
                </span>
              </div>
            ))}
          </>
        ) : (
          <EmptyState>Michigan schedule data is unavailable.</EmptyState>
        )}
      </div>
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
            <li>Every current-season game has equal weight.</li>
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
            Résumé is wins above the expectation of an average top-25 team.
            Opponent quality comes from the selected edition&apos;s Power field;
            venue changes expected wins. It has no talent, conference, rivalry,
            championship, bowl, playoff, or human bonus.
          </p>
          <div className="app-accent-soft-text mt-5 rounded-2xl bg-black/20 p-4 font-mono text-sm">
            Résumé = 0.90 × schedule/results + 0.10 × capped dominance
          </div>
          <p className="mt-4 text-sm leading-6 text-white/50">
            Provisional rows remain hidden before Week 7. Teams with fewer than
            five games remain ranked afterward and carry a limited-sample flag.
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
