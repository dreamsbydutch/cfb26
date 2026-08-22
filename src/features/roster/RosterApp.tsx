import { useEffect, useMemo, useRef, useState } from 'react'
import { SeasonStats } from './SeasonStats'
import { useMichiganRoster } from './useMichiganRoster'
import type { EnrichedPlayer, PlayerProfile } from './useMichiganRoster'
import type { ReactNode } from 'react'

type View = 'depth' | 'recruiting' | 'draft' | 'positions' | 'snaps' | 'players'

const views: Array<{ id: View; label: string }> = [
  { id: 'depth', label: 'Depth chart' },
  { id: 'recruiting', label: 'Recruit classes' },
  { id: 'draft', label: 'Draft classes' },
  { id: 'positions', label: 'Positions' },
  { id: 'snaps', label: 'Season stats' },
  { id: 'players', label: 'All players' },
]

const positionOrder = [
  'QB',
  'RB',
  'FB',
  'WR',
  'SLOT',
  'TE',
  'OT',
  'LT',
  'RT',
  'OG',
  'LG',
  'RG',
  'C',
  'OC',
  'OL',
  'EDGE',
  'DE',
  'SDE',
  'WDE',
  'DT',
  'NT',
  'DL',
  'LB',
  'ILB',
  'OLB',
  'CB',
  'NICKEL',
  'S',
  'DB',
  'K',
  'P',
  'LS',
]

