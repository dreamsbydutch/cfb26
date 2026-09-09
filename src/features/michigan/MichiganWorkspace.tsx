import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleAlert,
  GitCompareArrows,
  Search,
  SlidersHorizontal,
  UserRoundPlus,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { ReactNode } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { RosterEntry } from '~/features/roster/useMichiganRoster'
import {
  ContextBar,
  EmptyState,
  ErrorState,
  LoadingState,
  Metric,
  PageFrame,
  PageHero,
  PublicShell,
  StatusPill,
  Surface,
} from '~/components/AppShell'
import {
  useMichiganRoster,
  useSeasonalStats,
} from '~/features/roster/useMichiganRoster'

const CURRENT_SEASON = new Date().getFullYear()
const ROOM_ORDER = [
  'Quarterbacks',
  'Backs',
  'Receivers',
  'Offensive line',
  'Defensive line',
  'Linebackers',
  'Secondary',
  'Specialists',
  'Other',
] as const
const ROLES = ['starter', 'rotation', 'reserve', 'unassigned'] as const
const ROLE_LABELS = {
  reserve: 'Reserve',
  rotation: 'Rotation',
  starter: 'Starter',
  unassigned: 'Reserve / unassigned',
} as const
const BASELINE_TARGETS = {
  Backs: 8,
  'Defensive line': 17,
  Linebackers: 14,
  'Offensive line': 18,
  Quarterbacks: 5,
  Receivers: 20,
  Secondary: 18,
  Specialists: 5,
} as const

type ActiveEntry = RosterEntry & { player: NonNullable<RosterEntry['player']> }
type RosterPreset = 'experience' | 'lifecycle' | 'performance' | 'roster'

