import { convexAction } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { seasonLabel } from '../../../convex/teamRosterFields'
import type { Id } from '../../../convex/_generated/dataModel'
import type { NhlHistory, NhlStats } from '../../../convex/hockeyNhlFields'

const skaterColumns = [
  ['GP', 'gamesPlayed'],
  ['G', 'goals'],
  ['A', 'assists'],
  ['PTS', 'points'],
  ['+/−', 'plusMinus'],
  ['PIM', 'pim'],
] as const
const goalieColumns = [
  ['GP', 'gamesPlayed'],
  ['W', 'wins'],
  ['L', 'losses'],
  ['OTL', 'otLosses'],
  ['SV%', 'savePctg'],
  ['GAA', 'goalsAgainstAvg'],
  ['SO', 'shutouts'],
] as const

export function NhlHistoryTable({
  history,
  gameType,
}: {
  history: NhlHistory
  gameType: 2 | 3
}) {
  const columns = history.goalie ? goalieColumns : skaterColumns
  const total = gameType === 2 ? history.regularSeason : history.playoffs
  const seasons = history.seasons.filter((row) => row.gameType === gameType)
  const format = (stats: NhlStats, key: keyof NhlStats) => {
    const value = stats[key]
    return value === null
      ? '—'
      : key === 'savePctg'
        ? value.toFixed(3)
        : key === 'goalsAgainstAvg'
          ? value.toFixed(2)
          : value
  }
  if (!seasons.length && !(total?.gamesPlayed && total.gamesPlayed > 0))
    return (
      <p className="py-4 text-sm text-slate-600">
        No NHL {gameType === 2 ? 'regular-season' : 'playoff'} appearances
        recorded.
      </p>
    )
  return (
    <div
      role="region"
      aria-label="NHL season history"
      tabIndex={0}
      className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-[#00274c]"
    >
      <table className="w-full whitespace-nowrap text-right text-xs tabular-nums">
        <caption className="sr-only">
          NHL {gameType === 2 ? 'regular season' : 'playoffs'} career totals and
          individual club seasons
        </caption>
        <thead className="bg-slate-100">
          <tr>
            <th scope="col" className="px-3 py-2 text-left">
              Season
            </th>
            <th scope="col" className="px-3 py-2 text-left">
              Team
            </th>
            {columns.map(([label]) => (
              <th scope="col" key={label} className="px-3 py-2">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {total && (
            <tr className="border-b-2 border-[#00274c] bg-[#ffcb05]/15 font-bold">
              <th scope="row" className="px-3 py-2 text-left">
                NHL career
              </th>
              <td className="px-3 py-2 text-left">All teams</td>
              {columns.map(([label, key]) => (
                <td key={label} className="px-3 py-2">
                  {format(total, key)}
                </td>
              ))}
            </tr>
          )}
          {seasons.map((row, index) => (
            <tr
              key={`${row.season}:${row.team}:${index}`}
              className="border-b border-slate-200"
            >
              <th scope="row" className="px-3 py-2 text-left font-medium">
                {seasonLabel(Math.floor(row.season / 10000))}
              </th>
              <td className="px-3 py-2 text-left">{row.team}</td>
              {columns.map(([label, key]) => (
                <td key={label} className="px-3 py-2">
                  {format(row.stats, key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CareerDialog({
  rosterId,
  name,
  onClose,
}: {
  rosterId: Id<'teamRosterEntries'>
  name: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const [gameType, setGameType] = useState<2 | 3>(2)
  const history = useQuery({
    ...convexAction(api.hockeyNhl.forPlayer, { rosterId }),
    staleTime: 15 * 60_000,
    gcTime: 30 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
  })
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (!ref.current?.open) onClose()
      }}
      aria-labelledby={`nhl-title-${rosterId}`}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto rounded-lg border border-slate-300 bg-white p-0 text-left font-normal text-[#00274c] shadow-xl backdrop:bg-slate-950/50"
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
        <div>
          <h2 id={`nhl-title-${rosterId}`} className="text-lg font-bold">
            {name} · NHL career
          </h2>
          <p className="mt-1 whitespace-normal text-xs text-slate-500">
            Entire NHL career, including seasons after Michigan.
          </p>
        </div>
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label="Close NHL career"
          className="min-h-9 shrink-0 rounded border border-slate-300 px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Close
        </button>
      </header>
      <div className="p-4">
        {history.isPending ? (
          <p role="status" className="text-sm">
            Loading NHL history…
          </p>
        ) : history.isError ? (
          <div role="alert">
            <p className="whitespace-normal text-sm">
              NHL history could not load.
            </p>
            <button
              type="button"
              onClick={() => void history.refetch()}
              className="mt-2 min-h-9 rounded border border-slate-300 px-3 text-xs font-bold focus-visible:outline-2"
            >
              Try again
            </button>
          </div>
        ) : history.data.status === 'unmatched' ? (
          <p className="whitespace-normal text-sm text-slate-600">
            No verified NHL profile found for this Michigan player. NHL
            appearances are unknown.
          </p>
        ) : (
          <>
            <div
              role="group"
              aria-label="NHL competition"
              className="mb-3 flex gap-1 border-b border-slate-200"
            >
              {([2, 3] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={gameType === type}
                  onClick={() => setGameType(type)}
                  className={`min-h-9 border-b-2 px-3 py-1 text-xs font-bold focus-visible:outline-2 ${gameType === type ? 'border-[#00274c]' : 'border-transparent text-slate-500'}`}
                >
                  {type === 2 ? 'Regular season' : 'Playoffs'}
                </button>
              ))}
            </div>
            <NhlHistoryTable history={history.data} gameType={gameType} />
            <p className="mt-3 whitespace-normal text-[11px] text-slate-500">
              Traded seasons show a row for each team.{' '}
              <a
                href={`https://www.nhl.com/player/${history.data.playerId}`}
                target="_blank"
                rel="noreferrer"
                className="underline focus-visible:outline-2"
              >
                NHL player profile
              </a>
            </p>
          </>
        )}
      </div>
    </dialog>
  )
}

export function HockeyNhlCareer({
  rosterId,
  name,
}: {
  rosterId: Id<'teamRosterEntries'>
  name: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={`View ${name}'s NHL career`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="rounded text-left font-bold decoration-slate-300 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {name}
      </button>
      {open && (
        <CareerDialog
          rosterId={rosterId}
          name={name}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
