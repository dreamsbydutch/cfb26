import { useEffect, useRef, useState } from 'react'
import {
  isMichiganGame,
  manualTvPlan,
  parseTvOverrides,
  tvSlotMemory,
  watchBoard,
} from './watchRating'
import { CompactWatchGame } from './CompactWatchGame'
import { TvOverrideEditor } from './TvOverrideEditor'
import type { ManualTvEvent, TvOverrides, TvSlot } from './watchRating'
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
  const [overrides, setOverrides] = useState<TvOverrides>(() =>
    parseTvOverrides(null),
  )
  const [editing, setEditing] = useState<number | null>(null)
  const editButtons = useRef(new Map<number, HTMLButtonElement>())
  const closeEditor = () => {
    if (editing !== null) editButtons.current.get(editing)?.focus()
    setEditing(null)
  }
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
    try {
      setOverrides(
        parseTvOverrides(
          JSON.parse(localStorage.getItem('cfb-tv-overrides-v1') ?? 'null'),
        ),
      )
    } catch {
      /* Invalid or unavailable storage leaves automatic slots. */
    }
    setLoaded(true)
  }, [])
  const ranked = [...board.active, ...board.next]
  const { slots, disabled } = manualTvPlan(
    ranked.map((row) => row.game),
    memory,
    overrides,
    now,
  )
  const serialized = JSON.stringify(
    tvSlotMemory(slots).map((slot, index) => {
      const manual = overrides.at(index)
      return manual && !disabled.includes(index)
        ? { id: '', networks: [manual.network.trim().toLowerCase()] }
        : slot
    }),
  )
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem('cfb-tv-overrides-v1', JSON.stringify(overrides))
    } catch {
      /* Keep the current session usable without storage. */
    }
  }, [loaded, overrides])
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
      {editing !== null && (
        <TvOverrideEditor
          key={`${editing}:${JSON.stringify(overrides)}`}
          label={assignments.at(editing)?.label ?? 'TV'}
          main={overrides.at(editing * 2) ?? null}
          backup={overrides.at(editing * 2 + 1) ?? null}
          onCancel={closeEditor}
          onSave={(main, backup) => {
            setOverrides((previous) =>
              previous.map((slot, i) =>
                i === editing * 2
                  ? main
                  : i === editing * 2 + 1
                    ? backup
                    : slot,
              ),
            )
            closeEditor()
          }}
        />
      )}
      <div className="grid grid-cols-2 gap-2">
        {assignments.map((tv, index) => (
          <section
            key={tv.label}
            aria-label={tv.label}
            className={`app-card min-w-0 p-3 ${tv.label === 'Main TV' ? 'col-span-2' : ''} ${tv.main && isMichiganGame(tv.main.game) ? 'michigan-highlight' : ''}`}
          >
            <div className="mb-2 flex items-center justify-between gap-1">
              <h3 className="text-[11px] font-bold uppercase tracking-wide text-white/50">
                {tv.label}
              </h3>
              <button
                ref={(element) => {
                  if (element) editButtons.current.set(index, element)
                  else editButtons.current.delete(index)
                }}
                type="button"
                aria-label={`Edit ${tv.label}`}
                aria-expanded={editing === index}
                onClick={() => setEditing(editing === index ? null : index)}
                className="min-h-8 rounded px-1 text-[11px] text-white/50 focus-visible:outline-2"
              >
                Edit
              </button>
            </div>
            {overrides.at(index * 2) ? (
              <ManualEvent event={overrides.at(index * 2)} />
            ) : tv.main ? (
              <CompactWatchGame game={tv.main.game} now={now} />
            ) : (
              <p className="text-xs text-white/40">No game available</p>
            )}
            {!disabled.includes(index * 2 + 1) &&
              (overrides.at(index * 2 + 1) || tv.backup) && (
                <div className="mt-3 border-t border-white/10 pt-2">
                  <p className="mb-1 text-[10px] font-semibold uppercase text-white/40">
                    Flip to
                  </p>
                  {overrides.at(index * 2 + 1) ? (
                    <ManualEvent event={overrides.at(index * 2 + 1)} />
                  ) : (
                    tv.backup && (
                      <CompactWatchGame game={tv.backup.game} now={now} />
                    )
                  )}
                </div>
              )}
          </section>
        ))}
      </div>
      {!board.active.length &&
        !board.next.length &&
        !overrides.some(Boolean) && (
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
          comebacks rise; blowouts fall. In automatic mode, Michigan takes the
          main TV with no backup. Otherwise the main TV keeps its game while it
          stays in the top three, with a sixth game for commercial breaks. B and
          C preserve their games and networks within the next four picks.
          Upcoming games fill empty slots. Assignments are remembered in this
          browser. Scores refresh about every five minutes; delayed scores are
          provisional. Open a game for timing, ratings, and projection details.
          Manual events reserve their slots until cleared. A manual main event
          can disable flipping on that TV. Automatic football fills the
          remaining slots, with Michigan taking the first available main slot.
          Manual selections take priority.
        </p>
      </details>
    </div>
  )
}

function ManualEvent({ event }: { event: ManualTvEvent | null | undefined }) {
  if (!event) return null
  return (
    <div className="min-w-0 break-words">
      <p className="mb-1 text-base font-extrabold text-white">
        {event.network}
      </p>
      <p className="text-sm font-semibold text-white">{event.event}</p>
    </div>
  )
}
