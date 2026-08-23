import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { ReactNode } from 'react'

type Lens = 'national' | 'michigan'
type View = 'games' | 'rankings'
type Dashboard = FunctionReturnType<typeof api.ratings.getWeeklyDashboard>
type DashboardGame = Dashboard['games'][number]

const CURRENT_SEASON = new Date().getFullYear()
const seasons = Array.from(
  { length: CURRENT_SEASON - 1999 },
  (_, index) => CURRENT_SEASON - index,
)
const weeks = Array.from({ length: 21 }, (_, index) => index)

export function LandscapeDashboard() {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [week, setWeek] = useState<number | undefined>()
  const [lens, setLens] = useState<Lens>('national')
  const [view, setView] = useState<View>('games')
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
            {view === 'games' ? 'What matters this week' : 'National ratings'}
          </h2>
          <p className="mt-1 text-sm leading-5 text-neutral-600">
            {view === 'games'
              ? 'National importance combines team strength and matchup competitiveness. The Michigan lens adds direct games, season opponents, and the Big Ten race.'
              : 'Every available team is ordered by the latest CFBD Elo snapshot for the selected season.'}
          </p>
        </div>

        {dashboard.isPending ? (
          <DashboardMessage title="Loading the landscape…" />
        ) : dashboard.isError ? (
          <DashboardMessage
            title="The landscape could not load."
            detail="Check the development Convex connection and try again."
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
          <RankingsTable ratings={dashboard.data.ratings} />
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
                {dashboard.data.ratingCount} rated teams
              </p>
            </div>
            {games.length === 0 ? (
              <DashboardMessage
                title="Game data is ready to connect."
                detail="The dashboard will populate after the CFBD key arrives and the first development backfill completes."
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

function RankingsTable({ ratings }: { ratings: Dashboard['ratings'] }) {
  if (ratings.length === 0) {
    return (
      <DashboardMessage
        title="Ratings are ready to connect."
        detail="The national table will populate after the CFBD key arrives and the ratings backfill completes."
      />
    )
  }
  return (
    <div className="overflow-x-auto border-t-2 border-michigan-blue">
      <table className="w-full min-w-[560px] border-collapse text-left">
        <caption className="sr-only">National team Elo rankings</caption>
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
              Rating
            </th>
          </tr>
        </thead>
        <tbody>
          {ratings.map((row) => (
            <tr
              key={row._id}
              className={`border-b border-michigan-blue/15 ${
                row.sourceProgramName === 'Michigan'
                  ? 'bg-michigan-maize-soft font-black'
                  : 'bg-white'
              }`}
            >
              <td className="px-3 py-2 font-black tabular-nums">{row.rank}</td>
              <th scope="row" className="px-3 py-2 font-bold">
                {row.sourceProgramName}
              </th>
              <td className="px-3 py-2 text-sm text-neutral-500">
                {row.conference ?? 'Independent'}
              </td>
              <td className="px-3 py-2 text-right font-black tabular-nums">
                {Math.round(row.rating)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
      detail="Reload the page or check the Convex development connection."
    />
  )
}
