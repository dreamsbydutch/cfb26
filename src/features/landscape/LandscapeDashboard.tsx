import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import {
  AppShell,
  EmptyState,
  Metric,
  SectionTabs,
} from '~/components/AppShell'

type View =
  'ballot' | 'games' | 'playoff' | 'power' | 'resume' | 'simulator' | 'teams'
type Program = FunctionReturnType<typeof api.teamData.listPrograms>[number]
const CURRENT_SEASON = new Date().getFullYear()
const TABS: ReadonlyArray<{ id: View; label: string }> = [
  { id: 'games', label: 'Games' },
  { id: 'power', label: 'Power' },
  { id: 'resume', label: 'Résumé' },
  { id: 'playoff', label: 'Playoff' },
  { id: 'teams', label: 'Teams' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'ballot', label: 'Blind ballot' },
]

export function LandscapeDashboard() {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [week, setWeek] = useState(1)
  const [view, setView] = useState<View>('games')
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
    <AppShell
      active="national"
      eyebrow={`${season} · Week ${week}`}
      title="Strength predicts. Résumé earns. Keep the questions separate."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
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
        <div className="text-right text-xs text-slate-500">
          {data?.edition
            ? `${data.edition.editionType} edition · ${data.edition.modelVersion}`
            : data
              ? `Complete fallback field · ${data.ratingCount} FBS teams`
              : 'Loading ranking basis'}
        </div>
      </div>
      <SectionTabs active={view} onChange={setView} tabs={TABS} />
      {dashboard.isLoading ? (
        <LandscapeLoading />
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
            <Teams programs={programs.data ?? []} season={season} />
          )}
          {view === 'simulator' && (
            <Simulator programs={programs.data ?? []} season={season} />
          )}
          {view === 'ballot' && <Ballot season={season} week={week} />}
        </>
      )}
    </AppShell>
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
  const games = useMemo(
    () =>
      [...data.games].sort((left, right) => {
        const field =
          lens === 'quality'
            ? 'matchupQuality'
            : lens === 'playoff'
              ? 'playoffImportance'
              : 'michiganImportance'
        return right[field] - left[field] || left.startTime - right.startTime
      }),
    [data.games, lens],
  )
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['quality', 'playoff', 'michigan'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLens(option)}
              className={`${pillClass} ${lens === option ? 'bg-[#00274c] text-white' : 'bg-white text-slate-600'}`}
            >
              {option}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Schedule badges use the complete {data.ratingCount}-team Power field.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {games.map((game) => (
          <article
            key={game._id}
            className="relative overflow-hidden rounded-2xl border border-slate-300 bg-white p-5 shadow-sm"
          >
            <div className="absolute inset-y-0 left-0 w-1.5 bg-[#ffcb05]" />
            <div className="flex justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
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
              <div className="text-center text-xs font-black text-slate-400">
                AT
              </div>
              <Team
                name={game.homeSourceName}
                rank={game.homeRank}
                rating={game.homeRating}
                align="right"
              />
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-200 pt-4 text-center text-xs">
              <div>
                <b className="block text-xl text-[#00274c]">
                  {game.matchupQuality}
                </b>
                quality
              </div>
              <div>
                <b className="block text-xl text-[#00274c]">
                  {game.playoffImportance}
                </b>
                playoff
              </div>
              <div>
                <b className="block text-xl text-[#00274c]">
                  {game.projectedMargin > 0 ? '+' : ''}
                  {game.projectedMargin.toFixed(1)}
                </b>
                home margin
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              {game.michiganRelation} ·{' '}
              {game.neutralSite ? 'Neutral site' : (game.venue ?? 'Venue TBD')}
              {game.tvOutlets?.length ? ` · ${game.tvOutlets.join(', ')}` : ''}
            </p>
          </article>
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
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="font-serif text-xl font-black text-[#00274c]">
        {rank ? (
          <span className="mr-1 text-sm text-slate-400">#{rank}</span>
        ) : null}
        {name}
      </div>
      <div className="mt-1 text-xs text-slate-500">
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
  const modelVersion = data.edition
    ? data.edition.modelVersion
    : (data.ratings.at(0)?.modelVersion ?? 'unavailable')
  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]">
      <RankingTable
        rows={data.ratings
          .filter((row) => row.published)
          .sort((a, b) => (a.powerRank ?? 999) - (b.powerRank ?? 999))
          .map((row) => ({
            label: row.sourceProgramName,
            primary: row.power.toFixed(1),
            rank: row.powerRank ?? 999,
            secondary: `${row.conference ?? 'Independent'} · ${rankingBasisLabel(row.rankingBasis, row.sourceSeason)}`,
            details: [
              { label: 'Neutral Power', value: signed(row.power) },
              { label: 'Offense', value: signed(row.offense) },
              { label: 'Defense', value: signed(row.defense) },
              {
                label: 'Special teams',
                value: row.specialTeamsAvailable
                  ? signed(row.specialTeams)
                  : 'Not separated',
              },
              {
                label: 'Prior weight',
                value: `${Math.round(row.priorWeight * 100)}%`,
              },
              {
                label: 'Evidence',
                value: row.limitedSample
                  ? 'Limited sample'
                  : `${row.gamesPlayed} games`,
              },
            ],
            note: `Sources: ${row.dataSources.map(sourceLabel).join(', ')}${row.confidence === undefined ? '' : ` · coverage confidence ${row.confidence}%`}${row.signalCount === undefined ? '' : ` · ${row.signalCount} signals`}`,
          }))}
        heading={`DbyD CFB Power · all ${data.ratingCount} teams`}
      />
      <aside className="space-y-4">
        <Metric label="Rated teams" value={data.ratingCount} />
        <Metric label="Model" value={modelVersion} />
        <section className="rounded-2xl bg-[#00274c] p-5 text-sm leading-6 text-white shadow-sm">
          <b className="block font-serif text-xl text-[#ffcb05]">
            How the order is built
          </b>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-white/80">
            <li>
              The selected season’s schedule defines the FBS field, so the list
              grows or shrinks with real membership instead of stopping at 50.
            </li>
            <li>
              Power is neutral-field points above or below the average team,
              learned from opponent-adjusted results with extreme margins
              reduced in influence.
            </li>
            <li>
              Offense, defense, and special teams are estimated separately;
              preseason evidence carries forward and fades as games accumulate.
            </li>
            <li>
              Missing current evidence uses the prior season, then a neutral
              baseline. Every row identifies which path it used.
            </li>
          </ol>
          <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/70">
            Active basis: {rankingModeLabel(data.rankingMode)} · model{' '}
            {modelVersion}
          </p>
        </section>
      </aside>
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
      <EmptyState>
        Résumé editions begin in Week 7. Power remains available before then.
      </EmptyState>
    )
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <RankingTable
        heading="CFB26 Résumé"
        rows={merit.rankings.map(({ program, snapshot }) => ({
          label: program?.name ?? snapshot.sourceProgramName,
          primary: snapshot.resume?.toFixed(1) ?? '—',
          rank: snapshot.resumeRank ?? 999,
          secondary: `${snapshot.actualWins ?? 0} wins · ${snapshot.expectedWins?.toFixed(1) ?? '—'} expected`,
        }))}
      />
      <div className="space-y-5">
        <h2 className="font-serif text-2xl font-black text-[#00274c]">
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
                className="border-l-4 border-[#ffcb05] bg-white p-4"
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
            className="border-t-8 border-[#00274c] bg-white p-5 shadow-sm"
          >
            <div className="flex justify-between">
              <span className="font-serif text-4xl font-black text-[#ffcb05]">
                {entry.seed}
              </span>
              <span className="text-xs font-black uppercase text-slate-500">
                {entry.bid.replace('_', ' ')}
                {entry.bye ? ' · Bye' : ''}
              </span>
            </div>
            <h2 className="mt-4 font-serif text-2xl font-black text-[#00274c]">
              {entry.program?.name ?? 'Unknown program'}
            </h2>
            <p className="mt-2 text-sm leading-5 text-slate-500">
              {entry.explanation}
            </p>
          </article>
        ))}
      </div>
    </div>
  )
}

