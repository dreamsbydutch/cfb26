import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'

type Lens = 'national' | 'michigan'
type View = 'games' | 'rankings' | 'matchup'
type Venue = 'neutral' | 'team_a' | 'team_b'
type Perspective = 'power' | 'resume'
type Dashboard = FunctionReturnType<typeof api.ratings.getWeeklyDashboard>
type DashboardGame = Dashboard['games'][number]
type DashboardRating = Dashboard['ratings'][number]
type Matchup = FunctionReturnType<typeof api.ratings.getMatchup>

const CURRENT_SEASON = new Date().getFullYear()
const seasons = Array.from(
  { length: CURRENT_SEASON - 1999 },
  (_, index) => CURRENT_SEASON - index,
)
const weeks = Array.from({ length: 21 }, (_, index) => index)

const perspectiveLabels: Readonly<Record<Perspective, string>> = {
  power: 'CFB26 Power Rating',
  resume: 'CFB26 Résumé Rating',
}

function normalizeHostedRating(row: DashboardRating): DashboardRating {
  const legacy: DashboardRating & {
    confidence?: number
    dimensions?: { defense: number; offense: number; specialTeams: number }
    overall?: number
    rank?: number
  } = row
  if (Number.isFinite(row.power)) return row
  const power = ((legacy.overall ?? 50) - 50) * 0.3
  return {
    ...row,
    calibrationVersion: 'fixed-logistic-v1',
    classification: 'fbs',
    defense: ((legacy.dimensions?.defense ?? 50) - 50) * 0.3,
    disagreementReasons: [],
    gamesPlayed: 0,
    homeFieldAdvantage: 2.5,
    limitedSample: true,
    offense: ((legacy.dimensions?.offense ?? 50) - 50) * 0.3,
    power,
    powerRank: legacy.rank,
    priorWeight: 0,
    published: true,
    rank: legacy.rank,
    rating: power,
    specialTeams: ((legacy.dimensions?.specialTeams ?? 50) - 50) * 0.3,
    specialTeamsAvailable: false,
  }
}