export function RosterApp() {
  const {
    players,
    profileCount,
    failedProfiles,
    rosterIsComplete,
    rosterLoadFailed,
    retryRoster,
    retryProfiles,
  } = useMichiganRoster()
  const [view, setView] = useState<View>('depth')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<EnrichedPlayer>()

  const normalizedSearch = search.trim().toLowerCase()
  const visiblePlayers = useMemo(
    () =>
      players.filter((entry) => {
        if (!normalizedSearch) return true
        const recruiting = entry.profile?.recruiting
        return [
          entry.player.displayName,
          entry.player.hometown,
          entry.player.homeState,
          entry.player.highSchool,
          entry.stint.position,
          recruiting?.position,
          recruiting?.recruitingSeason,
          entry.profile?.draft?.year,
          entry.profile?.draft?.team,
        ]
          .filter((value) => value !== undefined)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          )
      }),
    [normalizedSearch, players],
  )

  const activeCount = players.filter(
    (entry) => entry.stint.status === 'active',
  ).length
  const draftCount = players.filter((entry) => entry.profile?.draft).length
  const isHydrating = !rosterIsComplete || profileCount < players.length

  return (
    <>
      <main
        className="min-h-screen bg-[#f4f2ec] text-[#111820]"
        inert={selected ? true : undefined}
      >
        <header className="bg-[#00274c] text-white">
          <div className="mx-auto max-w-[1500px] px-4 pb-7 pt-5 sm:px-7 lg:px-10">
            <div className="flex items-center justify-between gap-4 border-b border-white/15 pb-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-12 place-items-center bg-[#ffcb05] font-serif text-2xl font-black text-[#00274c] [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)]">
                  M
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.23em] text-[#ffcb05]">
                    Michigan football
                  </p>
                  <p className="text-sm font-semibold text-white/80">
                    Personnel archive
                  </p>
                </div>
              </div>
              <p className="hidden text-right text-xs leading-5 text-white/55 sm:block">
                Current snapshot: 2026 roster
                <br />
                2015–2027 player history
              </p>
            </div>

            <div className="grid gap-8 pb-2 pt-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-[#ffcb05]">
                  Wolverines roster intelligence
                </p>
                <h1 className="max-w-3xl font-serif text-4xl font-black leading-[0.95] tracking-[-0.035em] sm:text-6xl">
                  Every class. Every position. One chart.
                </h1>
              </div>
              <div className="grid grid-cols-3 divide-x divide-white/15 border-y border-white/15 py-4 lg:border-y-0 lg:py-0">
                <Stat value={activeCount} label="Current" />
                <Stat
                  value={
                    rosterIsComplete ? players.length : `${players.length}+`
                  }
                  label="Players"
                />
                <Stat
                  value={isHydrating ? `${draftCount}+` : draftCount}
                  label="NFL entries"
                />
              </div>
            </div>
          </div>
        </header>

        <div className="sticky top-0 z-30 border-b border-[#00274c]/15 bg-[#f4f2ec]/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-3 px-4 py-3 sm:px-7 lg:flex-row lg:items-center lg:justify-between lg:px-10">
            <nav aria-label="Roster views" className="-mx-1 overflow-x-auto">
              <div className="flex min-w-max gap-1 px-1">
                {views.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id)}
                    aria-current={view === item.id ? 'page' : undefined}
                    className={`rounded-full px-4 py-2 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c] ${
                      view === item.id
                        ? 'bg-[#00274c] text-white'
                        : 'text-[#00274c]/65 hover:bg-white hover:text-[#00274c]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>
            <label className="relative block w-full lg:w-72">
              <span className="sr-only">Search players</span>
              <SearchIcon />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, school, class…"
                className="w-full rounded-full border border-[#00274c]/15 bg-white py-2.5 pl-10 pr-4 text-sm text-[#111820] outline-none transition placeholder:text-[#111820]/40 focus:border-[#00274c] focus:ring-2 focus:ring-[#ffcb05]"
              />
            </label>
          </div>
        </div>

        <section className="mx-auto max-w-[1500px] px-4 py-8 sm:px-7 lg:px-10 lg:py-12">
          {rosterLoadFailed && (
            <div className="mb-7 flex flex-col gap-3 rounded-xl border border-[#9a6700]/25 bg-[#fff7d6] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold text-[#725000]">
                  Part of the departed-player archive could not be loaded.
                </p>
                <p className="mt-0.5 text-xs text-[#725000]/65">
                  Current roster data is available; historical totals may be
                  incomplete.
                </p>
              </div>
              <button
                type="button"
                onClick={retryRoster}
                className="rounded-full bg-[#725000] px-4 py-2 text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#725000]"
              >
                Retry archive
              </button>
            </div>
          )}
          <ProfileProgress
            loaded={profileCount}
            total={players.length}
            failed={failedProfiles}
            rosterComplete={rosterIsComplete}
            retry={retryProfiles}
          />

          {view !== 'snaps' && visiblePlayers.length === 0 ? (
            <EmptySearch clear={() => setSearch('')} />
          ) : (
            <>
              {view === 'depth' && (
                <DepthChart players={visiblePlayers} select={setSelected} />
              )}
              {view === 'recruiting' && (
                <RecruitClasses players={visiblePlayers} select={setSelected} />
              )}
              {view === 'draft' && (
                <DraftClasses players={visiblePlayers} select={setSelected} />
              )}
              {view === 'positions' && (
                <PositionLists players={visiblePlayers} select={setSelected} />
              )}
              {view === 'snaps' && (
                <SeasonStats
                  players={players}
                  search={normalizedSearch}
                  select={setSelected}
                />
              )}
              {view === 'players' && (
                <AllPlayers players={visiblePlayers} select={setSelected} />
              )}
            </>
          )}
        </section>
      </main>
      {selected && (
        <PlayerDrawer
          entry={
            players.find((entry) => entry.player._id === selected.player._id) ??
            selected
          }
          close={() => setSelected(undefined)}
        />
      )}
    </>
  )
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="px-5 text-center first:pl-0 last:pr-0 lg:min-w-28">
      <p className="font-serif text-3xl font-black text-[#ffcb05]">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
        {label}
      </p>
    </div>
  )
}

function ProfileProgress({
  loaded,
  total,
  failed,
  rosterComplete,
  retry,
}: {
  loaded: number
  total: number
  failed: number
  rosterComplete: boolean
  retry: () => void
}) {
  if (rosterComplete && loaded === total && failed === 0) return null

  return (
    <div className="mb-7 flex flex-col gap-3 rounded-xl border border-[#00274c]/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#ffcb05] ring-4 ring-[#ffcb05]/25" />
        <div>
          <p className="text-sm font-bold text-[#00274c]">
            {!rosterComplete
              ? 'Loading commitments and player history'
              : failed
                ? `${failed} profiles could not be loaded`
                : 'Loading recruiting, career, and draft details'}
          </p>
          <p className="text-xs text-[#111820]/55">
            {loaded} of {total} discovered player profiles ready
          </p>
        </div>
      </div>
      {failed && rosterComplete ? (
        <button
          type="button"
          onClick={retry}
          className="rounded-full bg-[#00274c] px-4 py-2 text-xs font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c]"
        >
          Retry missing profiles
        </button>
      ) : (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#00274c]/10 sm:w-48">
          <div
            className={`h-full rounded-full bg-[#ffcb05] transition-[width] ${rosterComplete ? '' : 'animate-pulse'}`}
            style={{
              width: rosterComplete
                ? `${total ? (loaded / total) * 100 : 0}%`
                : '35%',
            }}
          />
        </div>
      )}
    </div>
  )
}

function SectionIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <div className="mb-7 max-w-3xl">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#9a6700]">
        {eyebrow}
      </p>
      <h2 className="font-serif text-3xl font-black tracking-[-0.02em] text-[#00274c] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6 text-[#111820]/60 sm:text-base">
        {children}
      </p>
    </div>
  )
}

