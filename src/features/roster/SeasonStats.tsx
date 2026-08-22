import { useMemo, useState } from 'react'
import { useSeasonalStats } from './useMichiganRoster'
import type { EnrichedPlayer, SeasonStatEntry } from './useMichiganRoster'

const seasons = [
  2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015,
]

type Sort = 'snaps' | 'rating' | 'name'
type ParticipantEntry = SeasonStatEntry & {
  stat: NonNullable<SeasonStatEntry['stat']>
}

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
  const participants = data.filter(hasStat)
  const participantCount = participants.length
  const totalSnaps = data.reduce(
    (total, entry) => total + (entry.stat?.snaps ?? 0),
    0,
  )
  const zeroSnapCount = data.length - participantCount

  return (
    <>
      <div className="mb-4 max-w-3xl">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-[#9a6700]">
          2015–2025 season archive
        </p>
        <h2 className="font-serif text-2xl font-black tracking-[-0.02em] text-[#00274c] sm:text-3xl">
          Season production
        </h2>
        <p className="mt-1.5 text-sm leading-5 text-[#111820]/60">
          Michigan games, snaps and PFF grades. Missing data counts as zero.
        </p>
      </div>

      <div className="-mx-1 mb-3 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 px-1">
          {seasons.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeason(value)}
              aria-pressed={season === value}
              className={`rounded-full border px-3 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c] ${
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
        <div className="border-y border-[#9a6700]/25 py-3">
          <p className="text-sm font-bold text-[#725000]">
            Couldn’t load season stats.
          </p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-2 rounded-full bg-[#725000] px-3 py-1.5 text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#725000]"
          >
            Retry
          </button>
        </div>
      ) : isPending ? (
        <div className="border-y border-[#00274c]/10 py-3 text-sm font-semibold text-[#00274c]/55">
          Loading {season} snap counts…
        </div>
      ) : (
        <>
          <p className="mb-3 border-l-2 border-[#ffcb05] pl-3 text-sm font-semibold leading-5 text-[#00274c]">
            {seasonNarrative(participants, season)}
          </p>

          <div className="mb-3 grid grid-cols-3 divide-x divide-[#00274c]/10 border-y border-[#00274c]/10">
            <SeasonMetric label="Participants" value={participantCount} />
            <SeasonMetric
              label="Total snaps"
              value={totalSnaps.toLocaleString()}
            />
            <SeasonMetric label="No snaps" value={zeroSnapCount} />
          </div>

          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-[#111820]/50">
              {rows.length} {rows.length === 1 ? 'player' : 'players'}
            </p>
            <label className="flex items-center gap-2 text-xs font-bold text-[#00274c]">
              Sort
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as Sort)}
                className="rounded-full border border-[#00274c]/15 bg-white px-3 py-1.5 outline-none focus:border-[#00274c] focus:ring-2 focus:ring-[#ffcb05]"
              >
                <option value="snaps">Most snaps</option>
                <option value="rating">Highest grade</option>
                <option value="name">Player name</option>
              </select>
            </label>
          </div>

          {rows.length === 0 ? (
            <div className="border-y border-[#00274c]/10 py-5 text-center text-sm text-[#111820]/50">
              No matches in {season}.
            </div>
          ) : (
            <div className="overflow-hidden border-y border-[#00274c]/10">
              <div className="hidden grid-cols-[2fr_0.6fr_0.65fr_0.65fr_0.65fr] gap-3 bg-[#00274c] px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white/65 md:grid">
                <span>Player</span>
                <span>Position</span>
                <span>Games</span>
                <span>Snaps</span>
                <span>Grade</span>
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
    <div className="px-3 py-2.5">
      <p className="font-serif text-xl font-black tabular-nums text-[#00274c]">
        {value}
      </p>
      <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#111820]/45">
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
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-2.5 md:grid-cols-[2fr_0.6fr_0.65fr_0.65fr_0.65fr] md:items-center md:gap-3 md:px-4">
      <span className="col-span-2 md:col-span-1">
        <span className="block font-bold text-[#00274c]">{name}</span>
        <span className="text-xs text-[#111820]/45">
          {entry.stat
            ? entry.stat.phase === 'offense'
              ? 'Offense'
              : 'Defense'
            : 'No snaps'}
          {!entry.player && entry.stat ? ' · Stats only' : ''}
        </span>
      </span>
      <MobileValue label="Position" value={position} strong />
      <MobileValue label="Games" value={games} />
      <MobileValue label="Snaps" value={snaps.toLocaleString()} />
      <MobileValue label="Grade" value={rating.toFixed(1)} grade />
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
    <span className="flex items-center justify-between gap-3 text-sm md:block">
      <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#111820]/40 md:hidden">
        {label}
      </span>
      <span
        className={
          grade
            ? 'font-black tabular-nums text-[#00274c] underline decoration-[#ffcb05] decoration-2 underline-offset-4'
            : strong
              ? 'font-bold text-[#00274c]'
              : 'font-semibold tabular-nums text-[#111820]/65'
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

function hasStat(entry: SeasonStatEntry): entry is ParticipantEntry {
  return entry.stat !== null
}

function seasonNarrative(
  participants: Array<ParticipantEntry>,
  season: number,
) {
  if (participants.length === 0) return `No recorded snaps in ${season}.`

  const snapLeader = participants.reduce((leader, entry) =>
    entry.stat.snaps > leader.stat.snaps ? entry : leader,
  )
  const gradeLeader = participants.reduce((leader, entry) =>
    entry.stat.pffRating > leader.stat.pffRating ? entry : leader,
  )
  const snapName = rowName(snapLeader)
  const gradeName = rowName(gradeLeader)

  if (snapLeader.stat._id === gradeLeader.stat._id) {
    return `${snapName} led ${season}: ${snapLeader.stat.snaps.toLocaleString()} snaps over ${snapLeader.stat.gamesPlayed} games, ${snapLeader.stat.pffRating.toFixed(1)} grade.`
  }

  return `${snapName} led snaps (${snapLeader.stat.snaps.toLocaleString()}); ${gradeName} had the top grade (${gradeLeader.stat.pffRating.toFixed(1)}).`
}