export function LandscapeDashboard() {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [week, setWeek] = useState<number | undefined>()
  const [lens, setLens] = useState<Lens>('national')
  const [view, setView] = useState<View>('games')
  const [perspective, setPerspective] = useState<Perspective>('power')
  const [teamAKey, setTeamAKey] = useState('michigan')
  const [teamBKey, setTeamBKey] = useState('ohio-state')
  const [venue, setVenue] = useState<Venue>('team_a')
  const dashboard = useQuery(
    convexQuery(api.ratings.getWeeklyDashboard, { season, week }),
  )
  const games = useMemo(() => {
    const rows = dashboard.data?.games ?? []
    const score =
      lens === 'national' ? 'nationalImportance' : 'michiganImportance'
    return [...rows].sort(
      (left, right) =>
        right[score] - left[score] || left.startTime - right.startTime,
    )
  }, [dashboard.data?.games, lens])
  const resolvedWeek = week ?? dashboard.data?.week
  const ratings = useMemo(
    () => (dashboard.data?.ratings ?? []).map(normalizeHostedRating),
    [dashboard.data?.ratings],
  )
  const resolvedTeamA = ratings.some((rating) => rating.programKey === teamAKey)
    ? teamAKey
    : (ratings[0]?.programKey ?? '')
  const resolvedTeamB = ratings.some(
    (rating) =>
      rating.programKey === teamBKey && rating.programKey !== resolvedTeamA,
  )
    ? teamBKey
    : (ratings.find((rating) => rating.programKey !== resolvedTeamA)
        ?.programKey ?? '')
  const matchup = useQuery({
    ...convexQuery(api.ratings.getMatchup, {
      programKeyA: resolvedTeamA,
      programKeyB: resolvedTeamB,
      season,
      venue,
    }),
    enabled:
      view === 'matchup' &&
      resolvedTeamA !== '' &&
      resolvedTeamB !== '' &&
      resolvedTeamA !== resolvedTeamB,
  })

  return (
    <main className="min-h-screen bg-michigan-cream text-michigan-blue">
      <header className="border-b-4 border-michigan-maize bg-michigan-blue text-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-10 shrink-0 place-items-center border-2 border-michigan-maize bg-michigan-maize font-serif text-xl font-black text-michigan-blue [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)]">
              M
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-michigan-maize">
                College football landscape
              </p>
              <h1 className="text-base font-black sm:text-lg">
                Games and team rankings
              </h1>
            </div>
          </div>
          <Link
            to="/"
            className="shrink-0 border border-white/40 px-3 py-1.5 text-xs font-black transition hover:border-michigan-maize hover:text-michigan-maize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-maize"
          >
            Personnel archive
          </Link>
        </div>
      </header>

      <div className="sticky top-0 z-20 border-b border-michigan-blue/20 bg-michigan-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-end gap-3 px-4 py-2 sm:px-6 lg:px-8">
          <label className="grid gap-1 text-[10px] font-black uppercase tracking-[0.12em]">
            Season
            <select
              value={season}
              onChange={(event) => {
                setSeason(Number(event.target.value))
                setWeek(undefined)
              }}
              className="border border-michigan-blue/30 bg-white px-2 py-1.5 text-sm font-bold normal-case tracking-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
            >
              {seasons.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-[10px] font-black uppercase tracking-[0.12em]">
            Week
            <select
              value={resolvedWeek ?? ''}
              onChange={(event) => setWeek(Number(event.target.value))}
              className="border border-michigan-blue/30 bg-white px-2 py-1.5 text-sm font-bold normal-case tracking-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
            >
              {resolvedWeek === undefined && <option value="">Current</option>}
              {weeks.map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? 'Week 0' : `Week ${value}`}
                </option>
              ))}
            </select>
          </label>
          <div
            className="ml-auto flex gap-1"
            role="group"
            aria-label="Dashboard view"
          >
            <ViewButton
              active={view === 'games'}
              onClick={() => setView('games')}
            >
              Games
            </ViewButton>
            <ViewButton
              active={view === 'rankings'}
              onClick={() => setView('rankings')}
            >
              Rankings
            </ViewButton>
            <ViewButton
              active={view === 'matchup'}
              onClick={() => setView('matchup')}
            >
              Matchup lab
            </ViewButton>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8">
        <div className="mb-5 max-w-3xl border-b border-michigan-blue/20 pb-3">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">
            {season} ·{' '}
            {resolvedWeek === 0
              ? 'Week 0'
              : `Week ${resolvedWeek ?? 'current'}`}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.03em] sm:text-3xl">
            {view === 'games'
              ? 'What matters this week'
              : view === 'rankings'
                ? 'National ratings'
                : 'Build a head-to-head'}
          </h2>
          <p className="mt-1 text-sm leading-5 text-neutral-600">
            {view === 'games'
              ? 'National importance combines our team strength model and matchup competitiveness. The Michigan lens adds direct games, season opponents, and the Big Ten race.'
              : view === 'rankings'
                ? 'Power estimates neutral-field strength in points. Beginning in Week 7, Résumé measures wins above the expectation of an average top-25 team.'
                : 'Choose two teams and a venue to compare Power, offense, defense, special teams, team-specific home field, projected score, and win probability.'}
          </p>
        </div>

        {dashboard.isPending ? (
          <DashboardMessage title="Loading the landscape…" />
        ) : dashboard.isError ? (
          <DashboardMessage
            title="The landscape could not load."
            detail="Check the Convex connection and try again."
            action={
              <button
                type="button"
                onClick={() => void dashboard.refetch()}
                className="border border-michigan-blue px-3 py-1.5 text-xs font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
              >
                Retry
              </button>
            }
          />
        ) : view === 'rankings' ? (
          <RankingsTable
            edition={dashboard.data.edition}
            ratings={ratings}
            resumeVisible={dashboard.data.resumeVisible}
            season={season}
            perspective={perspective}
            onSelectPerspective={setPerspective}
            onSelectSeason={(value) => {
              setSeason(value)
              setWeek(undefined)
            }}
          />
        ) : view === 'matchup' ? (
          <MatchupLab
            matchup={matchup}
            ratings={ratings}
            teamAKey={resolvedTeamA}
            teamBKey={resolvedTeamB}
            venue={venue}
            onSelectTeamA={setTeamAKey}
            onSelectTeamB={setTeamBKey}
            onSelectVenue={setVenue}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex gap-1"
                role="group"
                aria-label="Importance lens"
              >
                <ViewButton
                  active={lens === 'national'}
                  onClick={() => setLens('national')}
                >
                  National importance
                </ViewButton>
                <ViewButton
                  active={lens === 'michigan'}
                  onClick={() => setLens('michigan')}
                >
                  Michigan lens
                </ViewButton>
              </div>
              <p className="text-xs font-bold text-neutral-500">
                {games.length} {games.length === 1 ? 'game' : 'games'} ·{' '}
                {dashboard.data.ratingCount} modeled teams
              </p>
            </div>
            {games.length === 0 ? (
              <DashboardMessage
                title="No games are stored for this week."
                detail="Choose another week or season to explore the schedule history."
              />
            ) : (
              <ol className="grid gap-x-8 gap-y-0 lg:grid-cols-2">
                {games.map((game, index) => (
                  <GameRow
                    key={game._id}
                    game={game}
                    position={index + 1}
                    lens={lens}
                  />
                ))}
              </ol>
            )}
          </>
        )}
      </section>
    </main>
  )
}

function ViewButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`border px-3 py-1.5 text-xs font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue ${
        active
          ? 'border-michigan-blue bg-michigan-blue text-white'
          : 'border-michigan-blue/25 bg-white hover:border-michigan-blue'
      }`}
    >
      {children}
    </button>
  )
}

function GameRow({
  game,
  lens,
  position,
}: {
  game: DashboardGame
  lens: Lens
  position: number
}) {
  const score =
    lens === 'national' ? game.nationalImportance : game.michiganImportance
  const date = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(game.startTime))
  return (
    <li className="grid grid-cols-[2rem_1fr_auto] gap-3 border-t border-michigan-blue/20 py-4 first:border-t-2 first:border-michigan-blue lg:[&:nth-child(2)]:border-t-2 lg:[&:nth-child(2)]:border-michigan-blue">
      <span className="pt-0.5 text-lg font-black tabular-nums text-neutral-300">
        {position}
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
          {game.completed ? 'Final' : date} · {game.michiganRelation}
        </p>
        <TeamLine
          name={game.awaySourceName}
          points={game.awayPoints}
          rank={game.awayRank}
        />
        <TeamLine
          name={game.homeSourceName}
          points={game.homePoints}
          rank={game.homeRank}
        />
        <p className="mt-1 text-xs text-neutral-500">
          {game.neutralSite ? 'Neutral site' : game.venue || 'Venue TBD'}
          {game.conferenceGame ? ' · Conference game' : ''}
        </p>
      </div>
      <div className="w-16 text-right">
        <p className="text-2xl font-black tabular-nums">{score}</p>
        <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">
          importance
        </p>
        <div className="mt-2 h-1.5 bg-michigan-blue-soft" aria-hidden="true">
          <div
            className="h-full bg-michigan-maize"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
    </li>
  )
}

function TeamLine({
  name,
  points,
  rank,
}: {
  name: string
  points: number | undefined
  rank: number | undefined
}) {
  return (
    <p className="mt-1 flex items-baseline gap-2 text-base font-black">
      <span className="w-6 shrink-0 text-right text-xs tabular-nums text-neutral-400">
        {rank ? rank : '—'}
      </span>
      <span className="truncate">{name}</span>
      {points !== undefined && (
        <span className="ml-auto tabular-nums">{points}</span>
      )}
    </p>
  )
}

