import { useEffect, useState } from 'react'
import {
  isMichiganGame,
  stableTvPlan,
  tvSlotMemory,
  watchBoard,
} from './watchRating'
import { CompactWatchGame } from './CompactWatchGame'
import type { TvSlot } from './watchRating'
import type { CompactGame } from './CompactWatchGame'

type TelevisionGame = CompactGame

export function WatchNow<T extends TelevisionGame>({
  games,
  now,
}: {
  games: Array<T>
  now: number
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
      <h2 className="font-display mb-3 text-xl font-bold text-white">
        Your TV lineup
      </h2>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        {assignments.map((tv) => (
          <section
            key={tv.label}
            aria-label={tv.label}
            className={`app-card min-w-0 p-3 ${tv.label === 'Main TV' ? 'col-span-2 md:col-span-1' : ''} ${tv.main && isMichiganGame(tv.main.game) ? 'michigan-highlight' : ''}`}
          >
            <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-white/50">
              {tv.label}
            </h3>
            {tv.main ? (
              <CompactWatchGame game={tv.main.game} now={now} />
            ) : (
              <p className="text-xs text-white/40">No game available</p>
            )}
            {(tv.label !== 'Main TV' ||
              (tv.main && !isMichiganGame(tv.main.game))) &&
              tv.backup && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase text-white/40">
                    Flip to
                  </p>
                  <CompactWatchGame game={tv.backup.game} now={now} />
                </div>
              )}
          </section>
        ))}
      </div>
      {!board.active.length && !board.next.length && (
        <p className="py-4 text-sm text-white/50">
          No live or upcoming games in this week. Choose another week or view
          results in Landscape.
        </p>
      )}
      {ranked.length > 0 && (
        <details className="mt-4 text-xs text-white/50">
          <summary className="cursor-pointer py-2 focus-visible:outline-2">
            All games ({ranked.length})
          </summary>
          <div className="app-card mt-2 divide-y divide-white/10 p-0">
            {ranked.map((row) => (
              <div key={row.game._id} className="px-3 py-2">
                <CompactWatchGame game={row.game} now={now} />
              </div>
            ))}
          </div>
        </details>
      )}
      <details className="mt-1 text-xs text-white/50">
        <summary className="cursor-pointer py-2 focus-visible:outline-2">
          How Watch now works
        </summary>
        <p className="max-w-2xl leading-relaxed">
          Landscape sets the starting score. Close finishes, overtime, and
          comebacks rise; blowouts fall. Michigan always takes the main TV with
          no backup. Otherwise the main TV keeps its game while it stays in the
          top three, with a sixth game for commercial breaks. B and C preserve
          their games and networks within the next four picks. Upcoming games
          fill empty slots. Assignments are remembered in this browser. Scores
          refresh about every five minutes; delayed scores are provisional. Open
          a game for timing, ratings, and projection details.
        </p>
      </details>
    </div>
  )
}
