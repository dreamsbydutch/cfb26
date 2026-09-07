import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { api } from '../../../../convex/_generated/api'
import { useMichiganRoster } from '../useMichiganRoster'
import { PrototypeEmpty, titleCase } from './PrototypeShared'
import {
  PersonnelCommand,
  RosterMatrix,
  ScoutWorkbench,
} from './RosterPrototypeVariants'
import './roster-prototype.css'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import type { KeyboardEvent, ReactNode } from 'react'
import type {
  ActiveRosterEntry,
  PrototypeViewProps,
} from './RosterPrototypeVariants'

type Variant = 'A' | 'B' | 'C'
type Profile = NonNullable<FunctionReturnType<typeof api.players.getProfile>>

const CURRENT_SEASON = new Date().getFullYear()
const SEASONS = Array.from(
  { length: CURRENT_SEASON - 2014 },
  (_, index) => CURRENT_SEASON - index,
)
const VARIANTS: ReadonlyArray<{
  id: Variant
  label: string
  shortLabel: string
}> = [
  { id: 'A', label: 'Personnel Command', shortLabel: 'Command' },
  { id: 'B', label: 'Scout Workbench', shortLabel: 'Workbench' },
  { id: 'C', label: 'Roster Matrix', shortLabel: 'Matrix' },
]

export function RosterPrototype() {
  const [variant, setVariantState] = useState<Variant>(readVariant)
  const [season, setSeasonState] = useState(readSeason)
  const [room, setRoom] = useState('All rooms')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Id<'players'> | null>(null)
  const [comparison, setComparison] = useState<Array<Id<'players'>>>([])
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const dashboard = useMichiganRoster(season)
  const movements = useQuery(
    convexQuery(api.rosters.listMovements, {
      limit: 200,
      programKey: 'michigan',
      season,
    }),
  )

  useEffect(() => {
    setRoom('All rooms')
    setSelected(null)
    setComparison([])
    setComparisonOpen(false)
  }, [season])

  const entries = useMemo(
    () =>
      (dashboard.data?.entries ?? []).filter(
        (entry): entry is ActiveRosterEntry => entry.player !== null,
      ),
    [dashboard.data?.entries],
  )
  const rooms = useMemo(
    () =>
      [...new Set(entries.map((entry) => entry.season.positionRoom))].sort(
        (left, right) => left.localeCompare(right),
      ),
    [entries],
  )
  const filteredEntries = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase()
    return entries.filter(
      (entry) =>
        (room === 'All rooms' || entry.season.positionRoom === room) &&
        (normalizedSearch.length === 0 ||
          entry.player.displayName
            .toLocaleLowerCase()
            .includes(normalizedSearch) ||
          entry.season.listedPosition
            .toLocaleLowerCase()
            .includes(normalizedSearch)),
    )
  }, [entries, room, search])

  const setVariant = (nextVariant: Variant) => {
    setVariantState(nextVariant)
    writeSearchParams({ variant: nextVariant })
  }
  const setSeason = (nextSeason: number) => {
    setSeasonState(nextSeason)
    writeSearchParams({ season: String(nextSeason) })
  }
  const toggleComparison = (playerId: Id<'players'>) => {
    setComparison((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : current.length < 4
          ? [...current, playerId]
          : current,
    )
  }

  const contentProps: PrototypeViewProps | null = dashboard.data
    ? {
        comparison,
        data: dashboard.data,
        entries,
        filteredEntries,
        movements: movements.data ?? [],
        onCompare: toggleComparison,
        onRoomChange: setRoom,
        onSelect: setSelected,
        room,
        rooms,
        search,
        season,
      }
    : null

  return (
    <div className={`roster-prototype prototype-${variant.toLowerCase()}`}>
      <PrototypeHeader
        search={search}
        season={season}
        setSearch={setSearch}
        setSeason={setSeason}
        variant={variant}
      />

      {dashboard.isLoading ? (
        <RosterPrototypeLoading />
      ) : dashboard.isError ? (
        <PrototypeErrorPanel />
      ) : !contentProps ? (
        <PrototypeEmpty>
          No Michigan record exists for {season}. The app did not substitute an
          empty roster for missing source data.
        </PrototypeEmpty>
      ) : variant === 'A' ? (
        <PersonnelCommand {...contentProps} />
      ) : variant === 'B' ? (
        <ScoutWorkbench {...contentProps} />
      ) : (
        <RosterMatrix {...contentProps} />
      )}

      {selected && (
        <PlayerQuickView
          playerId={selected}
          onClose={() => setSelected(null)}
        />
      )}
      {comparison.length > 0 && (
        <ComparisonTray
          entries={entries}
          ids={comparison}
          onClear={() => setComparison([])}
          onOpen={() => setComparisonOpen(true)}
          onRemove={toggleComparison}
        />
      )}
      {comparisonOpen && (
        <ComparisonPanel
          ids={comparison}
          onClose={() => setComparisonOpen(false)}
        />
      )}
      <VariantSwitcher active={variant} onChange={setVariant} />
    </div>
  )
}