function formatPoints(value: number) {
  const rounded = Math.round(value * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}`
}

function disagreementLabel(reason: string) {
  return reason.replaceAll('_', ' ')
}

function RankingsTable({
  edition,
  onSelectPerspective,
  onSelectSeason,
  perspective,
  ratings,
  resumeVisible,
  season,
}: {
  edition: Dashboard['edition']
  onSelectPerspective: (perspective: Perspective) => void
  onSelectSeason: (season: number) => void
  perspective: Perspective
  ratings: Array<DashboardRating>
  resumeVisible: boolean
  season: number
}) {
  const selectedPerspective = resumeVisible ? perspective : 'power'
  const sortedRatings = useMemo(
    () =>
      [...ratings].sort((left, right) => {
        const leftScore =
          selectedPerspective === 'resume'
            ? (left.resume ?? Number.NEGATIVE_INFINITY)
            : left.power
        const rightScore =
          selectedPerspective === 'resume'
            ? (right.resume ?? Number.NEGATIVE_INFINITY)
            : right.power
        return rightScore - leftScore || left.rank - right.rank
      }),
    [ratings, selectedPerspective],
  )
  if (ratings.length === 0) {
    const previousSeason = season - 1
    return (
      <DashboardMessage
        title={`No ${season} ratings are available yet.`}
        detail={`No model snapshot is stored for ${season} yet. Historical rankings are available through ${previousSeason}.`}
        action={
          <button
            type="button"
            onClick={() => onSelectSeason(previousSeason)}
            className="border border-michigan-blue bg-michigan-blue px-3 py-1.5 text-xs font-black text-white transition hover:border-michigan-maize hover:text-michigan-maize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
          >
            View {previousSeason} rankings
          </button>
        }
      />
    )
  }
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-y border-michigan-blue/20 bg-white px-3 py-2">
        <label className="grid gap-1 text-[10px] font-black uppercase tracking-[0.12em]">
          Ranking perspective
          <select
            value={selectedPerspective}
            onChange={(event) =>
              onSelectPerspective(event.target.value as Perspective)
            }
            className="min-w-52 border border-michigan-blue/30 bg-white px-2 py-1.5 text-sm font-bold normal-case tracking-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
          >
            <option value="power">CFB26 Power Rating</option>
            {resumeVisible && (
              <option value="resume">CFB26 Résumé Rating</option>
            )}
          </select>
        </label>
        <p className="max-w-xl text-xs leading-5 text-neutral-500">
          Power is expected points above or below an average FBS team on a
          neutral field. Résumé is hidden until Week 7.
          {edition && (
            <span className="mt-1 block font-bold text-michigan-blue">
              {edition.editionType} edition · revision {edition.revision} ·{' '}
              {new Date(edition.cutoffAt).toLocaleString()}
            </span>
          )}
        </p>
      </div>
      <div className="overflow-x-auto border-t-2 border-michigan-blue">
        <table className="w-full min-w-[800px] border-collapse text-left">
          <caption className="sr-only">
            National team rankings by {perspectiveLabels[selectedPerspective]}
          </caption>
          <thead className="bg-michigan-blue text-[10px] uppercase tracking-[0.12em] text-white">
            <tr>
              <th scope="col" className="w-16 px-3 py-2 font-black">
                Rank
              </th>
              <th scope="col" className="px-3 py-2 font-black">
                Team
              </th>
              <th scope="col" className="px-3 py-2 font-black">
                Conference
              </th>
              <th scope="col" className="w-24 px-3 py-2 text-right font-black">
                Power
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-right font-black">
                Power rank
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-right font-black">
                Off
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-right font-black">
                Def
              </th>
              <th scope="col" className="w-24 px-3 py-2 text-right font-black">
                Résumé rank
              </th>
              <th scope="col" className="w-24 px-3 py-2 text-right font-black">
                Résumé
              </th>
              <th scope="col" className="w-20 px-3 py-2 text-right font-black">
                Difference
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedRatings.map((row) => {
              const displayedRank =
                selectedPerspective === 'resume'
                  ? row.resumeRank
                  : row.powerRank
              return (
                <tr
                  key={row.programKey}
                  className={`border-b border-michigan-blue/15 ${
                    row.sourceProgramName === 'Michigan'
                      ? 'bg-michigan-maize-soft font-black'
                      : 'bg-white'
                  }`}
                >
                  <td className="px-3 py-2 font-black tabular-nums">
                    {displayedRank ?? '—'}
                  </td>
                  <th scope="row" className="px-3 py-2 font-bold">
                    {row.sourceProgramName}
                    <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-400">
                      {row.limitedSample ? 'limited sample' : row.modelVersion}
                    </span>
                    {selectedPerspective === 'resume' &&
                      row.disagreementReasons.length > 0 && (
                        <span className="mt-0.5 block text-[10px] font-normal text-neutral-500">
                          {row.disagreementReasons
                            .map(disagreementLabel)
                            .join(' · ')}
                        </span>
                      )}
                  </th>
                  <td className="px-3 py-2 text-sm text-neutral-500">
                    {row.conference ?? 'Independent'}
                  </td>
                  <td className="px-3 py-2 text-right font-black tabular-nums">
                    {formatPoints(row.power)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {row.powerRank ?? '—'}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                    {formatPoints(row.offense)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                    {formatPoints(row.defense)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {resumeVisible ? (row.resumeRank ?? '—') : 'Week 7'}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {resumeVisible && row.resume !== undefined
                      ? `${row.resume > 0 ? '+' : ''}${row.resume.toFixed(2)}`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 text-right font-bold tabular-nums">
                    {resumeVisible && row.rankDifference !== undefined
                      ? `${row.rankDifference > 0 ? '+' : ''}${row.rankDifference}`
                      : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MatchupLab({
  matchup,
  onSelectTeamA,
  onSelectTeamB,
  onSelectVenue,
  ratings,
  teamAKey,
  teamBKey,
  venue,
}: {
  matchup: UseQueryResult<Matchup, Error>
  onSelectTeamA: (programKey: string) => void
  onSelectTeamB: (programKey: string) => void
  onSelectVenue: (venue: Venue) => void
  ratings: Array<DashboardRating>
  teamAKey: string
  teamBKey: string
  venue: Venue
}) {
  if (ratings.length < 2) {
    return (
      <DashboardMessage
        title="A matchup needs two modeled teams."
        detail="Choose a season with a stored proprietary rating snapshot."
      />
    )
  }

  return (
    <div>
      <div className="grid gap-3 border-y-2 border-michigan-blue bg-white p-3 sm:grid-cols-3">
        <TeamSelect
          label="Team A"
          ratings={ratings}
          value={teamAKey}
          excludedValue={teamBKey}
          onChange={onSelectTeamA}
        />
        <TeamSelect
          label="Team B"
          ratings={ratings}
          value={teamBKey}
          excludedValue={teamAKey}
          onChange={onSelectTeamB}
        />
        <label className="grid gap-1 text-[10px] font-black uppercase tracking-[0.12em]">
          Venue
          <select
            value={venue}
            onChange={(event) => onSelectVenue(event.target.value as Venue)}
            className="border border-michigan-blue/30 bg-white px-2 py-2 text-sm font-bold normal-case tracking-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
          >
            <option value="team_a">Team A home</option>
            <option value="neutral">Neutral site</option>
            <option value="team_b">Team B home</option>
          </select>
        </label>
      </div>

      {matchup.isPending ? (
        <DashboardMessage title="Building the matchup…" />
      ) : matchup.isError ? (
        <DashboardMessage
          title="The matchup could not load."
          detail="Try another pair or reload the model snapshot."
          action={
            <button
              type="button"
              onClick={() => void matchup.refetch()}
              className="border border-michigan-blue px-3 py-1.5 text-xs font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
            >
              Retry
            </button>
          }
        />
      ) : matchup.data === null ? (
        <DashboardMessage
          title="This season does not have a matchup rating edition."
          detail="Choose a season whose proprietary ratings have been generated."
        />
      ) : (
        <MatchupResult matchup={matchup.data} />
      )}
    </div>
  )
}

function TeamSelect({
  excludedValue,
  label,
  onChange,
  ratings,
  value,
}: {
  excludedValue: string
  label: string
  onChange: (programKey: string) => void
  ratings: Array<DashboardRating>
  value: string
}) {
  return (
    <label className="grid gap-1 text-[10px] font-black uppercase tracking-[0.12em]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border border-michigan-blue/30 bg-white px-2 py-2 text-sm font-bold normal-case tracking-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
      >
        {ratings.map((rating) => (
          <option
            key={rating.programKey}
            value={rating.programKey}
            disabled={rating.programKey === excludedValue}
          >
            #{rating.rank} {rating.sourceProgramName}
          </option>
        ))}
      </select>
    </label>
  )
}

function MatchupResult({ matchup }: { matchup: NonNullable<Matchup> }) {
  const { projection, ratingA, ratingB } = matchup
  const projectedLeader =
    projection.projectedMargin >= 0
      ? ratingA.sourceProgramName
      : ratingB.sourceProgramName
  return (
    <div className="mt-5">
      <section className="border-b-4 border-michigan-maize bg-michigan-blue px-4 py-6 text-white sm:px-6">
        <p className="text-center text-[10px] font-black uppercase tracking-[0.16em] text-michigan-maize">
          CFB26 model · {projection.confidence}% evidence coverage
        </p>
        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
          <div>
            <p className="text-lg font-black sm:text-2xl">
              {ratingA.sourceProgramName}
            </p>
            <p className="mt-1 text-4xl font-black tabular-nums sm:text-5xl">
              {projection.projectedScore.teamA}
            </p>
            <p className="mt-1 text-xs font-bold text-white/70">
              {projection.teamAWinProbability}% win probability
            </p>
          </div>
          <div className="text-[10px] font-black uppercase tracking-[0.16em] text-white/50">
            vs
          </div>
          <div>
            <p className="text-lg font-black sm:text-2xl">
              {ratingB.sourceProgramName}
            </p>
            <p className="mt-1 text-4xl font-black tabular-nums sm:text-5xl">
              {projection.projectedScore.teamB}
            </p>
            <p className="mt-1 text-xs font-bold text-white/70">
              {projection.teamBWinProbability}% win probability
            </p>
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-white/65">
          Projected margin: {projectedLeader} by{' '}
          {Math.abs(projection.projectedMargin).toFixed(1)}. Model estimate, not
          a betting line.
        </p>
      </section>

      <section className="mt-6">
        <div className="border-b-2 border-michigan-blue pb-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
            Complementary unit ratings
          </p>
          <h3 className="text-xl font-black">Where the matchup tilts</h3>
        </div>
        <div>
          {projection.unitMatchups.map((unit) => (
            <UnitComparison
              key={unit.key}
              unit={unit}
              teamAName={ratingA.sourceProgramName}
              teamBName={ratingB.sourceProgramName}
            />
          ))}
        </div>
      </section>

      <section className="mt-6 grid gap-5 border-y-2 border-michigan-blue bg-white px-4 py-5 md:grid-cols-2">
        <RatingBreakdown rating={ratingA} />
        <RatingBreakdown rating={ratingB} />
      </section>

      <section className="mt-6 border-t-2 border-michigan-blue pt-3">
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
          Stored series history through {matchup.season}
        </p>
        <p className="mt-1 text-sm font-bold">
          {matchup.history.meetings === 0
            ? 'No completed meetings are stored since 2000.'
            : `${ratingA.sourceProgramName} ${matchup.history.teamAWins}–${matchup.history.teamBWins}${matchup.history.ties ? `–${matchup.history.ties}` : ''} in ${matchup.history.meetings} stored meetings.`}
        </p>
        {matchup.history.lastFive.length > 0 && (
          <ol className="mt-3 grid gap-x-6 md:grid-cols-2">
            {matchup.history.lastFive.map((game) => (
              <li
                key={game._id}
                className="flex items-center justify-between gap-3 border-t border-michigan-blue/15 py-2 text-xs"
              >
                <span className="font-bold">{game.season}</span>
                <span className="min-w-0 truncate">
                  {game.awaySourceName} at {game.homeSourceName}
                </span>
                <span className="font-black tabular-nums">
                  {game.awayPoints}–{game.homePoints}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

function UnitComparison({
  teamAName,
  teamBName,
  unit,
}: {
  teamAName: string
  teamBName: string
  unit: NonNullable<Matchup>['projection']['unitMatchups'][number]
}) {
  const difference = unit.teamA - unit.teamB
  const teamAWidth = Math.min(Math.max(50 + difference * 2, 5), 95)
  const teamBWidth = 100 - teamAWidth
  const edge =
    unit.key === 'volatility'
      ? 'Range of outcomes'
      : Math.abs(difference) < 2
        ? 'Even'
        : `${difference > 0 ? teamAName : teamBName} edge`
  return (
    <div className="grid gap-2 border-b border-michigan-blue/15 py-3 sm:grid-cols-[9rem_1fr_5rem] sm:items-center">
      <div>
        <p className="text-sm font-black">{unit.label}</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">
          {edge}
        </p>
      </div>
      <div>
        <div className="flex justify-between text-[10px] font-bold text-neutral-500">
          <span>{teamAName}</span>
          <span>{teamBName}</span>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1" aria-hidden="true">
          <div className="flex h-2 justify-end bg-michigan-blue-soft">
            <div
              className="h-full bg-michigan-blue"
              style={{ width: `${teamAWidth}%` }}
            />
          </div>
          <div className="h-2 bg-michigan-blue-soft">
            <div
              className="h-full bg-michigan-maize"
              style={{ width: `${teamBWidth}%` }}
            />
          </div>
        </div>
        <p className="mt-1 text-[10px] leading-4 text-neutral-500">
          {unit.description}
        </p>
      </div>
      <p className="text-right text-sm font-black tabular-nums">
        {Math.round(unit.teamA)}–{Math.round(unit.teamB)}
      </p>
    </div>
  )
}

function RatingBreakdown({
  rating,
}: {
  rating: NonNullable<Matchup>['ratingA']
}) {
  const isPowerRating = 'power' in rating
  const dimensions: Array<[string, number]> = isPowerRating
    ? [
        ['Power', rating.power],
        ['Offense', rating.offense],
        ['Defense', rating.defense],
        ['Special teams', rating.specialTeams],
        ['Home-field advantage', rating.homeFieldAdvantage],
        ...(rating.resume === undefined
          ? []
          : ([['Résumé', rating.resume]] as Array<[string, number]>)),
      ]
    : [
        ['Overall', rating.overall],
        ['Power', rating.dimensions.power],
        ['Offense', rating.dimensions.offense],
        ['Defense', rating.dimensions.defense],
        ['Talent', rating.dimensions.talent],
        ['Continuity', rating.dimensions.continuity],
        ['Résumé', rating.dimensions.resume],
        ['Form', rating.dimensions.form],
      ]
  return (
    <article>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-lg font-black">{rating.sourceProgramName}</h3>
        <span className="text-xs font-black tabular-nums">
          {isPowerRating
            ? `#${rating.powerRank ?? '—'} · ${formatPoints(rating.power)}`
            : `#${rating.rank} · ${Math.round(rating.overall)}`}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 text-xs">
        {dimensions.map(([label, value]) => (
          <div
            key={label}
            className="flex justify-between border-t border-michigan-blue/15 py-2"
          >
            <dt className="text-neutral-500">{label}</dt>
            <dd className="font-black tabular-nums">
              {isPowerRating ? formatPoints(value) : Math.round(value)}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[10px] leading-4 text-neutral-500">
        {isPowerRating
          ? `${rating.gamesPlayed} games · ${Math.round(rating.priorWeight * 100)}% preseason prior · ${rating.dataSources.length} sources`
          : `${rating.signalCount} signals · ${rating.dataSources.length} sources · ${Math.round(rating.confidence)}% coverage`}
      </p>
    </article>
  )
}

function DashboardMessage({
  action,
  detail,
  title,
}: {
  action?: ReactNode
  detail?: string
  title: string
}) {
  return (
    <div className="border-y-2 border-michigan-blue bg-white px-4 py-10 text-center">
      <p className="text-lg font-black">{title}</p>
      {detail && (
        <p className="mx-auto mt-1 max-w-xl text-sm text-neutral-500">
          {detail}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function LandscapeLoading() {
  return <DashboardMessage title="Loading the college football landscape…" />
}

export function LandscapeError() {
  return (
    <DashboardMessage
      title="The landscape could not load."
      detail="Reload the page or check the Convex connection."
    />
  )
}
