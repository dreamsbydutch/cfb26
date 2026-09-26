import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { GameSchedule } from './GameSchedule'
import { RatingField } from './RatingField'
import { RankingTable, rankingControlClass } from './RankingTable'
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
const VIEW_TITLES: Record<LandscapeView, string> = {
  ballot: 'Blind ballot',
  games: 'Games',
  methodology: 'Methodology',
  playoff: 'Playoff',
  power: 'Power rankings',
  program: 'Program rankings',
  resume: 'Résumé rankings',
  simulator: 'Simulator',
  teams: 'Teams',
}

export function LandscapeDashboard({
  programKey,
  view = 'games',
}: {
  programKey?: string
  view?: LandscapeView
}) {
  const {
    season,
    setSeason,
    setWeek,
    week: requestedWeek,
  } = useNationalParams()
  const dashboard = useQuery(
    convexQuery(api.ratings.getWeeklyDashboard, {
      season,
      week: requestedWeek,
    }),
  )
  const week = requestedWeek ?? dashboard.data?.week ?? 1
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
          title={VIEW_TITLES[view]}
        />
        <ContextBar sticky={false}>
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
              value={requestedWeek ?? ''}
              onChange={(event) =>
                setWeek(
                  event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                )
              }
              aria-label="Week"
              className={controlClass}
            >
              <option value="">Latest · Week {week}</option>
              {Array.from({ length: 31 }, (_, index) => (
                <option key={index} value={index}>
                  Week {index}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto text-right text-xs text-white/40">
            {data?.edition
              ? `Updated ${new Date(data.edition.generatedAt).toLocaleString()}`
              : data
                ? 'Fallback ratings'
                : 'Loading…'}
          </div>
        </ContextBar>
        {dashboard.isLoading ? (
          <LoadingState label="Loading" />
        ) : dashboard.isError || !data ? (
          <EmptyState>
            No national edition is available for this selection.
          </EmptyState>
        ) : (
          <>
            {view === 'games' && <GameSchedule data={data} />}
            {view === 'power' && <Power data={data} />}
            {view === 'program' && (
              <RatingField
                kind="program"
                records={data.ratings}
                season={season}
                week={week}
              />
            )}
            {view === 'resume' && (
              <RatingField
                kind="resume"
                records={data.ratings}
                season={season}
                week={week}
              />
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

function Power({
  data,
}: {
  data: FunctionReturnType<typeof api.ratings.getWeeklyDashboard>
}) {
  const [search, setSearch] = useState('')
  const [conference, setConference] = useState('all')
  const ratingRows = data.ratings
  const conferences = [
    ...new Set(ratingRows.map((row) => row.conference).filter(Boolean)),
  ].sort()
  const showSpecialTeams = ratingRows.some((row) => row.specialTeamsAvailable)
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
    .map((row) => {
      const record = row.record as typeof row.record | undefined
      return {
        highlight: isMichiganProgram(row.sourceProgramName),
        label: row.sourceProgramName,
        primary: signed(row.power),
        rank: row.powerRank ?? 999,
        secondary: row.conference ?? 'Independent',
        details: [
          { label: 'Record', value: formatRecord(record) },
          { label: 'Offense', value: signed(row.offense) },
          { label: 'Defense', value: signed(row.defense) },
          {
            label: 'Special teams',
            value: row.specialTeamsAvailable ? signed(row.specialTeams) : '—',
          },
        ],
      }
    })
  return (
    <div className="w-fit max-w-full">
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_minmax(8rem,auto)] gap-2">
        <input
          aria-label="Search Power rankings"
          className={`${rankingControlClass} min-w-0 px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm`}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search teams"
          value={search}
        />
        <select
          aria-label="Filter by conference"
          className={`${rankingControlClass} min-w-0 max-w-40 px-2 py-1.5 text-xs sm:max-w-none sm:px-3 sm:py-2 sm:text-sm`}
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
          'Record',
          'Offense',
          'Defense',
          ...(showSpecialTeams ? ['Special teams'] : []),
        ]}
        heading={`DbyD CFB Power · ${rows.length} of ${ratingRows.length} teams`}
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
            {completed.length} completed games ·{' '}
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
            Drag, use arrow keys, or enter a rank. Changes autosave.
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
            Sustained results, recruiting, development, and accomplishments
            since 2000. Conference titles and deeper playoff runs earn prestige;
            national championships carry the most credit. Recent success matters
            more when elite results repeat in consecutive seasons. Older
            accomplishments retain a smaller legacy contribution.
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
              Blowouts beyond the margin cap count as lower-bound evidence,
              avoiding a penalty for exceeding a large expected win. Where
              available, competitive per-play efficiency supplies 20% of the
              game margin signal.
            </li>
            <li>
              The active baseline weights current-season games equally; recency
              challengers require held-out validation.
            </li>
            <li>
              Up to four prior seasons inform a four-game starting weight,
              reduced to two when a team moves from FCS to FBS. Missing imported
              seasons preserve history. Talent, recruiting, and returning
              production refine the preseason forecast; offensive turnover
              reduces its confidence.
            </li>
            <li>
              FCS opponents are estimated against the subdivision strength
              observed in cross-division games. Thin-history teams start
              cautiously, with FCS schedules included. No team or conference
              receives a rank ceiling.
            </li>
            <li>
              Home-field value uses a stable base. Point margins and win
              probabilities are calibrated using earlier-season forecasts. A
              learned 9.3% Program-history component adds durable strength to
              the final forecast.
            </li>
          </ul>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <p className="app-kicker">Earned record model</p>
          <h2 className="mt-2 text-3xl font-bold">CFB26 Résumé</h2>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">
            Résumé measures results against a fixed playoff-contender standard.
            Opponent quality uses current-season games with limited prior-season
            Program context. A team's own history adds at most 0.15
            win-equivalents; current-season results drive the ranking.
          </p>
          <div className="app-accent-soft-text mt-5 rounded-2xl bg-black/20 p-4 font-mono text-sm">
            Résumé = 0.70 × results credit + 0.30 × performance credit + history
          </div>
          <p className="mt-4 text-sm leading-6 text-white/50">
            Provisional rows remain hidden until entering Week 7. Losses never
            earn positive game credit; blowout rewards diminish. Competitive
            points per drive limit cosmetic scoring where coverage permits. Near
            ties also consider how unlikely the complete record would be for the
            reference contender.
          </p>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <p className="app-kicker">Evaluation and limits</p>
          <h2 className="mt-2 text-3xl font-bold">What earns promotion</h2>
          <p className="mt-3 text-sm leading-6 text-white/55">
            Models are compared on held-out seasons using margin error, win
            probabilities, and calibration. Promotion requires improvement
            across seasons without material regressions. Historical results are
            retrospective reconstructions, not original pregame forecasts.
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
            The selected season&apos;s FBS directory defines the field, with the
            schedule as a fallback. Every member receives a rank.
          </p>
        </Surface>
        {!!edition?.coverageWarnings?.length && (
          <Surface className="p-5">
            <h2 className="text-xl font-bold">Data limitations</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6">
              {edition.coverageWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Surface>
        )}
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

function signed(value: number | null) {
  if (value === null) return 'N/A'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}

function formatRecord(
  record: { losses: number; ties: number; wins: number } | undefined,
) {
  if (!record) return '—'
  return `${record.wins}-${record.losses}${record.ties ? `-${record.ties}` : ''}`
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
  const [week, setWeekState] = useState<number | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    const raw = new URLSearchParams(window.location.search).get('week')
    if (raw === null) return undefined
    const selected = Number(raw)
    return Number.isInteger(selected) && selected >= 0 && selected <= 30
      ? selected
      : undefined
  })
  useEffect(() => {
    setUrlParam('season', String(season))
    if (week !== undefined) setUrlParam('week', String(week))
    else {
      const url = new URL(window.location.href)
      url.searchParams.delete('week')
      window.history.replaceState(window.history.state, '', url)
    }
  }, [season, week])
  return {
    season,
    setSeason(value: number) {
      setSeasonState(value)
      setUrlParam('season', String(value))
    },
    setWeek(value: number | undefined) {
      setWeekState(value)
      if (value !== undefined) setUrlParam('week', String(value))
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
  return <LoadingState label="Loading" />
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