function PrototypeHeader({
  search,
  season,
  setSearch,
  setSeason,
  variant,
}: {
  search: string
  season: number
  setSearch: (value: string) => void
  setSeason: (value: number) => void
  variant: Variant
}) {
  return (
    <header className="prototype-header">
      <div className="prototype-header__top">
        <Link to="/" className="prototype-brand" aria-label="DbyD CFB home">
          <DbyDMark />
          <span>
            <strong>DbyD CFB</strong>
            <small>College football intelligence</small>
          </span>
        </Link>
        <nav aria-label="Workspace navigation" className="prototype-workspaces">
          <Link to="/" aria-current="page">
            Michigan
          </Link>
          <Link to="/games">National</Link>
          <Link to="/admin/roster">Owner</Link>
        </nav>
        <div className="prototype-header__controls">
          <label className="prototype-search">
            <span className="sr-only">Search roster</span>
            <SearchIcon />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Find player or position"
            />
          </label>
          <label className="prototype-season">
            <span>Season</span>
            <select
              value={season}
              onChange={(event) => setSeason(Number(event.target.value))}
            >
              {SEASONS.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="prototype-header__subnav">
        <nav aria-label="Michigan navigation">
          <a href="#overview" aria-current="page">
            Overview
          </a>
          <a href="#roster-board">Roster</a>
          <a href="#roster-board">Players</a>
          <Link to="/games">Games</Link>
          <a href="#development-panel">Development</a>
          <a href="#roster-board">Grades</a>
          <a href="#movement-feed">Alumni</a>
        </nav>
        <span className="prototype-header__mode">
          Concept {variant} · Live Convex data
        </span>
      </div>
    </header>
  )
}

function DbyDMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="prototype-mark">
      <path
        className="prototype-mark__grid"
        d="M16 2v44M32 2v44M2 16h44M2 32h44"
      />
      <rect x="2" y="2" width="44" height="44" />
      <path d="M9 10v28h5c9 0 9-28 0-28H9m17 1 13 26m0-26L26 37" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </svg>
  )
}

function VariantSwitcher({
  active,
  onChange,
}: {
  active: Variant
  onChange: (variant: Variant) => void
}) {
  const moveSelection = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const current = VARIANTS.findIndex((variant) => variant.id === active)
    const direction = event.key === 'ArrowRight' ? 1 : -1
    const next = (current + direction + VARIANTS.length) % VARIANTS.length
    onChange(VARIANTS[next].id)
  }
  return (
    <div
      className="variant-switcher"
      role="group"
      aria-label="Prototype variant"
      onKeyDown={moveSelection}
    >
      <span className="variant-switcher__label">Prototype</span>
      {VARIANTS.map((variant) => (
        <button
          key={variant.id}
          type="button"
          aria-pressed={active === variant.id}
          title={variant.label}
          onClick={() => onChange(variant.id)}
        >
          <b>{variant.id}</b>
          <span>{variant.shortLabel}</span>
        </button>
      ))}
    </div>
  )
}