function Teams({
  programs,
  season,
}: {
  programs: Array<Program>
  season: number
}) {
  const [programKey, setProgramKey] = useState('michigan')
  return (
    <div>
      <ProgramSelect
        programs={programs}
        value={programKey}
        onChange={setProgramKey}
      />
      <ProgramProfile
        key={`${programKey}:${season}`}
        programKey={programKey}
        season={season}
      />
    </div>
  )
}
function ProgramProfile({
  programKey,
  season,
}: {
  programKey: string
  season: number
}) {
  const result = useQuery(
    convexQuery(api.teamData.getProgramProfile, { programKey, season }),
  )
  const data = result.data
  if (!data) return <EmptyState>No team profile is available.</EmptyState>
  const completed = data.games.filter((game) => game.completed)
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <section className="bg-[#00274c] p-6 text-white">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-[#ffcb05]">
          {data.program.conference ?? 'Independent'}
        </p>
        <h2 className="mt-2 font-serif text-4xl font-black">
          {data.program.name}
        </h2>
        <p className="mt-2 text-sm text-white/60">
          {data.program.mascot ?? 'Mascot unavailable'} ·{' '}
          {data.program.classification?.toUpperCase() ??
            'Classification unknown'}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
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
      </section>
      <section className="bg-white p-6">
        <h3 className="font-serif text-2xl font-black text-[#00274c]">
          Season schedule
        </h3>
        <div className="mt-4 divide-y divide-slate-200">
          {data.games.map((game) => (
            <div
              key={game._id}
              className="flex justify-between gap-4 py-3 text-sm"
            >
              <span>
                W{game.week} · {game.awaySourceName} at {game.homeSourceName}
              </span>
              <b>
                {game.completed
                  ? `${game.awayPoints ?? '—'}–${game.homePoints ?? '—'}`
                  : new Date(game.startTime).toLocaleDateString()}
              </b>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-slate-500">
          {completed.length} completed games · {data.affiliations.length}{' '}
          retained affiliation editions ·{' '}
          {data.venues[0]?.venue?.name ?? 'Venue unavailable'}
        </p>
      </section>
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
  const [a, setA] = useState('michigan')
  const [b, setB] = useState('ohio-state')
  const [venue, setVenue] = useState<'neutral' | 'team_a' | 'team_b'>('team_a')
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
      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>
      {result.data ? (
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Metric
            label="Expected margin A"
            value={`${result.data.projection.projectedMargin > 0 ? '+' : ''}${result.data.projection.projectedMargin}`}
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
          <b className="font-serif text-2xl text-[#00274c]">
            {data.status === 'draft'
              ? 'Identity-blind draft'
              : 'Revealed ballot'}
          </b>
          <p className="text-xs text-slate-500">
            Insertion ordering shifts every displaced team automatically. Drag,
            use Arrow keys, or enter a rank.
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
            className="grid grid-cols-[3rem_1fr_auto] items-center gap-3 bg-white p-3 shadow-sm focus-visible:outline-2 focus-visible:outline-[#00274c]"
          >
            <b className="font-serif text-2xl text-[#00274c]">{entry.rank}</b>
            <div>
              <b>{entry.program?.name ?? `Blind team ${entry.seedRank}`}</b>
              <div className="mt-1 text-xs text-slate-500">
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
                className="w-16 border border-slate-400 px-2 py-1"
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function RankingTable({
  heading,
  rows,
}: {
  heading: string
  rows: Array<{
    label: string
    primary: string
    rank: number
    secondary: string
    details?: Array<{ label: string; value: string }>
    note?: string
  }>
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
      <h2 className="bg-[#00274c] px-5 py-4 font-serif text-2xl font-black text-white">
        {heading}
      </h2>
      <div className="divide-y divide-slate-200">
        {rows.map((row) => (
          <article key={`${row.rank}:${row.label}`} className="px-5 py-3">
            <div className="grid grid-cols-[3rem_1fr_auto] items-center gap-3">
              <b className="font-serif text-2xl text-[#00274c]">{row.rank}</b>
              <div>
                <b>{row.label}</b>
                <div className="text-xs text-slate-500">{row.secondary}</div>
              </div>
              <b className="text-lg">{row.primary}</b>
            </div>
            {row.details && (
              <details className="group ml-12 mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <summary className="cursor-pointer font-black uppercase tracking-[0.08em] text-[#00274c] marker:text-[#ffcb05]">
                  Why this rank
                </summary>
                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {row.details.map((detail) => (
                    <div key={detail.label} className="rounded-lg bg-white p-2">
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        {detail.label}
                      </dt>
                      <dd className="mt-1 font-black text-slate-900">
                        {detail.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {row.note && (
                  <p className="mt-3 leading-5 text-slate-500">{row.note}</p>
                )}
              </details>
            )}
          </article>
        ))}
      </div>
    </section>
  )
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

const controlClass =
  'min-h-11 rounded-xl border border-slate-400 bg-white px-3 py-2 text-sm font-bold focus-visible:outline-2 focus-visible:outline-[#00274c]'
const pillClass =
  'rounded-full border border-slate-300 px-4 py-2 text-xs font-black uppercase tracking-[0.1em]'
const primaryButton =
  'min-h-11 rounded-xl bg-[#00274c] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[0_6px_18px_rgb(0_39_76_/_0.24)] disabled:opacity-40'
export function LandscapeLoading() {
  return (
    <div className="animate-pulse border border-slate-300 bg-white p-12 text-center text-sm font-bold text-slate-500">
      Building the selected national edition…
    </div>
  )
}
export function LandscapeError() {
  return (
    <AppShell
      active="national"
      eyebrow="National data unavailable"
      title="The last valid edition could not be loaded."
    >
      <EmptyState>
        Check source health. Official editions remain immutable and are never
        replaced by an empty response.
      </EmptyState>
    </AppShell>
  )
}
