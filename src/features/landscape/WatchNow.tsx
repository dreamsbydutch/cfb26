import { useEffect, useState } from 'react'
import {
  isMichiganGame,
  stableTvPlan,
  tvSlotMemory,
  watchBoard,
} from './watchRating'
import type { TvSlot, WatchGame } from './watchRating'
import type { ReactNode } from 'react'

type TelevisionGame = WatchGame & { tvOutlets?: Array<string> }

export function WatchNow<T extends TelevisionGame>({
  games,
  now,
  renderGame,
}: {
  games: Array<T>
  now: number
  renderGame: (game: T) => ReactNode
}) {
  const board = watchBoard(games, now)
  const [memory, setMemory] = useState<Array<TvSlot>>([])
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem('cfb-tv-slots-v2') ?? '[]',
      )
      if (Array.isArray(stored) && stored.length <= 6) {
        const valid = stored.filter(
          (slot): slot is TvSlot =>
            typeof slot === 'object' &&
            slot !== null &&
            typeof slot.id === 'string' &&
            Array.isArray(slot.networks) &&
            slot.networks.every(
              (network: unknown) => typeof network === 'string',
            ),
        )
        setMemory(valid)
      }
    } catch {
      /* Storage can be unavailable in private browsing. */
    }
    setLoaded(true)
  }, [])
  const ranked = [...board.active, ...board.next]
  const slots = stableTvPlan(
    ranked.map((row) => row.game),
    memory,
    now,
  )
  const serialized = JSON.stringify(tvSlotMemory(slots))
  useEffect(() => {
    if (!loaded) return
    const next: Array<TvSlot> = JSON.parse(serialized)
    setMemory((previous) =>
      JSON.stringify(previous) === serialized ? previous : next,
    )
    try {
      localStorage.setItem('cfb-tv-slots-v2', serialized)
    } catch {
      /* Keep in-memory assignments. */
    }
  }, [loaded, serialized])
  const rowFor = (game: T | undefined) =>
    ranked.find((row) => row.game._id === game?._id)
  const assignments = [
    { label: 'Main TV', main: rowFor(slots[0]), backup: rowFor(slots[1]) },
    { label: 'TV B', main: rowFor(slots[2]), backup: rowFor(slots[3]) },
    { label: 'TV C', main: rowFor(slots[4]), backup: rowFor(slots[5]) },
  ]
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl font-bold text-white">
          Your TV lineup
        </h2>
        <span className="text-xs text-white/50">
          Michigan first. Best finishes next.
        </span>
      </div>
      <div className="mb-3 grid gap-3 md:grid-cols-3">
        {assignments.map((tv) => (
          <section
            key={tv.label}
            aria-label={tv.label}
            className={`app-card min-w-0 p-4 ${tv.main && isMichiganGame(tv.main.game) ? 'michigan-highlight' : ''}`}
          >
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-white/60">
              {tv.label}
            </h3>
            {tv.main ? (
              <Pick row={tv.main} now={now} />
            ) : (
              <p className="text-sm text-white/50">No game available</p>
            )}
            {(tv.label !== 'Main TV' ||
              (tv.main && !isMichiganGame(tv.main.game))) && (
              <div className="mt-4 border-t border-white/10 pt-3">
                <p className="mb-2 text-[11px] font-bold uppercase text-white/40">
                  {tv.label === 'Main TV' ? 'Commercial-break pick' : 'Flip to'}
                </p>
                {tv.backup ? (
                  <Pick row={tv.backup} now={now} />
                ) : (
                  <p className="text-xs text-white/40">No backup available</p>
                )}
              </div>
            )}
          </section>
        ))}
      </div>
      <p className="mb-6 text-xs text-white/45">
        Updates with scores about every five minutes. Clock is the last reported
        game clock.
      </p>
      {board.active.length > 0 && (
        <section aria-label="Watch now rankings" className="mb-6">
          <h2 className="font-display mb-3 text-2xl font-bold text-white">
            On now · ranked across all kickoffs
          </h2>
          <div className="app-card overflow-hidden p-0">
            {board.active.map((row) => renderGame(row.game))}
          </div>
        </section>
      )}
      {board.next.length > 0 && (
        <section aria-label="Next games">
          <h2 className="font-display mb-3 text-2xl font-bold text-white">
            Up next
          </h2>
          <div className="app-card overflow-hidden p-0">
            {board.next.map((row) => renderGame(row.game))}
          </div>
        </section>
      )}
      {!board.active.length && !board.next.length && (
        <p className="py-6 text-sm text-white/50">
          No live or upcoming games in this week. Choose another week or view
          results in Landscape.
        </p>
      )}
      <details className="mt-5 text-xs text-white/50">
        <summary className="cursor-pointer py-2 focus-visible:outline-2">
          How Watch now works
        </summary>
        <p className="max-w-2xl leading-relaxed">
          Landscape sets the starting score. Close finishes and overtime rise,
          late blowouts fall, and recent comebacks get a boost. Michigan always
          takes the main TV while playing, even in a blowout. The main TV keeps
          its game while it stays in the top three. B and C keep their games and
          networks as ranks change within the next four picks. A sixth game is
          the commercial-break pick for the main TV, except Michigan has no
          backup. Upcoming games fill empty slots from the next kickoff window.
          Delayed scores are provisional and rank below fresh live scores,
          except Michigan. These are viewing recommendations, not win
          probabilities.
        </p>
      </details>
    </div>
  )
}

function Pick({
  row,
  now,
}: {
  now: number
  row: NonNullable<
    ReturnType<typeof watchBoard<TelevisionGame>>['assignments'][number]['main']
  >
}) {
  const { game } = row
  const live =
    game.liveScore?.status === 'in_progress' ? game.liveScore : undefined
  const kickoff = new Date(game.startTime)
  return (
    <div>
      <p className="mb-2 text-xl font-extrabold tracking-tight text-white">
        {game.tvOutlets?.length ? game.tvOutlets.join(' / ') : 'Network TBD'}
      </p>
      <p className="mb-1 text-[11px] font-semibold text-white/50">
        {row.state === 'upcoming' ? (
          <>
            Up next ·{' '}
            {kickoff.toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })}
          </>
        ) : row.state === 'live' ? (
          'Live'
        ) : (
          'Awaiting fresh score'
        )}
        {' · '}Watch {row.score}
      </p>
      <p className="flex justify-between gap-2 text-sm font-semibold text-white">
        <span>{game.awaySourceName}</span>
        <span>{live?.awayPoints}</span>
      </p>
      <p className="flex justify-between gap-2 text-sm font-semibold text-white">
        <span>{game.homeSourceName}</span>
        <span>{live?.homePoints}</span>
      </p>
      {live && (
        <p className="mt-1 text-[11px] text-white/50">
          {live.period
            ? live.period > 4
              ? 'OT'
              : `Q${live.period}`
            : 'In progress'}
          {live.clock ? ` · ${live.clock}` : ''} · Updated{' '}
          {Math.max(0, Math.floor((now - live.updatedAt) / 60_000))}m ago
        </p>
      )}
      <p className="mt-2 text-xs font-semibold text-white/65">
        {isMichiganGame(game) ? 'Michigan priority · ' : ''}
        {row.reason}
      </p>
    </div>
  )
}
