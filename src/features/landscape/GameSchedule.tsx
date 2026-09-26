import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { gameStatus, scheduleSections } from './gameTimeSlots'
import type { FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'

type Schedule = FunctionReturnType<typeof api.ratings.getWeeklyDashboard>
type Game = Schedule['games'][number]
type Lens = 'landscape' | 'michigan'

export function GameSchedule({ data }: { data: Schedule }) {
  const [lens, setLens] = useState<Lens>('landscape')
  const [now, setNow] = useState(data.generatedAt)
  useEffect(() => {
    const refresh = () => setNow(Date.now())
    refresh()
    const timer = window.setInterval(refresh, 30_000)
    return () => window.clearInterval(timer)
  }, [])
  const sections = useMemo(
    () => scheduleSections(data.games, lens, now),
    [data.games, lens, now],
  )

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-xs text-white/50">Prioritize</span>
        <div className="flex gap-2">
          {(['landscape', 'michigan'] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={lens === option}
              onClick={() => setLens(option)}
              className={`min-h-11 rounded-full border border-white/10 px-4 text-xs font-bold capitalize focus-visible:outline-2 focus-visible:outline-offset-2 ${lens === option ? 'app-filter-active' : 'text-white/50'}`}
            >
              {option}
            </button>
          ))}
        </div>
        <span className="text-xs text-white/40 sm:ml-auto">
          Kickoffs in your local time
        </span>
      </div>
      {sections.length === 0 && (
        <p className="py-8 text-center text-sm text-white/50">
          No games scheduled for this week.
        </p>
      )}
      {sections.map((section) => (
        <section
          key={section.label}
          aria-label={section.label}
          className="mb-8"
        >
          <h2 className="font-display mb-3 text-2xl font-bold text-white">
            {section.label}
          </h2>
          <div className="app-card overflow-hidden p-0">
            {section.groups.map((group) => (
              <section
                key={group.key}
                aria-label={`${group.dateLabel}, ${group.label}`}
              >
                <h3 className="app-ranking-header flex flex-wrap items-baseline gap-x-2 border-y border-white/10 px-3 py-2 text-xs sm:px-5">
                  <span className="font-semibold text-white/70">
                    {group.dateLabel}
                  </span>
                  <span className="text-white/40">{group.label}</span>
                </h3>
                {group.games.map((game) => (
                  <GameRow key={game._id} game={game} lens={lens} now={now} />
                ))}
              </section>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function GameRow({ game, lens, now }: { game: Game; lens: Lens; now: number }) {
  const status = gameStatus(game, now)
  const final = status === 'Final'
  const highlightsMichigan = [game.homeSourceName, game.awaySourceName].some(
    (name) => name === 'Michigan',
  )
  const kickoff = new Date(game.startTime)
  return (
    <details
      className={`group border-b border-white/10 last:border-b-0 ${highlightsMichigan ? 'michigan-highlight' : ''}`}
    >
      <summary className="grid cursor-pointer list-none grid-cols-[4.5rem_minmax(0,1fr)_1rem] items-center gap-2 px-3 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2 sm:grid-cols-[6rem_minmax(0,1fr)_1rem] sm:gap-4 sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="self-start pt-0.5 text-xs font-semibold tabular-nums text-white/60">
          {status === 'Upcoming' ? (
            <time dateTime={kickoff.toISOString()}>
              {kickoff.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </time>
          ) : (
            <span className={final ? 'font-bold uppercase text-white/75' : ''}>
              {status}
            </span>
          )}
        </div>
        <div className="min-w-0">
          <ScheduleTeam
            name={game.awaySourceName}
            rank={game.awayRank}
            score={final ? game.awayPoints : undefined}
            winner={final && game.awayPoints! > game.homePoints!}
          />
          <ScheduleTeam
            name={game.homeSourceName}
            rank={game.homeRank}
            marker={game.neutralSite ? 'vs' : '@'}
            score={final ? game.homePoints : undefined}
            winner={final && game.homePoints! > game.awayPoints!}
          />
          {status === 'Upcoming' && game.tvOutlets?.length ? (
            <p className="mt-1 pl-5 text-[11px] text-white/45">
              {game.tvOutlets.join(', ')}
            </p>
          ) : null}
        </div>
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 text-white/40 transition-transform group-open:rotate-180"
        />
        <span className="sr-only">Game details</span>
      </summary>
      <div className="border-t border-white/10 px-4 py-3 text-xs leading-relaxed text-white/60 sm:px-5">
        <p>
          {game.venue ?? 'Venue TBD'}
          {game.neutralSite ? ' · Neutral site' : ''}
        </p>
        <p>Scheduled kickoff: {kickoff.toLocaleString()}</p>
        {status !== 'Upcoming' && game.tvOutlets?.length ? (
          <p>{game.tvOutlets.join(', ')}</p>
        ) : null}
        {status === 'Started' && (
          <p className="mt-2">
            Kickoff has passed. A live score is not available.
          </p>
        )}
        {status === 'Result pending' && (
          <p className="mt-2">The final score has not been reported yet.</p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className={lens === 'landscape' ? 'font-bold' : ''}>
              Landscape
            </dt>
            <dd>{game.landscapeRating} / 100</dd>
          </div>
          <div>
            <dt className={lens === 'michigan' ? 'font-bold' : ''}>Michigan</dt>
            <dd>{game.michiganRating} / 100</dd>
          </div>
          {status === 'Upcoming' && (
            <>
              <div>
                <dt>Power · away / home</dt>
                <dd>
                  {signed(game.awayRating)} / {signed(game.homeRating)}
                </dd>
              </div>
              <div>
                <dt>Projected home margin</dt>
                <dd>{signed(game.projectedMargin)}</dd>
              </div>
            </>
          )}
        </dl>
        {lens === 'michigan' && (
          <p className="mt-3">{game.michiganReasons.join(' · ')}</p>
        )}
      </div>
    </details>
  )
}

function ScheduleTeam({
  name,
  rank,
  marker,
  score,
  winner,
}: {
  name: string
  rank?: number
  marker?: string
  score?: number
  winner: boolean
}) {
  return (
    <div className="flex items-baseline gap-1 py-0.5 text-sm sm:text-base">
      <span className="w-4 shrink-0 text-[10px] text-white/40">{marker}</span>
      <span
        className={`min-w-0 flex-1 ${name === 'Michigan' ? 'michigan-accent' : 'text-white'} ${winner ? 'font-extrabold' : 'font-semibold'}`}
      >
        {rank !== undefined && (
          <span className="mr-1 text-[10px] font-normal text-white/45">
            #{rank}
          </span>
        )}
        {name}
      </span>
      {score !== undefined && (
        <span
          className={`ml-2 text-base tabular-nums ${winner ? 'font-extrabold text-white' : 'text-white/60'}`}
        >
          {score}
          <span className="sr-only"> points{winner ? ', winner' : ''}</span>
        </span>
      )}
    </div>
  )
}

function signed(value: number | null) {
  return value === null ? 'N/A' : `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}
