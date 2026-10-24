import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowLeft,
  ChevronDown,
  CircleAlert,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { ReactNode } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import type { RosterEntry } from '~/features/roster/useMichiganRoster'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageFrame,
  PublicShell,
  StatusPill,
  Surface,
} from '~/components/AppShell'
import { useMichiganRoster } from '~/features/roster/useMichiganRoster'
import { RosterSheet } from '~/features/michigan/RosterSheet'
import {
  ROSTER_GROUPS,
  ROSTER_GROUP_LABELS,
  collegeYear,
  rosterGroup,
} from '~/features/michigan/rosterSheetModel'

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

type ActiveEntry = RosterEntry & { player: NonNullable<RosterEntry['player']> }

export function MichiganFootball() {
  const { season, setSeason } = useSeasonParam()
  const dashboard = useMichiganRoster(season)
  const [search, setSearch] = useState('')
  const [room, setRoom] = useState('all')
  const [role, setRole] = useState('all')
  const [availability, setAvailability] = useState('all')
  const [experience, setExperience] = useState('all')
  const [moreOpen, setMoreOpen] = useState(false)
  const [contributorsOnly, setContributorsOnly] = useState(false)
  const [scholarship, setScholarship] = useState('all')
  const [entryMethod, setEntryMethod] = useState('all')
  const [eligibility, setEligibility] = useState('all')
  const [quality, setQuality] = useState('all')
  const filterCount =
    [
      room,
      role,
      availability,
      experience,
      scholarship,
      entryMethod,
      eligibility,
      quality,
    ].filter((value) => value !== 'all').length + Number(contributorsOnly)

  const entries = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()
    return activeEntries(dashboard.data?.entries ?? []).filter((entry) => {
      const years = collegeYear(
        entry.eligibility.startSeason ??
          entry.season.eligibilityEvidence.enrollmentSeason,
        season,
      )
      const entryQuality = entry.season.dataQuality
      return (
        (!contributorsOnly ||
          entry.season.role === 'starter' ||
          entry.season.role === 'rotation') &&
        (!normalizedSearch ||
          entry.player.displayName.toLowerCase().includes(normalizedSearch) ||
          entry.season.listedPosition
            .toLowerCase()
            .includes(normalizedSearch) ||
          String(entry.season.jerseyNumber ?? '').includes(normalizedSearch)) &&
        (room === 'all' || entry.season.positionRoom === room) &&
        (role === 'all' ||
          rosterGroup({
            enrollmentSeason:
              entry.eligibility.startSeason ??
              entry.season.eligibilityEvidence.enrollmentSeason,
            role: entry.season.role,
            season,
          }) === role) &&
        (availability === 'all' ||
          (availability === 'available'
            ? entry.season.depthStatus === 'available'
            : entry.season.depthStatus !== 'available')) &&
        (experience === 'all' ||
          (experience === 'new'
            ? years === 1
            : years !== null && years >= Number(experience))) &&
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
    contributorsOnly,
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
    <PublicShell active="football" context="michigan">
      <main className="mx-auto w-full max-w-[1920px] px-2 py-3 sm:px-4 lg:px-6">
        <header className="mb-2 flex items-center justify-between gap-3">
          <h1 className="m-0 text-2xl font-extrabold text-[#00274c] sm:text-3xl">
            Michigan football
          </h1>
          <SeasonSelect season={season} onChange={setSeason} />
        </header>
        {dashboard.isLoading ? (
          <LoadingState label="Loading Michigan football" />
        ) : dashboard.isError ? (
          <ErrorState>
            Michigan roster data is temporarily unavailable.
          </ErrorState>
        ) : !dashboard.data ? (
          <EmptyState>No Michigan roster exists for {season}.</EmptyState>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="relative min-w-0 flex-1 basis-full sm:basis-0">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/35"
                  size={17}
                />
                <span className="sr-only">Search the roster</span>
                <input
                  className={`${controlClass} w-full pl-10`}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Player, #, position"
                  value={search}
                />
              </label>
              <button
                aria-pressed={contributorsOnly}
                className={`${controlClass} ${contributorsOnly ? 'ring-2 ring-[#00274c]' : ''}`}
                onClick={() => {
                  setContributorsOnly((value) => !value)
                  if (!contributorsOnly) setRole('all')
                }}
                title="Show only Starters and Rotation; hide Bench, Prospects, and Recruits."
                type="button"
              >
                Contributors only
              </button>
              <button
                aria-controls="roster-filters"
                aria-expanded={moreOpen}
                className={controlClass}
                onClick={() => setMoreOpen((value) => !value)}
                type="button"
              >
                <SlidersHorizontal aria-hidden="true" size={16} /> Filters
                {filterCount > 0 && (
                  <span className="rounded-full bg-[#ffcb05]/20 px-1.5 text-xs text-[#00274c]">
                    {filterCount}
                  </span>
                )}
                <ChevronDown
                  aria-hidden="true"
                  className={moreOpen ? 'rotate-180' : ''}
                  size={15}
                />
              </button>
              {(search || filterCount > 0) && (
                <button
                  className="min-h-11 rounded-lg px-2 text-sm font-semibold text-[#00274c] hover:underline"
                  onClick={() => {
                    setSearch('')
                    setRoom('all')
                    setRole('all')
                    setAvailability('all')
                    setExperience('all')
                    setScholarship('all')
                    setEntryMethod('all')
                    setEligibility('all')
                    setQuality('all')
                    setContributorsOnly(false)
                  }}
                  type="button"
                >
                  Clear filters
                </button>
              )}
              <div
                className="w-full border-t border-white/10 pt-3"
                hidden={!moreOpen}
                id="roster-filters"
              >
                <div className="flex flex-wrap gap-2">
                  <FilterSelect label="Room" onChange={setRoom} value={room}>
                    <option value="all">All rooms</option>
                    {ROOM_ORDER.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </FilterSelect>
                  <FilterSelect label="Group" onChange={setRole} value={role}>
                    <option value="all">All groups</option>
                    {ROSTER_GROUPS.filter(
                      (item) =>
                        !contributorsOnly ||
                        item === 'starter' ||
                        item === 'rotation',
                    ).map((item) => (
                      <option key={item} value={item}>
                        {ROSTER_GROUP_LABELS[item]}
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
              </div>
            </div>
            {dashboard.data.warnings.length > 0 && (
              <details className="mb-2 rounded border border-amber-300/40 bg-amber-50 px-2 text-xs text-amber-900">
                <summary className="min-h-8 cursor-pointer py-2 font-semibold">
                  <CircleAlert
                    aria-hidden="true"
                    className="mr-1 inline"
                    size={13}
                  />
                  {dashboard.data.warnings.length} roster exception
                  {dashboard.data.warnings.length === 1 ? '' : 's'}
                </summary>
                <ul className="mb-2 mt-0 grid gap-1 pl-4">
                  {dashboard.data.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              </details>
            )}
            <p
              aria-live="polite"
              className="mb-2 text-xs font-semibold text-white/40"
            >
              Showing {entries.length} of{' '}
              {activeEntries(dashboard.data.entries).length} enrolled players
            </p>
            <RosterSheet
              entries={entries}
              filters={{
                availability,
                contributorsOnly,
                eligibility,
                entryMethod,
                experience,
                quality,
                role,
                room,
                scholarship,
                search,
              }}
              rosterPlayerIds={activeEntries(dashboard.data.entries).map(
                (entry) => String(entry.player._id),
              )}
              season={season}
            />
          </>
        )}
      </main>
    </PublicShell>
  )
}

export function MichiganPlayer({ playerId }: { playerId: Id<'players'> }) {
  const { season } = useSeasonParam()
  const profile = useQuery(convexQuery(api.players.getProfile, { playerId }))
  if (profile.isLoading) {
    return (
      <PublicShell active="football" context="michigan">
        <PageFrame>
          <LoadingState label="Opening player intelligence" />
        </PageFrame>
      </PublicShell>
    )
  }
  if (!profile.data) {
    return (
      <PublicShell active="football" context="michigan">
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
    <PublicShell active="football" context="michigan">
      <PageFrame className="xl:pl-[24%]">
        <Link
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-white/50 hover:text-white"
          to="/"
          search={{ season }}
        >
          <ArrowLeft size={16} /> Back to Football
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
                  label="Eligibility start"
                  value={
                    selectedSeason?.eligibility.startSeason == null
                      ? '—'
                      : `${selectedSeason.eligibility.startSeason}${selectedSeason.eligibility.startSource === 'listed_class_estimate' ? ' (estimate)' : ''}`
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
              {selectedSeason?.participationTotals && (
                <div className="mb-4 grid gap-3 sm:grid-cols-3">
                  {(['offense', 'defense', 'specialTeams'] as const).map(
                    (phase) => {
                      const totals = selectedSeason.participationTotals?.[phase]
                      if (!totals) return null
                      return (
                        <div
                          className="rounded-xl border border-[var(--app-line)] p-3"
                          key={phase}
                        >
                          <h3 className="m-0 text-sm font-semibold">
                            {phase === 'specialTeams'
                              ? 'Special teams'
                              : humanize(phase)}{' '}
                            participation
                          </h3>
                          <p className="my-1 text-lg font-bold tabular-nums">
                            {totals.snaps} snaps · {totals.gamesPlayed} GP
                          </p>
                          <p className="m-0 text-xs text-[var(--app-muted)]">
                            {season} · through {totals.throughTeamGames} team
                            games. GP counts appearances in this phase.
                          </p>
                          {totals.offenseBreakdown && (
                            <dl className="mt-2 grid grid-cols-2 gap-x-2 text-xs tabular-nums">
                              <dt>Pass</dt>
                              <dd>{totals.offenseBreakdown.pass}</dd>
                              <dt>Pass block</dt>
                              <dd>{totals.offenseBreakdown.passBlock}</dd>
                              <dt>Run</dt>
                              <dd>{totals.offenseBreakdown.run}</dd>
                              <dt>Run block</dt>
                              <dd>{totals.offenseBreakdown.runBlock}</dd>
                            </dl>
                          )}
                          {totals.defenseBreakdown && (
                            <dl className="mt-2 grid grid-cols-2 gap-x-2 text-xs tabular-nums">
                              <dt>Run defense</dt>
                              <dd>{totals.defenseBreakdown.runDefense}</dd>
                              <dt>Pass rush</dt>
                              <dd>{totals.defenseBreakdown.passRush}</dd>
                              <dt>Coverage</dt>
                              <dd>{totals.defenseBreakdown.coverage}</dd>
                            </dl>
                          )}
                        </div>
                      )
                    },
                  )}
                </div>
              )}
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
          { length: CURRENT_SEASON - 2004 },
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

function activeEntries(entries: Array<RosterEntry>): Array<ActiveEntry> {
  return entries.filter(
    (entry): entry is ActiveEntry =>
      entry.player !== null && entry.season.rosterStatus === 'active',
  )
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