function ComparisonTray({
  entries,
  ids,
  onClear,
  onOpen,
  onRemove,
}: {
  entries: Array<ActiveRosterEntry>
  ids: Array<Id<'players'>>
  onClear: () => void
  onOpen: () => void
  onRemove: (id: Id<'players'>) => void
}) {
  const selectedEntries = ids
    .map((id) => entries.find((entry) => entry.player._id === id))
    .filter((entry): entry is ActiveRosterEntry => entry !== undefined)
  return (
    <aside className="comparison-tray" aria-label="Player comparison tray">
      <div className="comparison-tray__title">
        <span>Comparison</span>
        <b>{ids.length}/4</b>
      </div>
      <div className="comparison-tray__players">
        {selectedEntries.map((entry) => (
          <button
            key={entry.player._id}
            type="button"
            onClick={() => onRemove(entry.player._id)}
            title={`Remove ${entry.player.displayName}`}
          >
            {entry.player.displayName} <span>×</span>
          </button>
        ))}
      </div>
      <button type="button" className="text-action" onClick={onClear}>
        Clear
      </button>
      <button type="button" className="primary-action" onClick={onOpen}>
        Compare now
      </button>
    </aside>
  )
}

function ComparisonPanel({
  ids,
  onClose,
}: {
  ids: Array<Id<'players'>>
  onClose: () => void
}) {
  const result = useQuery(convexQuery(api.players.compare, { playerIds: ids }))
  return (
    <ModalFrame label="Player comparison" onClose={onClose}>
      <div className="sheet-kicker">DbyD comparison lab</div>
      <h2>Side-by-side evidence</h2>
      <p className="sheet-summary">
        Career-level Michigan production and DbyD Player Grades. Game and season
        modes will follow the selected prototype direction.
      </p>
      <div className="comparison-grid">
        {(result.data ?? []).map((row) => (
          <article key={row.player._id}>
            <div className="comparison-grid__room">
              {row.seasons.at(-1)?.positionRoom ?? '—'}
            </div>
            <h3>{row.player.displayName}</h3>
            <dl>
              <div>
                <dt>Michigan seasons</dt>
                <dd>{row.seasons.length}</dd>
              </div>
              <div>
                <dt>Offense</dt>
                <dd>{row.grades.offense.weightedGrade ?? '—'}</dd>
              </div>
              <div>
                <dt>Defense</dt>
                <dd>{row.grades.defense.weightedGrade ?? '—'}</dd>
              </div>
              <div>
                <dt>Special teams</dt>
                <dd>{row.grades.specialTeams.weightedGrade ?? '—'}</dd>
              </div>
              <div>
                <dt>NFL seasons</dt>
                <dd>{row.nfl.length}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </ModalFrame>
  )
}

function PlayerQuickView({
  playerId,
  onClose,
}: {
  playerId: Id<'players'>
  onClose: () => void
}) {
  const result = useQuery(convexQuery(api.players.getProfile, { playerId }))
  const profile: Profile | undefined = result.data ?? undefined
  return (
    <ModalFrame label="Player quick view" onClose={onClose} sideSheet>
      {!profile ? (
        <div className="sheet-loading">Building player timeline…</div>
      ) : (
        <>
          <div className="sheet-kicker">Michigan player file</div>
          <h2>{profile.player.displayName}</h2>
          <p className="sheet-summary">
            {titleCase(profile.player.entryMethod)} entry ·{' '}
            {profile.player.entrySeason} · {titleCase(profile.player.state)}
          </p>
          <div className="sheet-metrics">
            <SheetMetric label="Seasons" value={profile.seasons.length} />
            <SheetMetric
              label="Starts"
              value={profile.seasons.reduce((sum, row) => sum + row.starts, 0)}
            />
            <SheetMetric
              label="Games"
              value={profile.seasons.reduce(
                (sum, row) => sum + row.gamesPlayed,
                0,
              )}
            />
          </div>
          <section className="sheet-section">
            <div className="sheet-section__heading">
              <h3>Michigan timeline</h3>
              <span>{profile.stints.length} stint records</span>
            </div>
            <div className="player-timeline">
              {profile.seasons.map((row) => (
                <div key={row._id}>
                  <b>{row.season}</b>
                  <span>
                    {row.listedPosition} · {titleCase(row.role)} ·{' '}
                    {row.gamesPlayed} GP / {row.starts} starts
                  </span>
                  <small>
                    Eligible through {row.eligibility.eligibleThroughSeason}
                  </small>
                </div>
              ))}
            </div>
          </section>
          <section className="sheet-section">
            <div className="sheet-section__heading">
              <h3>DbyD Player Grades</h3>
              <span>Career weighted</span>
            </div>
            <div className="grade-band">
              <SheetMetric
                label="Offense"
                value={profile.grades.offense.weightedGrade ?? '—'}
              />
              <SheetMetric
                label="Defense"
                value={profile.grades.defense.weightedGrade ?? '—'}
              />
              <SheetMetric
                label="Special teams"
                value={profile.grades.specialTeams.weightedGrade ?? '—'}
              />
            </div>
          </section>
          <section className="sheet-section">
            <div className="sheet-section__heading">
              <h3>Outcomes</h3>
              <span>{profile.evaluations.length} evaluations</span>
            </div>
            <p className="sheet-summary">
              {profile.draft.length > 0
                ? profile.draft
                    .map(
                      (row) =>
                        `${row.year} ${titleCase(row.status)}${row.team ? ` · ${row.team}` : ''}`,
                    )
                    .join(' · ')
                : 'No draft outcome recorded.'}
            </p>
          </section>
        </>
      )}
    </ModalFrame>
  )
}

function ModalFrame({
  children,
  label,
  onClose,
  sideSheet = false,
}: {
  children: ReactNode
  label: string
  onClose: () => void
  sideSheet?: boolean
}) {
  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className={`prototype-modal ${sideSheet ? 'prototype-modal--side' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section className="prototype-modal__panel">
        <button
          type="button"
          className="prototype-modal__close"
          onClick={onClose}
          aria-label={`Close ${label}`}
        >
          ×
        </button>
        {children}
      </section>
    </div>
  )
}

function SheetMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

export function RosterPrototypeLoading() {
  return (
    <main className="prototype-state" aria-live="polite">
      <div className="prototype-state__line" />
      <div className="prototype-state__line" />
      <div className="prototype-state__line" />
      <p>Loading Michigan personnel intelligence…</p>
    </main>
  )
}

export function RosterPrototypeError() {
  return (
    <div className="roster-prototype">
      <PrototypeErrorPanel />
    </div>
  )
}

function PrototypeErrorPanel() {
  return (
    <main className="prototype-state prototype-state--error">
      <span>Connection exception</span>
      <h1>The roster intelligence layer could not be loaded.</h1>
      <p>
        Check the Convex connection. DbyD CFB will not replace retained data
        with a fabricated empty roster.
      </p>
    </main>
  )
}

function readVariant(): Variant {
  if (typeof window === 'undefined') return 'A'
  const value = new URLSearchParams(window.location.search)
    .get('variant')
    ?.toUpperCase()
  return value === 'B' || value === 'C' ? value : 'A'
}

function readSeason() {
  if (typeof window === 'undefined') return CURRENT_SEASON
  const value = Number(
    new URLSearchParams(window.location.search).get('season'),
  )
  return SEASONS.includes(value) ? value : CURRENT_SEASON
}

function writeSearchParams(values: Record<string, string>) {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  Object.entries(values).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  )
  window.history.replaceState({}, '', url)
}