function DepthChart({
  players,
  select,
}: {
  players: Array<EnrichedPlayer>
  select: (player: EnrichedPlayer) => void
}) {
  const active = players.filter((entry) => entry.stint.status === 'active')
  const groups = groupPlayers(active)

  return (
    <>
      <SectionIntro eyebrow="Current roster · 2026" title="Depth chart">
        Players are ordered within their exact roster position. Lower depth
        numbers indicate stronger placement; 2027 commitments are excluded.
      </SectionIntro>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([position, entries]) => (
          <article
            key={position}
            className="overflow-hidden rounded-2xl border border-[#00274c]/10 bg-white shadow-[0_10px_30px_rgba(0,39,76,0.04)]"
          >
            <div className="flex items-center justify-between bg-[#00274c] px-5 py-4 text-white">
              <h3 className="font-serif text-2xl font-black">{position}</h3>
              <span className="text-xs font-bold uppercase tracking-[0.15em] text-white/55">
                {entries.length} players
              </span>
            </div>
            <ol className="divide-y divide-[#00274c]/8">
              {entries
                .sort(
                  (a, b) =>
                    (a.stint.depthChartOrder ?? 999) -
                    (b.stint.depthChartOrder ?? 999),
                )
                .map((entry) => (
                  <li key={entry.player._id}>
                    <button
                      type="button"
                      onClick={() => select(entry)}
                      className="group grid w-full grid-cols-[2.25rem_1fr_auto] items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[#ffcb05]/10 focus-visible:bg-[#ffcb05]/15 focus-visible:outline-none"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f4f2ec] text-xs font-black text-[#00274c] group-hover:bg-[#ffcb05]">
                        {entry.stint.depthChartOrder ?? '—'}
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-[#00274c]">
                          {entry.player.displayName}
                        </span>
                        <span className="mt-0.5 block text-xs text-[#111820]/50">
                          {jersey(entry.stint.jerseyNumber)} ·{' '}
                          {entry.stint.startSeason}
                        </span>
                      </span>
                      <span className="text-right text-xs font-semibold text-[#111820]/45">
                        {formatMeasurements(
                          entry.stint.heightInches,
                          entry.stint.weightPounds,
                        )}
                      </span>
                    </button>
                  </li>
                ))}
            </ol>
          </article>
        ))}
      </div>
    </>
  )
}