export function MichiganMatrix() {
  const { season, setSeason } = useSeasonParam()
  const dashboard = useMichiganRoster(season)
  const [search, setSearch] = useState('')
  const [room, setRoom] = useState('all')
  const [role, setRole] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [experience, setExperience] = useState('all')
  const [moreOpen, setMoreOpen] = useState(false)
  const [scholarship, setScholarship] = useState('all')
  const [entryMethod, setEntryMethod] = useState('all')
  const [eligibility, setEligibility] = useState('all')
  const [quality, setQuality] = useState('all')
  const comparison = useComparisonTray()

  const entries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return activeEntries(dashboard.data?.entries ?? []).filter((entry) => {
      const years = Math.max(season - entry.player.entrySeason + 1, 1)
      const entryQuality = entry.season.dataQuality
      return (
        (!normalizedSearch ||
          entry.player.displayName.toLowerCase().includes(normalizedSearch) ||
          entry.season.listedPosition
            .toLowerCase()
            .includes(normalizedSearch) ||
          String(entry.season.jerseyNumber ?? '').includes(normalizedSearch)) &&
        (room === 'all' || entry.season.positionRoom === room) &&
        (role === 'all' || entry.season.role === role) &&
        (availability === 'all' ||
          (availability === 'available'
            ? entry.season.depthStatus === 'available'
            : entry.season.depthStatus !== 'available')) &&
        (experience === 'all' ||
          (experience === 'new' ? years === 1 : years >= Number(experience))) &&
        (scholarship === 'all' ||
          entry.season.scholarshipStatus === scholarship) &&
        (entryMethod === 'all' || entry.player.entryMethod === entryMethod) &&
        (eligibility === 'all' ||
          (eligibility === 'last'
            ? entry.eligibility.eligibleThroughSeason === season
            : entry.eligibility.eligibleThroughSeason !== null &&
              entry.eligibility.eligibleThroughSeason > season)) &&
        (quality === 'all' || entryQuality === quality)
      )
    })
  }, [
    availability,
    dashboard.data?.entries,
    eligibility,
    entryMethod,
    experience,
    quality,
    role,
    room,
    scholarship,
    search,
    season,
  ])

  return (
    <PublicShell active="matrix" context="michigan">
      <PageFrame>
        <PageHero
          eyebrow={`${season} Michigan · Personnel matrix`}
          title="See the whole roster as a football staff would."
          summary="Rooms run in football order. Lanes describe current usage; starts and games break ties inside each lane."
          actions={<SeasonSelect season={season} onChange={setSeason} />}
        />
        {dashboard.isLoading ? (
          <LoadingState label="Building the Michigan matrix" />
        ) : dashboard.isError ? (
          <ErrorState>
            Michigan roster data is temporarily unavailable.
          </ErrorState>
        ) : !dashboard.data ? (
          <EmptyState>No Michigan roster exists for {season}.</EmptyState>
        ) : (
          <>
            <ContextBar>
              <label className="relative min-w-[15rem] flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  size={17}
                />
                <span className="sr-only">Search the roster</span>
                <input
                  className={`${controlClass} w-full pl-10`}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Player, number, or position"
                  value={search}
                />
              </label>
              <FilterSelect label="Room" onChange={setRoom} value={room}>
                <option value="all">All rooms</option>
                {ROOM_ORDER.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Role" onChange={setRole} value={role}>
                <option value="all">All roles</option>
                {ROLES.map((item) => (
                  <option key={item} value={item}>
                    {ROLE_LABELS[item]}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                label="Availability"
                onChange={setAvailability}
                value={availability}
              >
                <option value="all">Any availability</option>
                <option value="available">Available</option>
                <option value="exception">Has exception</option>
              </FilterSelect>
              <FilterSelect
                label="Experience"
                onChange={setExperience}
                value={experience}
              >
                <option value="all">Any experience</option>
                <option value="new">First season</option>
                <option value="3">3+ seasons</option>
                <option value="5">5+ seasons</option>
              </FilterSelect>
              <button
                className={controlClass}
                onClick={() => setMoreOpen((value) => !value)}
                type="button"
              >
                <SlidersHorizontal size={16} /> More
                <ChevronDown
                  className={moreOpen ? 'rotate-180' : ''}
                  size={15}
                />
              </button>
              {moreOpen && (
                <div className="grid w-full gap-2 border-t border-white/10 pt-3 sm:grid-cols-2 xl:grid-cols-4">
                  <FilterSelect
                    label="Scholarship"
                    onChange={setScholarship}
                    value={scholarship}
                  >
                    <option value="all">Any scholarship</option>
                    <option value="scholarship">Counted</option>
                    <option value="walk_on">Walk-on</option>
                    <option value="exempt">Exempt</option>
                    <option value="unknown">Unknown</option>
                  </FilterSelect>
                  <FilterSelect
                    label="Entry"
                    onChange={setEntryMethod}
                    value={entryMethod}
                  >
                    <option value="all">Any entry route</option>
                    <option value="high_school">High school</option>
                    <option value="transfer">Transfer</option>
                    <option value="walk_on">Walk-on</option>
                    <option value="legacy">Legacy</option>
                  </FilterSelect>
                  <FilterSelect
                    label="Eligibility"
                    onChange={setEligibility}
                    value={eligibility}
                  >
                    <option value="all">Any eligibility</option>
                    <option value="last">Final season</option>
                    <option value="returning">Can return</option>
                  </FilterSelect>
                  <FilterSelect
                    label="Coverage"
                    onChange={setQuality}
                    value={quality}
                  >
                    <option value="all">Any coverage</option>
                    <option value="owner_verified">Owner verified</option>
                    <option value="source_verified">Source verified</option>
                    <option value="needs_review">Needs review</option>
                  </FilterSelect>
                </div>
              )}
            </ContextBar>
            {dashboard.data.warnings.length > 0 && (
              <Surface className="mb-5 flex items-start gap-3 border-amber-300/20 bg-amber-300/[0.055] p-4">
                <CircleAlert
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 text-amber-700"
                  size={18}
                />
                <div>
                  <p className="m-0 text-sm font-bold text-amber-900">
                    {dashboard.data.warnings.length} roster exception
                    {dashboard.data.warnings.length === 1 ? '' : 's'} affect
                    this view
                  </p>
                  <p className="m-0 mt-1 text-xs text-amber-800">
                    {dashboard.data.warnings.slice(0, 2).join(' ')}
                  </p>
                </div>
              </Surface>
            )}
            <p className="mb-4 text-xs font-semibold text-white/40">
              Showing {entries.length} of {dashboard.data.entries.length}{' '}
              players
            </p>
            <div className="grid gap-4">
              {ROOM_ORDER.map((positionRoom) => {
                const roomEntries = entries.filter(
                  (entry) => entry.season.positionRoom === positionRoom,
                )
                if (roomEntries.length === 0) return null
                return (
                  <RoomMatrix
                    comparison={comparison}
                    entries={roomEntries}
                    key={positionRoom}
                    room={positionRoom}
                    season={season}
                  />
                )
              })}
            </div>
            {entries.length === 0 && (
              <EmptyState title="No players match">
                Clear one or more filters to reopen the matrix.
              </EmptyState>
            )}
            <ComparisonTray comparison={comparison} season={season} />
          </>
        )}
      </PageFrame>
    </PublicShell>
  )
}

function RoomMatrix({
  comparison,
  entries,
  room,
  season,
}: {
  comparison: ReturnType<typeof useComparisonTray>
  entries: Array<ActiveEntry>
  room: string
  season: number
}) {
  const [open, setOpen] = useState(true)
  return (
    <Surface className="overflow-hidden p-0">
      <button
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3 text-left sm:px-5 lg:pointer-events-none"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <span>
          <span className="font-display text-xl font-extrabold uppercase tracking-wide">
            {room}
          </span>
          <span className="ml-2 text-xs font-semibold text-white/35">
            {entries.length}
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`transition lg:hidden ${open ? 'rotate-180' : ''}`}
          size={18}
        />
      </button>
      {open && (
        <div className="grid gap-px bg-white/[0.07] xl:grid-cols-[1fr_1fr_1.2fr]">
          {ROLES.slice(0, 3).map((role, index) => {
            const roleEntries = entries.filter((entry) =>
              index === 2
                ? entry.season.role === 'reserve' ||
                  entry.season.role === 'unassigned'
                : entry.season.role === role,
            )
            return (
              <section className="min-w-0 bg-[#091725] p-3" key={role}>
                <div className="mb-2 flex items-center justify-between px-1">
                  <h3 className="app-label m-0">{ROLE_LABELS[role]}</h3>
                  <span className="text-xs tabular-nums text-white/30">
                    {roleEntries.length}
                  </span>
                </div>
                <div className="grid gap-2">
                  {roleEntries.map((entry) => (
                    <PlayerTile
                      comparison={comparison}
                      entry={entry}
                      key={entry.season._id}
                      season={season}
                    />
                  ))}
                  {roleEntries.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs text-white/25">
                      No assigned players
                    </div>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </Surface>
  )
}

function PlayerTile({
  comparison,
  entry,
  season,
}: {
  comparison: ReturnType<typeof useComparisonTray>
  entry: ActiveEntry
  season: number
}) {
  const selected = comparison.ids.includes(String(entry.player._id))
  const experience = Math.max(season - entry.player.entrySeason + 1, 1)
  return (
    <article className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-white/[0.045] p-3 transition hover:bg-white/[0.075]">
      <span className="font-display grid h-10 w-10 place-items-center rounded-xl bg-black/20 text-lg font-extrabold tabular-nums text-[#ffcb05]">
        {entry.season.jerseyNumber ?? '—'}
      </span>
      <Link
        className="min-w-0 rounded-lg outline-none"
        params={{ playerId: String(entry.player._id) }}
        search={{ season }}
        to="/michigan/players/$playerId"
      >
        <strong className="block truncate text-sm text-white group-hover:text-[#ffe16a]">
          {entry.player.displayName}
        </strong>
        <span className="mt-1 block truncate text-[11px] text-white/40">
          {entry.season.listedPosition} · Year {experience} ·{' '}
          {entry.season.starts} starts / {entry.season.gamesPlayed} games
        </span>
        {entry.season.depthStatus !== 'available' && (
          <span className="mt-2 inline-block text-[10px] font-bold uppercase tracking-wider text-amber-700">
            {humanize(entry.season.depthStatus)}
          </span>
        )}
      </Link>
      <button
        aria-label={`${selected ? 'Remove' : 'Add'} ${entry.player.displayName} ${selected ? 'from' : 'to'} comparison`}
        className={`grid h-9 w-9 place-items-center rounded-xl transition ${selected ? 'bg-[#ffcb05] text-[#071421]' : 'text-white/25 hover:bg-white/10 hover:text-white'}`}
        disabled={!selected && comparison.ids.length >= 4}
        onClick={() => comparison.toggle(String(entry.player._id))}
        type="button"
      >
        {selected ? <X size={16} /> : <UserRoundPlus size={16} />}
      </button>
    </article>
  )
}

export function MichiganOverview() {
  const { season, setSeason } = useSeasonParam()
  const [preset, setPreset] = useUrlEnum<RosterPreset>('preset', 'roster', [
    'roster',
    'experience',
    'performance',
    'lifecycle',
  ])
  const dashboard = useMichiganRoster(season)
  const performance = useSeasonalStats(season)
  const entries = activeEntries(dashboard.data?.entries ?? [])
  const gradeByPlayer = new Map(
    (performance.data ?? []).map((row) => [
      String(row.player?._id),
      row.overall,
    ]),
  )
  const readiness = buildReadiness(entries, dashboard.data?.rosterLimit ?? null)

  return (
    <PublicShell active="overview" context="michigan">
      <PageFrame>
        <PageHero
          actions={<SeasonSelect onChange={setSeason} season={season} />}
          eyebrow={`${season} Michigan · Overview`}
          summary="Roster readiness is measured against the DbyD roster template. Role counts describe usage; they do not change the room target."
          title="Construction first. Performance with its sample attached."
        />
        {dashboard.isLoading ? (
          <LoadingState label="Reading roster construction" />
        ) : !dashboard.data ? (
          <EmptyState>No Michigan roster exists for {season}.</EmptyState>
        ) : (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Active roster"
                note={`${dashboard.data.scholarship.counted} counted scholarships`}
                value={entries.length}
              />
              <Metric
                label="Returning production"
                note={`${dashboard.data.returningProduction.players} tracked players`}
                value={formatPercent(dashboard.data.returningProduction.rate)}
              />
              <Metric
                label="Roster limit"
                note="Targets scale to this season"
                value={dashboard.data.rosterLimit ?? '—'}
              />
              <Metric
                label="Known graded snaps"
                note="All phases, selected season"
                value={(performance.data ?? []).reduce(
                  (sum, row) => sum + row.overall.gradedSnaps,
                  0,
                )}
              />
            </div>
            <Surface className="mb-5 p-5">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="app-kicker">DbyD roster template</p>
                  <h2 className="mt-1 text-2xl font-bold">Room readiness</h2>
                </div>
                <p className="m-0 max-w-lg text-xs leading-5 text-white/40">
                  Baseline: QB 5, Backs 8, Receivers 20, OL 18, DL 17, LB 14,
                  Secondary 18, Specialists 5. Targets scale from 105 to the
                  selected season&apos;s roster limit.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {readiness.map((item) => (
                  <ReadinessCard item={item} key={item.room} />
                ))}
              </div>
            </Surface>
            <Surface className="overflow-hidden p-0">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
                <div>
                  <p className="app-kicker">Roster intelligence</p>
                  <h2 className="mt-1 text-2xl font-bold">Sortable evidence</h2>
                </div>
                <div className="scrollbar-none flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white/[0.035] p-1">
                  {(
                    [
                      ['roster', 'Roster'],
                      ['experience', 'Experience'],
                      ['performance', 'Performance'],
                      ['lifecycle', 'Lifecycle'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      className={`min-h-10 rounded-xl px-3 text-xs font-extrabold uppercase tracking-wider ${preset === id ? 'bg-[#ffcb05] text-[#071421]' : 'text-white/45 hover:text-white'}`}
                      key={id}
                      onClick={() => setPreset(id)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <RosterTable
                entries={entries}
                gradeByPlayer={gradeByPlayer}
                preset={preset}
                season={season}
              />
            </Surface>
          </>
        )}
      </PageFrame>
    </PublicShell>
  )
}

function ReadinessCard({
  item,
}: {
  item: ReturnType<typeof buildReadiness>[number]
}) {
  const tone =
    item.status === 'On target'
      ? 'success'
      : item.status === 'Monitor'
        ? 'maize'
        : item.status === 'Critical'
          ? 'danger'
          : 'neutral'
  return (
    <div className="rounded-2xl bg-white/[0.035] p-4">
      <div className="flex items-start justify-between gap-2">
        <strong className="text-sm">{item.room}</strong>
        <StatusPill tone={tone}>{item.status}</StatusPill>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="font-display text-3xl font-extrabold tabular-nums">
          {item.actual}
          <small className="text-base text-white/30">/{item.target}</small>
        </span>
        <span className="text-xs font-bold tabular-nums text-white/40">
          {Math.round(item.rate * 100)}%
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/30">
        <div
          className="h-full rounded-full bg-[#ffcb05]"
          style={{ width: `${Math.min(item.rate * 100, 100)}%` }}
        />
      </div>
    </div>
  )
}

function RosterTable({
  entries,
  gradeByPlayer,
  preset,
  season,
}: {
  entries: Array<ActiveEntry>
  gradeByPlayer: Map<
    string,
    { band: string; gradedSnaps: number; weightedGrade: number | null }
  >
  preset: RosterPreset
  season: number
}) {
  const sorted = [...entries].sort((left, right) => {
    if (preset === 'performance') {
      return (
        (gradeByPlayer.get(String(right.player._id))?.weightedGrade ?? -1) -
        (gradeByPlayer.get(String(left.player._id))?.weightedGrade ?? -1)
      )
    }
    if (preset === 'experience') {
      return left.player.entrySeason - right.player.entrySeason
    }
    if (preset === 'lifecycle') {
      return (
        (left.eligibility.eligibleThroughSeason ?? 9999) -
        (right.eligibility.eligibleThroughSeason ?? 9999)
      )
    }
    return (
      ROOM_ORDER.indexOf(
        left.season.positionRoom as (typeof ROOM_ORDER)[number],
      ) -
        ROOM_ORDER.indexOf(
          right.season.positionRoom as (typeof ROOM_ORDER)[number],
        ) || right.season.starts - left.season.starts
    )
  })
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left text-sm">
        <thead className="app-label bg-black/15">
          <tr>
            <th className="px-4 py-3">Player</th>
            <th className="px-4 py-3">Room / role</th>
            <th className="px-4 py-3">Experience</th>
            <th className="px-4 py-3">Games / starts</th>
            {preset === 'performance' && <th className="px-4 py-3">Overall</th>}
            {preset === 'lifecycle' && (
              <th className="px-4 py-3">Eligible through</th>
            )}
            {preset === 'roster' && <th className="px-4 py-3">Scholarship</th>}
            {preset === 'experience' && <th className="px-4 py-3">Entry</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry) => {
            const grade = gradeByPlayer.get(String(entry.player._id))
            return (
              <tr
                className="border-t border-white/[0.065] hover:bg-white/[0.025]"
                key={entry.season._id}
              >
                <td className="px-4 py-3">
                  <Link
                    className="font-bold hover:text-[#ffcb05]"
                    params={{ playerId: String(entry.player._id) }}
                    search={{ season }}
                    to="/michigan/players/$playerId"
                  >
                    <span className="mr-2 text-[#ffcb05]">
                      {entry.season.jerseyNumber ?? '—'}
                    </span>
                    {entry.player.displayName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-white/55">
                  {entry.season.positionRoom} · {humanize(entry.season.role)}
                </td>
                <td className="px-4 py-3 tabular-nums text-white/55">
                  Year {Math.max(season - entry.player.entrySeason + 1, 1)}
                </td>
                <td className="px-4 py-3 tabular-nums text-white/55">
                  {entry.season.gamesPlayed} / {entry.season.starts}
                </td>
                {preset === 'performance' && (
                  <td className="px-4 py-3 tabular-nums">
                    {grade?.weightedGrade ?? '—'}
                    {grade && (
                      <small className="ml-2 text-white/35">
                        {grade.band} · {grade.gradedSnaps} snaps
                      </small>
                    )}
                  </td>
                )}
                {preset === 'lifecycle' && (
                  <td className="px-4 py-3 tabular-nums text-white/55">
                    {entry.eligibility.eligibleThroughSeason ?? '—'}
                  </td>
                )}
                {preset === 'roster' && (
                  <td className="px-4 py-3 text-white/55">
                    {humanize(entry.season.scholarshipStatus)}
                  </td>
                )}
                {preset === 'experience' && (
                  <td className="px-4 py-3 text-white/55">
                    {entry.player.entrySeason} ·{' '}
                    {humanize(entry.player.entryMethod)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function MichiganMovement() {
  const { season, setSeason } = useSeasonParam()
  const movements = useQuery(
    convexQuery(api.rosters.listMovements, {
      limit: 300,
      programKey: 'michigan',
      season,
    }),
  )
  return (
    <PublicShell active="movement" context="michigan">
      <PageFrame>
        <PageHero
          actions={<SeasonSelect onChange={setSeason} season={season} />}
          eyebrow={`${season} Michigan · Movement`}
          summary="Every roster arrival and departure remains attached to a person, season, and source record."
          title="Follow the roster ledger, not the rumor cycle."
        />
        {movements.isLoading ? (
          <LoadingState label="Reading movement history" />
        ) : movements.data?.length ? (
          <Surface className="overflow-hidden p-0">
            <div className="divide-y divide-white/[0.07]">
              {[...movements.data]
                .sort(
                  (left, right) =>
                    right.event._creationTime - left.event._creationTime,
                )
                .map((row) => (
                  <article
                    className="grid gap-2 px-4 py-4 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center"
                    key={row.event._id}
                  >
                    <time className="text-xs tabular-nums text-white/35">
                      {new Date(row.event._creationTime).toLocaleDateString()}
                    </time>
                    <div>
                      <strong>
                        {row.player?.displayName ?? 'Unknown player'}
                      </strong>
                      <p className="m-0 mt-1 text-xs text-white/40">
                        {row.event.note ??
                          `${humanize(row.event.kind)} recorded`}
                      </p>
                    </div>
                    <StatusPill tone={movementTone(row.event.kind)}>
                      {humanize(row.event.kind)}
                    </StatusPill>
                  </article>
                ))}
            </div>
          </Surface>
        ) : (
          <EmptyState>No movement is recorded for {season}.</EmptyState>
        )}
      </PageFrame>
    </PublicShell>
  )
}

export function MichiganAlumni() {
  const alumni = useQuery(
    convexQuery(api.players.listNflAlumni, { fromSeason: 2015, limit: 200 }),
  )
  return (
    <PublicShell active="alumni" context="michigan">
      <PageFrame>
        <PageHero
          eyebrow="Michigan · NFL alumni"
          summary="Current NFL identity and weekly status are kept distinct from Michigan career evidence."
          title="Track where Michigan careers went next."
        />
        {alumni.isLoading ? (
          <LoadingState label="Loading NFL alumni" />
        ) : alumni.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {alumni.data.map((row) => (
              <Surface className="p-4" key={row.identity._id}>
                <Link
                  className="text-lg font-bold hover:text-[#ffcb05]"
                  params={{ playerId: String(row.player?._id) }}
                  search={{ season: undefined }}
                  to="/michigan/players/$playerId"
                >
                  {row.player?.displayName}
                </Link>
                <p className="m-0 mt-2 text-sm text-white/50">
                  {row.latestWeek?.team ?? 'No current weekly team'} ·{' '}
                  {humanize(row.latestWeek?.status ?? row.identity.entryPath)}
                </p>
                <p className="m-0 mt-4 text-xs text-white/35">
                  NFL seasons tracked: {row.seasons.length}
                </p>
              </Surface>
            ))}
          </div>
        ) : (
          <EmptyState>No linked NFL alumni are available.</EmptyState>
        )}
      </PageFrame>
    </PublicShell>
  )
}

export function MichiganPlayer({ playerId }: { playerId: Id<'players'> }) {
  const { season } = useSeasonParam()
  const profile = useQuery(convexQuery(api.players.getProfile, { playerId }))
  if (profile.isLoading) {
    return (
      <PublicShell active="matrix" context="michigan">
        <PageFrame>
          <LoadingState label="Opening player intelligence" />
        </PageFrame>
      </PublicShell>
    )
  }
  if (!profile.data) {
    return (
      <PublicShell active="matrix" context="michigan">
        <PageFrame>
          <EmptyState>That player record could not be found.</EmptyState>
        </PageFrame>
      </PublicShell>
    )
  }
  const selectedSeason = (profile.data.seasons.find(
    (row) => row.season === season,
  ) ?? [...profile.data.seasons].sort((a, b) => b.season - a.season)[0]) as
    (typeof profile.data.seasons)[number] | undefined
  const selectedGrade =
    profile.data.overallGrades.bySeason.find((row) => row.season === season) ??
    null
  return (
    <PublicShell active="matrix" context="michigan">
      <PageFrame className="xl:pl-[24%]">
        <Link
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white"
          to="/"
        >
          <ArrowLeft size={16} /> Back to Matrix
        </Link>
        <Surface className="overflow-hidden p-0 shadow-2xl">
          <header className="border-b border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-5 sm:p-7">
            <p className="app-kicker">
              Player intelligence · Current status first
            </p>
            <div className="mt-4 flex flex-wrap items-end justify-between gap-5">
              <div>
                <h1 className="font-display m-0 text-4xl font-extrabold uppercase leading-none sm:text-6xl">
                  {profile.data.player.displayName}
                </h1>
                <p className="m-0 mt-3 text-sm text-white/50">
                  {selectedSeason
                    ? `${selectedSeason.listedPosition} · ${selectedSeason.positionRoom} · ${season}`
                    : `${profile.data.player.entrySeason} entry`}
                </p>
              </div>
              {selectedSeason && (
                <StatusPill
                  tone={
                    selectedSeason.depthStatus === 'available'
                      ? 'success'
                      : 'maize'
                  }
                >
                  {humanize(selectedSeason.depthStatus)}
                </StatusPill>
              )}
            </div>
          </header>
          <nav
            aria-label="Player sections"
            className="scrollbar-none sticky top-16 z-10 flex gap-1 overflow-x-auto border-b border-white/10 bg-[#091725]/95 p-2 backdrop-blur lg:top-[7.3rem]"
          >
            {[
              'status',
              'seasons',
              'performance',
              'movement',
              'evaluations',
              'next',
            ].map((id) => (
              <a
                className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white/45 hover:bg-white/5 hover:text-white"
                href={`#${id}`}
                key={id}
              >
                {humanize(id)}
              </a>
            ))}
          </nav>
          <div className="grid gap-4 p-4 sm:p-6">
            <ProfileSection id="status" title="Current status">
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Definition
                  label="Number"
                  value={selectedSeason?.jerseyNumber ?? '—'}
                />
                <Definition
                  label="Role"
                  value={selectedSeason ? humanize(selectedSeason.role) : '—'}
                />
                <Definition
                  label="Games / starts"
                  value={
                    selectedSeason
                      ? `${selectedSeason.gamesPlayed} / ${selectedSeason.starts}`
                      : '—'
                  }
                />
                <Definition
                  label="Eligible through"
                  value={
                    selectedSeason?.eligibility.eligibleThroughSeason ?? '—'
                  }
                />
              </dl>
            </ProfileSection>
            <ProfileSection id="seasons" title="Michigan seasons">
              <div className="grid gap-2">
                {[...profile.data.seasons]
                  .sort((a, b) => b.season - a.season)
                  .map((row) => (
                    <div
                      className="grid grid-cols-[5rem_1fr_auto] gap-3 rounded-xl bg-white/[0.035] p-3 text-sm"
                      key={row._id}
                    >
                      <b>{row.season}</b>
                      <span className="text-white/50">
                        {row.listedPosition} · {humanize(row.role)}
                      </span>
                      <span className="tabular-nums text-white/40">
                        {row.gamesPlayed} GP · {row.starts} GS
                      </span>
                    </div>
                  ))}
              </div>
            </ProfileSection>
            <ProfileSection id="performance" title="Performance">
              <div className="grid gap-3 sm:grid-cols-2">
                <GradeCard
                  label={`${season} overall`}
                  summary={selectedGrade}
                />
                <GradeCard
                  label="Career overall"
                  summary={profile.data.overallGrades.career}
                />
              </div>
            </ProfileSection>
            <ProfileSection id="movement" title="Movement">
              <RecordList
                rows={profile.data.movements.map((row) => ({
                  id: String(row._id),
                  label: humanize(row.kind),
                  meta: `${row.season} · ${row.note ?? 'No note'}`,
                }))}
              />
            </ProfileSection>
            <ProfileSection id="evaluations" title="Evaluations">
              <RecordList
                rows={profile.data.evaluations.map((row) => ({
                  id: String(row._id),
                  label: `${row.provider} · ${humanize(row.kind)}`,
                  meta: row.notes ?? `Rank ${row.rank ?? '—'}`,
                }))}
              />
            </ProfileSection>
            <ProfileSection id="next" title="Draft and NFL">
              <p className="m-0 text-sm text-white/50">
                {profile.data.nfl.identity
                  ? `${humanize(profile.data.nfl.identity.entryPath)} · ${profile.data.nfl.seasons.length} NFL seasons tracked`
                  : profile.data.draft.length
                    ? `${profile.data.draft.length} draft outcome record${profile.data.draft.length === 1 ? '' : 's'}`
                    : '—'}
              </p>
            </ProfileSection>
          </div>
        </Surface>
      </PageFrame>
    </PublicShell>
  )
}

export function MichiganCompare() {
  const { season, setSeason } = useSeasonParam()
  const comparison = useComparisonTray()
  const playerIds = comparison.ids.slice(0, 4) as Array<Id<'players'>>
  const compared = useQuery({
    ...convexQuery(api.players.compare, { playerIds, season }),
    enabled: playerIds.length > 0,
  })
  return (
    <PublicShell active="compare" context="michigan">
      <PageFrame>
        <PageHero
          actions={<SeasonSelect onChange={setSeason} season={season} />}
          eyebrow={`${season} Michigan · Comparison`}
          summary="Players are columns and evidence is rows. The comparison presents context without declaring a winner."
          title="Put up to four careers on the same evidence grid."
        />
        {playerIds.length === 0 ? (
          <EmptyState title="Comparison tray is empty">
            Add players from the Matrix. Your tray persists while you move
            through Michigan views.
          </EmptyState>
        ) : compared.isLoading ? (
          <LoadingState label="Aligning player evidence" />
        ) : compared.data ? (
          <Surface className="overflow-x-auto p-0">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="w-48 p-4">
                    <span className="app-label">Evidence</span>
                  </th>
                  {compared.data.map((row) => (
                    <th className="p-4 align-top" key={row.player._id}>
                      <button
                        aria-label={`Remove ${row.player.displayName}`}
                        className="float-right grid h-8 w-8 place-items-center rounded-lg text-white/30 hover:bg-white/5 hover:text-white"
                        onClick={() =>
                          comparison.toggle(String(row.player._id))
                        }
                        type="button"
                      >
                        <X size={15} />
                      </button>
                      <Link
                        className="text-lg font-bold hover:text-[#ffcb05]"
                        params={{ playerId: String(row.player._id) }}
                        search={{ season }}
                        to="/michigan/players/$playerId"
                      >
                        {row.player.displayName}
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <ComparisonRow
                  label={`${season} overall`}
                  values={compared.data.map((row) =>
                    formatGrade(row.overallGrades.selectedSeason),
                  )}
                />
                <ComparisonRow
                  label="Career overall"
                  values={compared.data.map((row) =>
                    formatGrade(row.overallGrades.career),
                  )}
                />
                <ComparisonRow
                  label={`${season} role`}
                  values={compared.data.map((row) => {
                    const current = row.seasons.find(
                      (item) => item.season === season,
                    )
                    return current
                      ? `${current.listedPosition} · ${humanize(current.role)}`
                      : '—'
                  })}
                />
                <ComparisonRow
                  label="Games / starts"
                  values={compared.data.map((row) => {
                    const current = row.seasons.find(
                      (item) => item.season === season,
                    )
                    return current
                      ? `${current.gamesPlayed} / ${current.starts}`
                      : '—'
                  })}
                />
                <ComparisonRow
                  label="Michigan seasons"
                  values={compared.data.map((row) =>
                    String(row.seasons.length),
                  )}
                />
                <ComparisonRow
                  label="NFL seasons"
                  values={compared.data.map((row) => String(row.nfl.length))}
                />
              </tbody>
            </table>
          </Surface>
        ) : (
          <ErrorState>The player comparison could not be loaded.</ErrorState>
        )}
      </PageFrame>
    </PublicShell>
  )
}

function ComparisonRow({
  label,
  values,
}: {
  label: string
  values: Array<string>
}) {
  return (
    <tr className="border-t border-white/[0.065]">
      <th className="p-4 text-xs font-bold uppercase tracking-wider text-white/40">
        {label}
      </th>
      {values.map((value, index) => (
        <td className="p-4 text-sm text-white/65" key={`${label}:${index}`}>
          {value}
        </td>
      ))}
    </tr>
  )
}

function ComparisonTray({
  comparison,
  season,
}: {
  comparison: ReturnType<typeof useComparisonTray>
  season: number
}) {
  if (comparison.ids.length === 0) return null
  return (
    <aside className="fixed inset-x-3 bottom-[4.75rem] z-30 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-[#ffcb05]/25 bg-[#0b1d2e]/95 p-3 shadow-2xl backdrop-blur-xl lg:bottom-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#ffcb05] text-[#071421]">
        <GitCompareArrows size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <strong className="block text-sm">
          {comparison.ids.length} of 4 selected
        </strong>
        <small className="block text-white/40">
          Comparison persists across Michigan views
        </small>
      </div>
      <Link
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs font-extrabold text-[#071421]"
        search={{ players: comparison.ids.join(','), season }}
        to="/michigan/compare"
      >
        Compare <ArrowRight size={15} />
      </Link>
    </aside>
  )
}

function useComparisonTray() {
  const [ids, setIds] = useState<Array<string>>(() => {
    if (typeof window === 'undefined') return []
    const fromUrl = new URLSearchParams(window.location.search)
      .get('players')
      ?.split(',')
      .filter(Boolean)
      .slice(0, 4)
    if (fromUrl?.length) return fromUrl
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem('dbyd-comparison') ?? '[]',
      )
      return Array.isArray(value)
        ? value
            .filter((item): item is string => typeof item === 'string')
            .slice(0, 4)
        : []
    } catch {
      return []
    }
  })
  useEffect(() => {
    localStorage.setItem('dbyd-comparison', JSON.stringify(ids))
    if (window.location.pathname === '/michigan/compare') {
      setUrlParam('players', ids.join(','))
    }
  }, [ids])
  return {
    ids,
    toggle(id: string) {
      setIds((current) =>
        current.includes(id)
          ? current.filter((item) => item !== id)
          : [...current, id].slice(0, 4),
      )
    },
  }
}

function useSeasonParam() {
  const [season, setSeasonState] = useState(() =>
    readNumberParam('season', CURRENT_SEASON),
  )
  const setSeason = (value: number) => {
    setSeasonState(value)
    setUrlParam('season', String(value))
  }
  return { season, setSeason }
}

function useUrlEnum<T extends string>(
  key: string,
  fallback: T,
  values: Array<T>,
) {
  const [value, setValueState] = useState<T>(() => {
    if (typeof window === 'undefined') return fallback
    const candidate = new URLSearchParams(window.location.search).get(
      key,
    ) as T | null
    return candidate && values.includes(candidate) ? candidate : fallback
  })
  const setValue = (next: T) => {
    setValueState(next)
    setUrlParam(key, next)
  }
  return [value, setValue] as const
}

function setUrlParam(key: string, value: string) {
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url)
}

function readNumberParam(key: string, fallback: number) {
  if (typeof window === 'undefined') return fallback
  const value = Number(new URLSearchParams(window.location.search).get(key))
  return Number.isInteger(value) && value >= 1900 && value <= CURRENT_SEASON + 2
    ? value
    : fallback
}

function SeasonSelect({
  onChange,
  season,
}: {
  onChange: (season: number) => void
  season: number
}) {
  return (
    <label>
      <span className="sr-only">Season</span>
      <select
        className={controlClass}
        onChange={(event) => onChange(Number(event.target.value))}
        value={season}
      >
        {Array.from(
          { length: CURRENT_SEASON - 2014 },
          (_, index) => CURRENT_SEASON - index,
        ).map((year) => (
          <option key={year}>{year}</option>
        ))}
      </select>
    </label>
  )
}

function FilterSelect({
  children,
  label,
  onChange,
  value,
}: {
  children: ReactNode
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        className={controlClass}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {children}
      </select>
    </label>
  )
}

function ProfileSection({
  children,
  id,
  title,
}: {
  children: ReactNode
  id: string
  title: string
}) {
  return (
    <section className="scroll-mt-36 rounded-2xl bg-white/[0.025] p-4" id={id}>
      <h2 className="mb-4 text-xl font-bold">{title}</h2>
      {children}
    </section>
  )
}

function Definition({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="app-label">{label}</dt>
      <dd className="m-0 mt-1 text-lg font-bold">{value}</dd>
    </div>
  )
}

function GradeCard({
  label,
  summary,
}: {
  label: string
  summary: {
    band: string
    gradedSnaps: number
    weightedGrade: number | null
  } | null
}) {
  return (
    <div className="rounded-2xl bg-black/15 p-4">
      <p className="app-label">{label}</p>
      <strong className="font-display mt-2 block text-4xl font-extrabold tabular-nums">
        {summary?.weightedGrade ?? '—'}
      </strong>
      {summary && (
        <p className="m-0 mt-1 text-xs text-white/40">
          {summary.band} · {summary.gradedSnaps} known graded snaps
        </p>
      )}
    </div>
  )
}

function RecordList({
  rows,
}: {
  rows: Array<{ id: string; label: string; meta: string }>
}) {
  if (rows.length === 0) return <p className="m-0 text-sm text-white/45">—</p>
  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div className="rounded-xl bg-black/15 p-3" key={row.id}>
          <strong className="text-sm">{row.label}</strong>
          <p className="m-0 mt-1 text-xs text-white/40">{row.meta}</p>
        </div>
      ))}
    </div>
  )
}

function buildReadiness(
  entries: Array<ActiveEntry>,
  rosterLimit: number | null,
) {
  const scale = (rosterLimit ?? 105) / 105
  return Object.entries(BASELINE_TARGETS).map(([room, baseline]) => {
    const target = Math.max(1, Math.round(baseline * scale))
    const actual = entries.filter(
      (entry) => entry.season.positionRoom === room,
    ).length
    const rate = actual / target
    return { actual, rate, room, status: readinessStatus(rate), target }
  })
}

function readinessStatus(rate: number) {
  if (rate >= 1) return 'On target' as const
  if (rate >= 0.9) return 'Monitor' as const
  if (rate >= 0.75) return 'Thin' as const
  return 'Critical' as const
}

function activeEntries(entries: Array<RosterEntry>): Array<ActiveEntry> {
  return entries.filter(
    (entry): entry is ActiveEntry =>
      entry.player !== null && entry.season.rosterStatus === 'active',
  )
}

function formatGrade(
  summary: {
    band: string
    gradedSnaps: number
    weightedGrade: number | null
  } | null,
) {
  return summary?.weightedGrade === null || !summary
    ? '—'
    : `${summary.weightedGrade} · ${summary.band} · ${summary.gradedSnaps} snaps`
}

function formatPercent(value: number | null) {
  return value === null ? '—' : `${Math.round(value * 100)}%`
}

function movementTone(
  kind: string,
): 'danger' | 'maize' | 'neutral' | 'success' {
  if (
    ['enrolled', 'recruited', 'returned', 'transfer_in', 'walk_on'].includes(
      kind,
    )
  )
    return 'success'
  if (['decommitted', 'dismissed', 'retired', 'transfer_out'].includes(kind))
    return 'danger'
  return 'neutral'
}

function humanize(value: string) {
  return value
    .replaceAll('_', ' ')
    .replace(/^./, (character) => character.toUpperCase())
}

const controlClass =
  'app-control inline-flex min-h-11 items-center gap-2 bg-[#0c1b2a] px-3 text-sm font-semibold text-white outline-none'

export function MichiganLoading() {
  return <LoadingState label="Loading Michigan intelligence" />
}

export function MichiganError() {
  return <ErrorState>Michigan intelligence could not be loaded.</ErrorState>
}
