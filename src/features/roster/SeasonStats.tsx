import { useMemo, useState } from 'react'
import { useSeasonalStats } from './useMichiganRoster'
import type { EnrichedPlayer, SeasonStatEntry } from './useMichiganRoster'

const seasons = [
  2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015,
]

type Sort = 'snaps' | 'rating' | 'name'

export function SeasonStats({
  players,
  search,
  select,
}: {
  players: Array<EnrichedPlayer>
  search: string
  select: (player: EnrichedPlayer) => void
}) {
  const [season, setSeason] = useState(2025)
  const [sort, setSort] = useState<Sort>('snaps')
  const { data = [], isPending, isError, refetch } = useSeasonalStats(season)
  const playersById = useMemo(
    () => new Map(players.map((entry) => [entry.player._id, entry])),
    [players],
  )
  const rows = useMemo(
    () =>
      data
        .filter((entry) => matchesSearch(entry, search))
        .sort((a, b) => compareRows(a, b, sort)),
    [data, search, sort],
  )
  const participantCount = data.filter((entry) => entry.stat).length
  const totalSnaps = data.reduce(
    (total, entry) => total + (entry.stat?.snaps ?? 0),
    0,
  )
  const zeroSnapCount = data.length - participantCount

  return (
    <>
      <div className="mb-7 max-w-3xl">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a6700]">
          PFF season archive · 2015–2025
        </p>
        <h2 className="font-serif text-3xl font-black tracking-[-0.02em] text-[#00274c] sm:text-4xl">
          Snap counts and grades
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#111820]/60 sm:text-base">
          Compare Michigan participation and PFF grades by season. Rostered
          players absent from the participation file are shown with zero snaps
          and a zero grade.
        </p>
      </div>

      <div className="-mx-1 mb-6 overflow-x-auto pb-2">
        <div className="flex min-w-max gap-2 px-1">
          {seasons.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeason(value)}
              aria-pressed={season === value}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c] ${
                season === value
                  ? 'border-[#00274c] bg-[#00274c] text-white'
                  : 'border-[#00274c]/15 bg-white text-[#00274c] hover:border-[#00274c]/40'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-[#9a6700]/25 bg-[#fff7d6] p-5">
          <p className="text-sm font-bold text-[#725000]">
            Season statistics could not be loaded.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 rounded-full bg-[#725000] px-4 py-2 text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#725000]"
          >
            Retry season
          </button>
        </div>
      ) : isPending ? (
        <div className="rounded-2xl border border-[#00274c]/10 bg-white p-6 text-sm font-semibold text-[#00274c]/55">
          Loading {season} snap counts…
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-px overflow-hidden rounded-2xl border border-[#00274c]/10 bg-[#00274c]/10 sm:grid-cols-3">
            <SeasonMetric label="Participants" value={participantCount} />
            <SeasonMetric
              label="Total snaps"
              value={totalSnaps.toLocaleString()}
            />
            <SeasonMetric label="Roster zeroes" value={zeroSnapCount} />
          </div>

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold text-[#111820]/50">
              {rows.length} {rows.length === 1 ? 'player' : 'players'} shown
            </p>
            <label className="flex items-center gap-2 text-xs font-bold text-[#00274c]">
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="rounded-full border border-[#00274c]/15 bg-white px-3 py-2 outline-none focus:border-[#00274c] focus:ring-2 focus:ring-[#ffcb05]"
              >
                <option value="snaps">Most snaps</option>
                <option value="rating">Highest grade</option>
                <option value="name">Player name</option>
              </select>
            </label>
          </div>

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-[#00274c]/10 bg-white p-8 text-center text-sm text-[#111820]/50">
              No {season} players match this search.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[#00274c]/10 bg-white">
              <div className="hidden grid-cols-[2fr_0.6fr_0.65fr_0.65fr_0.65fr] gap-4 bg-[#00274c] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 md:grid">
                <span>Player</span>
                <span>Position</span>
                <span>Games</span>
                <span>Snaps</span>
                <span>PFF grade</span>
              </div>
              <div className="divide-y divide-[#00274c]/8">
                {rows.map((entry) => {
                  const linked = entry.player
                    ? playersById.get(entry.player._id)
                    : undefined
                  const content = <SeasonRow entry={entry} />

                  return linked ? (
                    <button
                      key={rowKey(entry)}
                      type="button"
                      onClick={() => select(linked)}
                      className="block w-full text-left transition hover:bg-[#ffcb05]/10 focus-visible:bg-[#ffcb05]/15 focus-visible:outline-none"
                    >
                      {content}
                    </button>
                  ) : (
                    <div key={rowKey(entry)}>{content}</div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}

function SeasonMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="bg-white px-5 py-4">
      <p className="font-serif text-2xl font-black text-[#00274c]">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#111820]/45">
        {label}
      </p>
    </div>
  )
}

function SeasonRow({ entry }: { entry: SeasonStatEntry }) {
  const name = entry.stat?.sourcePlayerName ?? entry.player?.displayName ?? '—'
  const position = entry.stat?.position ?? entry.stint?.position ?? '—'
  const games = entry.stat?.gamesPlayed ?? 0
  const snaps = entry.stat?.snaps ?? 0
  const rating = entry.stat?.pffRating ?? 0

  return (
    <div className="grid gap-3 px-5 py-4 md:grid-cols-[2fr_0.6fr_0.65fr_0.65fr_0.65fr] md:items-center md:gap-4 md:px-6">
      <span>
        <span className="block font-bold text-[#00274c]">{name}</span>
        <span className="text-xs text-[#111820]/45">
          {entry.stat
            ? entry.stat.phase === 'offense'
              ? 'Offense'
              : 'Defense'
            : 'No participation record'}
          {!entry.player && entry.stat ? ' · Source-only profile' : ''}
        </span>
      </span>
      <MobileValue label="Position" value={position} strong />
      <MobileValue label="Games" value={games} />
      <MobileValue label="Snaps" value={snaps.toLocaleString()} />
      <MobileValue label="PFF grade" value={rating.toFixed(1)} grade />
    </div>
  )
}

function MobileValue({
  label,
  value,
  strong = false,
  grade = false,
}: {
  label: string
  value: string | number
  strong?: boolean
  grade?: boolean
}) {
  return (
    <span className="flex items-center justify-between gap-4 text-sm md:block">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#111820]/40 md:hidden">
        {label}
      </span>
      <span
        className={
          grade
            ? 'rounded-full bg-[#00274c] px-3 py-1 font-black text-white'
            : strong
              ? 'font-bold text-[#00274c]'
              : 'font-semibold text-[#111820]/65'
        }
      >
        {value}
      </span>
    </span>
  )
}

function matchesSearch(entry: SeasonStatEntry, search: string) {
  if (!search) return true
  return [
    entry.stat?.sourcePlayerName,
    entry.player?.displayName,
    entry.stat?.position,
    entry.stint?.position,
  ]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(search))
}

function compareRows(a: SeasonStatEntry, b: SeasonStatEntry, sort: Sort) {
  if (sort === 'name') return rowName(a).localeCompare(rowName(b))
  if (sort === 'rating') {
    return (b.stat?.pffRating ?? 0) - (a.stat?.pffRating ?? 0)
  }
  return (b.stat?.snaps ?? 0) - (a.stat?.snaps ?? 0)
}

function rowName(entry: SeasonStatEntry) {
  return entry.stat?.sourcePlayerName ?? entry.player?.displayName ?? ''
}

function rowKey(entry: SeasonStatEntry) {
  return (
    entry.stat?._id ?? entry.stint?._id ?? entry.player?._id ?? rowName(entry)
  )
}