function RecruitClasses({
  players,
  select,
}: {
  players: Array<EnrichedPlayer>
  select: (player: EnrichedPlayer) => void
}) {
  const [season, setSeason] = useState<number | 'all'>('all')
  const ready = players.filter(
    (entry): entry is EnrichedPlayer & { profile: PlayerProfile } =>
      Boolean(entry.profile?.recruiting),
  )
  const seasons = uniqueNumbers(
    ready.map((entry) => entry.profile.recruiting!.recruitingSeason),
  ).sort((a, b) => b - a)
  const filtered =
    season === 'all'
      ? ready
      : ready.filter(
          (entry) => entry.profile.recruiting?.recruitingSeason === season,
        )
  const groups = groupByNumber(
    filtered,
    (entry) => entry.profile.recruiting!.recruitingSeason,
  )

  return (
    <>
      <SectionIntro eyebrow="Original prospect cohort" title="Recruit classes">
        Recruiting class follows the player’s original prospect year, which can
        differ from the season a transfer or walk-on arrived at Michigan.
      </SectionIntro>
      <FilterChips
        values={seasons}
        selected={season}
        setSelected={setSeason}
        allLabel="All classes"
      />
      <div className="space-y-7">
        {groups.map(([year, entries]) => (
          <article key={year} className="rounded-2xl bg-white p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-[#00274c]/10 pb-4">
              <h3 className="font-serif text-4xl font-black text-[#00274c]">
                {year}
              </h3>
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#111820]/45">
                {entries.length} players · {sourceSummary(entries)}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {entries
                .sort(
                  (a, b) =>
                    a.profile.recruiting!.classRank -
                    b.profile.recruiting!.classRank,
                )
                .map((entry) => (
                  <PlayerCard
                    key={entry.player._id}
                    entry={entry}
                    select={select}
                    meta={
                      <>
                        <SourceBadge
                          source={entry.profile.recruiting!.source}
                        />
                        <span>
                          {entry.profile.recruiting?.position ?? '—'} · class #
                          {entry.profile.recruiting?.classRank}
                        </span>
                      </>
                    }
                    detail={
                      entry.profile.recruiting?.compositeRating
                        ? `${entry.profile.recruiting.compositeRating.toFixed(4)} composite`
                        : 'No composite rating'
                    }
                  />
                ))}
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

function DraftClasses({
  players,
  select,
}: {
  players: Array<EnrichedPlayer>
  select: (player: EnrichedPlayer) => void
}) {
  const drafted = players.filter(
    (entry): entry is EnrichedPlayer & { profile: PlayerProfile } =>
      Boolean(entry.profile?.draft),
  )
  const groups = groupByNumber(drafted, (entry) => entry.profile.draft!.year)

  return (
    <>
      <SectionIntro eyebrow="Recorded NFL entry" title="Draft classes">
        Drafted players and undrafted free-agent signings are grouped by NFL
        entry year. Missing outcomes are not treated as a negative result.
      </SectionIntro>
      {groups.length === 0 ? (
        <HydratingEmpty label="Draft outcomes are still loading." />
      ) : (
        <div className="space-y-5">
          {groups.map(([year, entries]) => (
            <article
              key={year}
              className="overflow-hidden rounded-2xl border border-[#00274c]/10 bg-white"
            >
              <div className="flex items-center justify-between bg-[#00274c] px-5 py-4 text-white sm:px-7">
                <h3 className="font-serif text-3xl font-black">{year}</h3>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#ffcb05]">
                  {
                    entries.filter(
                      (entry) => entry.profile.draft?.status === 'drafted',
                    ).length
                  }{' '}
                  drafted ·{' '}
                  {
                    entries.filter(
                      (entry) =>
                        entry.profile.draft?.status === 'undrafted_free_agent',
                    ).length
                  }{' '}
                  UDFA
                </span>
              </div>
              <div className="divide-y divide-[#00274c]/8">
                {entries
                  .sort(
                    (a, b) =>
                      (a.profile.draft?.overallPick ?? 999) -
                      (b.profile.draft?.overallPick ?? 999),
                  )
                  .map((entry) => {
                    const draft = entry.profile.draft!
                    return (
                      <button
                        key={entry.player._id}
                        type="button"
                        onClick={() => select(entry)}
                        className="grid w-full grid-cols-[3.5rem_1fr_auto] items-center gap-3 px-5 py-4 text-left transition hover:bg-[#ffcb05]/10 focus-visible:bg-[#ffcb05]/15 focus-visible:outline-none sm:grid-cols-[5rem_1fr_8rem_8rem] sm:px-7"
                      >
                        <span className="font-serif text-xl font-black text-[#00274c]">
                          {draft.status === 'drafted'
                            ? `#${draft.overallPick}`
                            : 'UDFA'}
                        </span>
                        <span>
                          <span className="block font-bold text-[#00274c]">
                            {entry.player.displayName}
                          </span>
                          <span className="text-xs text-[#111820]/50">
                            {entry.stint.position} · Michigan{' '}
                            {entry.stint.startSeason}–
                            {entry.stint.endSeason ?? 'present'}
                          </span>
                        </span>
                        <span className="hidden text-sm font-semibold text-[#111820]/60 sm:block">
                          {draft.status === 'drafted'
                            ? `Round ${draft.round}`
                            : 'Free agent'}
                        </span>
                        <span className="rounded-full bg-[#f4f2ec] px-3 py-1.5 text-center text-xs font-black text-[#00274c]">
                          {draft.team}
                        </span>
                      </button>
                    )
                  })}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  )
}

function PositionLists({
  players,
  select,
}: {
  players: Array<EnrichedPlayer>
  select: (player: EnrichedPlayer) => void
}) {
  const groups = groupPlayers(players)

  return (
    <>
      <SectionIntro eyebrow="Exact Michigan labels" title="Players by position">
        Position names are preserved as recorded, including historical labels
        such as SDE, WDE, ILB, OLB, LT, and RG.
      </SectionIntro>
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map(([position, entries], index) => (
          <details
            key={position}
            open={index < 6}
            className="group overflow-hidden rounded-2xl border border-[#00274c]/10 bg-white"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#ffcb05] [&::-webkit-details-marker]:hidden">
              <span className="flex items-baseline gap-3">
                <span className="font-serif text-2xl font-black text-[#00274c]">
                  {position}
                </span>
                <span className="text-xs font-semibold text-[#111820]/45">
                  {entries.length} players
                </span>
              </span>
              <ChevronIcon />
            </summary>
            <div className="border-t border-[#00274c]/8 px-2 pb-2">
              {entries
                .sort((a, b) => {
                  if (
                    a.stint.status === 'active' &&
                    b.stint.status !== 'active'
                  )
                    return -1
                  if (
                    b.stint.status === 'active' &&
                    a.stint.status !== 'active'
                  )
                    return 1
                  return b.stint.startSeason - a.stint.startSeason
                })
                .map((entry) => (
                  <button
                    key={entry.player._id}
                    type="button"
                    onClick={() => select(entry)}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-[#ffcb05]/10 focus-visible:bg-[#ffcb05]/15 focus-visible:outline-none"
                  >
                    <span>
                      <span className="block text-sm font-bold text-[#00274c]">
                        {entry.player.displayName}
                      </span>
                      <span className="text-xs text-[#111820]/45">
                        {entry.stint.startSeason}–
                        {entry.stint.endSeason ?? 'present'}
                      </span>
                    </span>
                    <StatusBadge status={entry.stint.status} />
                  </button>
                ))}
            </div>
          </details>
        ))}
      </div>
    </>
  )
}

function AllPlayers({
  players,
  select,
}: {
  players: Array<EnrichedPlayer>
  select: (player: EnrichedPlayer) => void
}) {
  const [status, setStatus] = useState<
    'all' | 'active' | 'committed' | 'departed'
  >('all')
  const filtered = players
    .filter((entry) => status === 'all' || entry.stint.status === status)
    .sort((a, b) => a.player.displayName.localeCompare(b.player.displayName))

  return (
    <>
      <SectionIntro eyebrow="Complete Michigan history" title="All players">
        Browse every player in the live dataset and open a row for recruiting,
        eligibility, participation, movement, and NFL details.
      </SectionIntro>
      <div className="mb-5 flex flex-wrap gap-2">
        {(['all', 'active', 'committed', 'departed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`rounded-full border px-4 py-2 text-xs font-bold capitalize transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c] ${
              status === value
                ? 'border-[#00274c] bg-[#00274c] text-white'
                : 'border-[#00274c]/15 bg-white text-[#00274c] hover:border-[#00274c]/40'
            }`}
          >
            {value} ·{' '}
            {value === 'all'
              ? players.length
              : players.filter((entry) => entry.stint.status === value).length}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-2xl border border-[#00274c]/10 bg-white">
        <div className="hidden grid-cols-[2fr_0.65fr_0.65fr_0.8fr_0.8fr] gap-4 bg-[#00274c] px-6 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/60 md:grid">
          <span>Player</span>
          <span>Position</span>
          <span>Arrived</span>
          <span>Recruit class</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-[#00274c]/8">
          {filtered.map((entry) => (
            <button
              key={entry.player._id}
              type="button"
              onClick={() => select(entry)}
              className="grid w-full gap-2 px-5 py-4 text-left transition hover:bg-[#ffcb05]/10 focus-visible:bg-[#ffcb05]/15 focus-visible:outline-none md:grid-cols-[2fr_0.65fr_0.65fr_0.8fr_0.8fr] md:items-center md:gap-4 md:px-6"
            >
              <span>
                <span className="block font-bold text-[#00274c]">
                  {entry.player.displayName}
                </span>
                <span className="text-xs text-[#111820]/45">
                  {entry.player.hometown}, {entry.player.homeState} ·{' '}
                  {entry.player.highSchool}
                </span>
              </span>
              <span className="text-sm font-bold text-[#00274c]">
                {entry.stint.position}
              </span>
              <span className="text-sm text-[#111820]/60">
                {entry.stint.startSeason}
              </span>
              <span className="text-sm text-[#111820]/60">
                {entry.profile?.recruiting?.recruitingSeason ?? 'Loading…'}
              </span>
              <span>
                <StatusBadge status={entry.stint.status} />
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

function PlayerCard({
  entry,
  meta,
  detail,
  select,
}: {
  entry: EnrichedPlayer
  meta: ReactNode
  detail: string
  select: (player: EnrichedPlayer) => void
}) {
  return (
    <button
      type="button"
      onClick={() => select(entry)}
      className="rounded-xl border border-[#00274c]/8 p-4 text-left transition hover:-translate-y-0.5 hover:border-[#00274c]/25 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c]"
    >
      <span className="block font-bold text-[#00274c]">
        {entry.player.displayName}
      </span>
      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#111820]/55">
        {meta}
      </span>
      <span className="mt-3 block text-xs font-semibold text-[#111820]/45">
        {detail}
      </span>
    </button>
  )
}

function PlayerDrawer({
  entry,
  close,
}: {
  entry: EnrichedPlayer
  close: () => void
}) {
  const profile = entry.profile
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [close])

  const recruiting = profile?.recruiting
  const summary = profile?.summaries[0]
  const draft = profile?.draft

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close player details"
        onClick={close}
        tabIndex={-1}
        className="absolute inset-0 bg-[#001a33]/65 backdrop-blur-[2px]"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-title"
        className="relative h-full w-full max-w-xl overflow-y-auto bg-[#f4f2ec] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/15 bg-[#00274c] px-5 py-4 text-white sm:px-7">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#ffcb05]">
            Player profile
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffcb05]"
            aria-label="Close player profile"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="bg-[#00274c] px-5 pb-8 pt-4 text-white sm:px-7">
          <div className="flex items-start gap-4">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#ffcb05] font-serif text-2xl font-black text-[#00274c]">
              {entry.stint.jerseyNumber ?? entry.stint.position}
            </div>
            <div>
              <StatusBadge status={entry.stint.status} inverse />
              <h2
                id="player-title"
                className="mt-2 font-serif text-3xl font-black leading-tight"
              >
                {entry.player.displayName}
              </h2>
              <p className="mt-1 text-sm text-white/60">
                {entry.stint.position} · Michigan {entry.stint.startSeason}–
                {entry.stint.endSeason ?? 'present'}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-7">
          <DetailSection title="Michigan roster">
            <DetailGrid>
              <Detail
                label="Depth order"
                value={
                  entry.stint.status === 'active'
                    ? entry.stint.depthChartOrder
                    : undefined
                }
              />
              <Detail label="Jersey" value={entry.stint.jerseyNumber} />
              <Detail label="Position" value={entry.stint.position} />
              <Detail
                label="Size"
                value={formatMeasurements(
                  entry.stint.heightInches,
                  entry.stint.weightPounds,
                )}
              />
              <Detail label="First season" value={entry.stint.startSeason} />
              <Detail label="Final season" value={entry.stint.endSeason} />
              <Detail
                label="Eligibility starts"
                value={entry.stint.eligibilityStartSeason}
              />
              <Detail
                label="NFL eligible"
                value={entry.stint.eligibilityLeaveSeason}
              />
              <Detail
                label="Eligibility ends"
                value={entry.stint.eligibilityEndSeason}
              />
              <Detail
                label="Extra eligibility"
                value={`${entry.stint.redshirtSeasons} season${entry.stint.redshirtSeasons === 1 ? '' : 's'}`}
              />
            </DetailGrid>
          </DetailSection>

          <DetailSection title="Origin">
            <DetailGrid>
              <Detail
                label="Hometown"
                value={`${entry.player.hometown}, ${entry.player.homeState}`}
              />
              <Detail label="High school" value={entry.player.highSchool} />
            </DetailGrid>
          </DetailSection>

          {!profile ? (
            <HydratingEmpty label="Full player details are loading…" />
          ) : (
            <>
              <DetailSection title="Recruiting">
                {recruiting ? (
                  <DetailGrid>
                    <Detail label="Class" value={recruiting.recruitingSeason} />
                    <Detail
                      label="Entry path"
                      value={sourceLabel(recruiting.source)}
                    />
                    <Detail
                      label="Recruit position"
                      value={recruiting.position}
                    />
                    <Detail label="Class rank" value={recruiting.classRank} />
                    <Detail
                      label="Recruit size"
                      value={formatMeasurements(
                        recruiting.heightInches,
                        recruiting.weightPounds,
                      )}
                    />
                    <Detail
                      label="Composite rating"
                      value={recruiting.compositeRating?.toFixed(4)}
                    />
                    <Detail
                      label="Composite overall"
                      value={rank(recruiting.compositeOverallRank)}
                    />
                    <Detail
                      label="Composite position"
                      value={rank(recruiting.compositePositionRank)}
                    />
                    <Detail
                      label="Composite state"
                      value={rank(recruiting.compositeStateRank)}
                    />
                    <Detail
                      label="247 rating"
                      value={recruiting.service247Rating}
                    />
                    <Detail
                      label="247 overall"
                      value={rank(recruiting.service247OverallRank)}
                    />
                    <Detail
                      label="247 position"
                      value={rank(recruiting.service247PositionRank)}
                    />
                    <Detail
                      label="247 state"
                      value={rank(recruiting.service247StateRank)}
                    />
                  </DetailGrid>
                ) : (
                  <p className="text-sm text-[#111820]/50">
                    No recruiting profile.
                  </p>
                )}
              </DetailSection>

              <DetailSection title="Michigan career">
                <DetailGrid>
                  <Detail label="Games" value={summary?.gamesPlayed} />
                  <Detail
                    label="Snaps"
                    value={summary?.snaps.toLocaleString()}
                  />
                  <Detail
                    label="Recent PFF rating"
                    value={
                      summary?.recentRating ? summary.recentRating : undefined
                    }
                  />
                  <Detail
                    label="Departure group"
                    value={
                      entry.stint.departureClass && entry.stint.departureRank
                        ? `${entry.stint.departureClass}${entry.stint.departureRank}`
                        : undefined
                    }
                  />
                </DetailGrid>
                {summary?.recentRating ? (
                  <p className="mt-3 text-xs leading-5 text-[#111820]/45">
                    Manually entered PFF rating; the rated season is not stored.
                  </p>
                ) : null}
              </DetailSection>

              <DetailSection title="Season-by-season production">
                <SeasonHistory entry={entry} profile={profile} />
              </DetailSection>

              <DetailSection title="Movement timeline">
                <ol className="space-y-3">
                  {profile.movements.map((movement) => (
                    <li
                      key={movement._id}
                      className="grid grid-cols-[3rem_1fr] gap-3"
                    >
                      <span className="text-sm font-black text-[#9a6700]">
                        {movement.season}
                      </span>
                      <span className="text-sm font-semibold text-[#00274c]">
                        {movementLabel(movement.kind)}
                      </span>
                    </li>
                  ))}
                </ol>
              </DetailSection>

              <DetailSection title="NFL entry">
                {draft ? (
                  <DetailGrid>
                    <Detail label="Year" value={draft.year} />
                    <Detail
                      label="Outcome"
                      value={draft.status === 'drafted' ? 'Drafted' : 'UDFA'}
                    />
                    <Detail label="Team" value={draft.team} />
                    <Detail label="Round" value={draft.round} />
                    <Detail label="Overall pick" value={draft.overallPick} />
                  </DetailGrid>
                ) : (
                  <p className="text-sm leading-6 text-[#111820]/50">
                    No recorded NFL entry outcome. Absence does not imply a
                    negative outcome.
                  </p>
                )}
              </DetailSection>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function SeasonHistory({
  entry,
  profile,
}: {
  entry: EnrichedPlayer
  profile: PlayerProfile
}) {
  const firstSeason = Math.max(2015, entry.stint.startSeason)
  const finalSeason = Math.min(2025, entry.stint.endSeason ?? 2025)

  if (firstSeason > finalSeason) {
    return (
      <p className="text-sm leading-6 text-[#111820]/50">
        Seasonal PFF data is available for 2015–2025; this player’s Michigan
        tenure falls outside that range.
      </p>
    )
  }

  const statsBySeason = new Map(
    profile.seasonalStats.map((stat) => [stat.season, stat]),
  )
  const rows = Array.from(
    { length: finalSeason - firstSeason + 1 },
    (_, index) => finalSeason - index,
  )

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-[#00274c]/10">
        <div className="grid grid-cols-[0.8fr_0.8fr_0.8fr_0.8fr] gap-2 bg-[#00274c] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-white/60">
          <span>Season</span>
          <span>Position</span>
          <span>Snaps</span>
          <span>Grade</span>
        </div>
        <div className="divide-y divide-[#00274c]/8">
          {rows.map((season) => {
            const stat = statsBySeason.get(season)
            return (
              <div
                key={season}
                className="grid grid-cols-[0.8fr_0.8fr_0.8fr_0.8fr] items-center gap-2 px-3 py-2.5 text-sm"
              >
                <span className="font-black text-[#9a6700]">{season}</span>
                <span className="font-bold text-[#00274c]">
                  {stat?.position ?? entry.stint.position}
                </span>
                <span className="font-semibold text-[#111820]/65">
                  {(stat?.snaps ?? 0).toLocaleString()}
                </span>
                <span className="font-black text-[#00274c]">
                  {(stat?.pffRating ?? 0).toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-[#111820]/45">
        A zero indicates that the player has no participation row in the source
        for that roster season.
      </p>
    </>
  )
}

function DetailSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[#00274c]/10 bg-white p-5">
      <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.18em] text-[#00274c]">
        {title}
      </h3>
      {children}
    </section>
  )
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-5 gap-y-4">{children}</dl>
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#111820]/40">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-bold text-[#00274c]">{value ?? '—'}</dd>
    </div>
  )
}

function FilterChips({
  values,
  selected,
  setSelected,
  allLabel,
}: {
  values: Array<number>
  selected: number | 'all'
  setSelected: (value: number | 'all') => void
  allLabel: string
}) {
  return (
    <div className="-mx-1 mb-6 overflow-x-auto pb-2">
      <div className="flex min-w-max gap-2 px-1">
        <button
          type="button"
          onClick={() => setSelected('all')}
          className={chipClass(selected === 'all')}
        >
          {allLabel}
        </button>
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSelected(value)}
            className={chipClass(selected === value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  )
}

function SourceBadge({
  source,
}: {
  source: 'high_school' | 'transfer' | 'walk_on'
}) {
  return (
    <span className="rounded-full bg-[#ffcb05]/25 px-2 py-0.5 font-bold text-[#725000]">
      {sourceLabel(source)}
    </span>
  )
}

function StatusBadge({
  status,
  inverse = false,
}: {
  status: 'active' | 'committed' | 'departed'
  inverse?: boolean
}) {
  const colors = inverse
    ? 'bg-white/10 text-white'
    : status === 'active'
      ? 'bg-[#dcead9] text-[#265c29]'
      : status === 'committed'
        ? 'bg-[#fff0b7] text-[#725000]'
        : 'bg-[#e8e9eb] text-[#4e5660]'
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${colors}`}
    >
      {status}
    </span>
  )
}

function EmptySearch({ clear }: { clear: () => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#00274c]/25 bg-white px-6 py-16 text-center">
      <h2 className="font-serif text-2xl font-black text-[#00274c]">
        No players found
      </h2>
      <p className="mt-2 text-sm text-[#111820]/50">
        Try a different name, position, school, year, or team.
      </p>
      <button
        type="button"
        onClick={clear}
        className="mt-5 rounded-full bg-[#00274c] px-5 py-2.5 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c]"
      >
        Clear search
      </button>
    </div>
  )
}

function HydratingEmpty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#00274c]/20 bg-white p-6 text-sm text-[#111820]/50">
      {label}
    </div>
  )
}

export function RosterLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#00274c] px-6 text-white">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-24 place-items-center bg-[#ffcb05] font-serif text-5xl font-black text-[#00274c] [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)]">
          M
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-white/60">
          Loading Michigan roster
        </p>
      </div>
    </main>
  )
}

export function RosterError() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f2ec] px-6 text-center">
      <div className="max-w-md">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9a6700]">
          Connection error
        </p>
        <h1 className="mt-3 font-serif text-4xl font-black text-[#00274c]">
          The roster could not be loaded.
        </h1>
        <p className="mt-4 text-sm leading-6 text-[#111820]/55">
          Check the Convex deployment URL and network connection, then try
          again.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-full bg-[#00274c] px-5 py-3 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c]"
        >
          Reload roster
        </button>
      </div>
    </main>
  )
}

function groupPlayers(players: Array<EnrichedPlayer>) {
  const groups = new Map<string, Array<EnrichedPlayer>>()
  for (const player of players) {
    const entries = groups.get(player.stint.position) ?? []
    entries.push(player)
    groups.set(player.stint.position, entries)
  }
  return [...groups.entries()].sort(([a], [b]) => {
    const aIndex = positionOrder.indexOf(a)
    const bIndex = positionOrder.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
}

function groupByNumber<T>(items: Array<T>, getKey: (item: T) => number) {
  const groups = new Map<number, Array<T>>()
  for (const item of items) {
    const key = getKey(item)
    groups.set(key, [...(groups.get(key) ?? []), item])
  }
  return [...groups.entries()].sort(([a], [b]) => b - a)
}

function uniqueNumbers(values: Array<number>) {
  return [...new Set(values)]
}

function sourceSummary(
  entries: Array<EnrichedPlayer & { profile: PlayerProfile }>,
) {
  const recruits = entries.filter(
    (entry) => entry.profile.recruiting?.source === 'high_school',
  ).length
  const transfers = entries.filter(
    (entry) => entry.profile.recruiting?.source === 'transfer',
  ).length
  const walkOns = entries.filter(
    (entry) => entry.profile.recruiting?.source === 'walk_on',
  ).length
  return `${recruits} recruits · ${transfers} transfers · ${walkOns} walk-ons`
}

function sourceLabel(source: 'high_school' | 'transfer' | 'walk_on') {
  if (source === 'high_school') return 'Recruit'
  if (source === 'transfer') return 'Transfer'
  return 'Walk-on'
}

function movementLabel(kind: PlayerProfile['movements'][number]['kind']) {
  const labels = {
    recruited: 'Recruited to Michigan',
    walk_on: 'Joined Michigan as a walk-on',
    transfer_in: 'Transferred to Michigan',
    transfer_out: 'Transferred out of Michigan',
    graduated: 'Graduated from Michigan',
    retired: 'Retired from football',
    dismissed: 'Dismissed from Michigan',
  }
  return labels[kind]
}

function jersey(value: number | undefined) {
  return value === undefined ? 'No number' : `#${value}`
}

function rank(value: number | undefined) {
  return value === undefined ? undefined : `#${value}`
}

function formatMeasurements(
  height: number | undefined,
  weight: number | undefined,
) {
  const formattedHeight =
    height === undefined
      ? undefined
      : `${Math.floor(height / 12)}′ ${height % 12}″`
  if (formattedHeight && weight) return `${formattedHeight} · ${weight} lb`
  return formattedHeight ?? (weight ? `${weight} lb` : '—')
}

function chipClass(active: boolean) {
  return `rounded-full border px-4 py-2 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00274c] ${active ? 'border-[#00274c] bg-[#00274c] text-white' : 'border-[#00274c]/15 bg-white text-[#00274c] hover:border-[#00274c]/40'}`
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00274c]/40"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5 text-[#00274c]/40 transition group-open:rotate-180"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-5 w-5"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
