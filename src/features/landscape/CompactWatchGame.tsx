import { ChevronDown } from 'lucide-react'
import { watchRating } from './watchRating'
import type { WatchGame } from './watchRating'

export type CompactGame = WatchGame & { projectedMargin?: number | null }

export function CompactWatchGame({
  game,
  now,
}: {
  game: CompactGame
  now: number
}) {
  const live =
    game.liveScore?.status === 'in_progress' ? game.liveScore : undefined
  const margin = game.projectedMargin
  const rating = watchRating(game, now)
  return (
    <details className="group/game min-w-0">
      <summary className="cursor-pointer list-none rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-base font-extrabold text-white">
            {game.tvOutlets?.length
              ? game.tvOutlets.join(' / ')
              : 'Network TBD'}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-3 w-3 shrink-0 text-white/40 transition-transform group-open/game:rotate-180"
          />
        </div>
        {[
          {
            name: game.awaySourceName,
            score: live?.awayPoints,
            spread: margin != null && margin < 0 ? margin : null,
          },
          {
            name: game.homeSourceName,
            score: live?.homePoints,
            spread: margin != null && margin > 0 ? -margin : null,
          },
        ].map((team) => (
          <div
            key={team.name}
            className="flex items-baseline justify-between gap-2 py-0.5 text-sm"
          >
            <span
              className={`min-w-0 font-semibold ${team.name === 'Michigan' ? 'michigan-accent' : 'text-white'}`}
            >
              {team.name}
              {team.spread !== null && (
                <span
                  className="ml-1 inline-block text-[11px] font-normal tabular-nums text-white/40"
                  title="Pregame projected winning margin"
                  aria-label={`Pregame projection: ${team.name} by ${Math.abs(team.spread).toFixed(1)}`}
                >
                  {team.spread.toFixed(1)}
                </span>
              )}
            </span>
            {team.score != null && (
              <span className="shrink-0 font-bold tabular-nums text-white">
                {team.score}
                <span className="sr-only"> points</span>
              </span>
            )}
          </div>
        ))}
        {margin === 0 && (
          <span className="text-[11px] text-white/40">Projected even</span>
        )}
        <span className="sr-only">Game details</span>
      </summary>
      <div className="mt-2 border-t border-white/10 pt-2 text-xs leading-relaxed text-white/50">
        <p>
          {new Date(game.startTime).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })}
        </p>
        <p>
          {rating.state === 'upcoming'
            ? 'Up next'
            : rating.state === 'live'
              ? 'Live'
              : 'Awaiting fresh score'}
        </p>
        {live && (
          <p>
            {live.period
              ? live.period > 4
                ? 'OT'
                : `Q${live.period}`
              : 'In progress'}
            {live.clock ? ` · ${live.clock}` : ''}
          </p>
        )}
        <p>
          Watch {rating.score} · {rating.reason}
        </p>
        <p>Landscape {game.landscapeRating}</p>
        <p>
          Pregame model projection:{' '}
          {margin == null
            ? 'unavailable'
            : margin === 0
              ? 'even'
              : `${margin > 0 ? game.homeSourceName : game.awaySourceName} by ${Math.abs(margin).toFixed(1)}`}
        </p>
      </div>
    </details>
  )
}
