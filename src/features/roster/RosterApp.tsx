import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { SeasonStats } from './SeasonStats'
import { useMichiganRoster } from './useMichiganRoster'
import type { EnrichedPlayer, PlayerProfile } from './useMichiganRoster'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

type View = 'depth' | 'recruiting' | 'draft' | 'positions' | 'snaps' | 'players'
type DepthView = 'offense' | 'defense' | 'special-teams'
type EligibilityBand = 'developing' | 'nfl-eligible' | 'final'

const CURRENT_ROSTER_SEASON = 2026

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

type DepthRoomId =
  'QB' | 'HB' | 'WR' | 'OL' | 'IDL' | 'EDGE' | 'LB' | 'DB' | 'K' | 'P' | 'LS'

type StarterSlot = {
  id: string
  label: string
  position: string
  order: number
}

type RotationGroup = {
  id: DepthRoomId
  label: string
  note: string
  allocations: Array<{ positions: Array<string>; count: number }>
}

type DepthRoom = {
  id: DepthRoomId
  unit: DepthView
  label: string
  note: string
}

const depthRooms: Array<DepthRoom> = [
  { id: 'QB', unit: 'offense', label: 'Quarterbacks', note: 'QB' },
  { id: 'HB', unit: 'offense', label: 'Backfield', note: 'RB · HB · FB' },
  {
    id: 'WR',
    unit: 'offense',
    label: 'Receivers and tight ends',
    note: 'WR · SLOT · TE',
  },
  {
    id: 'OL',
    unit: 'offense',
    label: 'Offensive line',
    note: 'OT · OG · OC',
  },
  {
    id: 'IDL',
    unit: 'defense',
    label: 'Interior defensive line',
    note: 'DL · DT · NT',
  },
  { id: 'EDGE', unit: 'defense', label: 'Edge', note: 'EDGE · DE' },
  { id: 'LB', unit: 'defense', label: 'Linebackers', note: 'LB · ILB · OLB' },
  {
    id: 'DB',
    unit: 'defense',
    label: 'Defensive backs',
    note: 'CB · NICKEL · S',
  },
  { id: 'K', unit: 'special-teams', label: 'Kickers', note: 'K' },
  { id: 'P', unit: 'special-teams', label: 'Punters', note: 'P' },
  {
    id: 'LS',
    unit: 'special-teams',
    label: 'Long snappers',
    note: 'LS',
  },
]

const starterUnits: Array<{
  id: 'offense' | 'defense'
  label: string
  personnel: string
  slots: Array<StarterSlot>
}> = [
  {
    id: 'offense',
    label: 'Offense',
    personnel: '11 personnel',
    slots: [
      {
        id: 'wr-left',
        label: 'WR',
        position: 'WR',
        order: 1,
      },
      {
        id: 'slot',
        label: 'SLOT',
        position: 'SLOT',
        order: 1,
      },
      {
        id: 'te',
        label: 'TE',
        position: 'TE',
        order: 1,
      },
      {
        id: 'wr-right',
        label: 'WR',
        position: 'WR',
        order: 2,
      },
      {
        id: 'left-tackle',
        label: 'OT',
        position: 'OT',
        order: 1,
      },
      {
        id: 'left-guard',
        label: 'OG',
        position: 'OG',
        order: 1,
      },
      {
        id: 'center',
        label: 'OC',
        position: 'OC',
        order: 1,
      },
      {
        id: 'right-guard',
        label: 'OG',
        position: 'OG',
        order: 2,
      },
      {
        id: 'right-tackle',
        label: 'OT',
        position: 'OT',
        order: 2,
      },
      {
        id: 'quarterback',
        label: 'QB',
        position: 'QB',
        order: 1,
      },
      {
        id: 'halfback',
        label: 'HB',
        position: 'RB',
        order: 1,
      },
    ],
  },
  {
    id: 'defense',
    label: 'Defense',
    personnel: 'Base front',
    slots: [
      {
        id: 'edge-left',
        label: 'EDGE',
        position: 'EDGE',
        order: 1,
      },
      {
        id: 'idl-left',
        label: 'IDL',
        position: 'DL',
        order: 1,
      },
      {
        id: 'idl-right',
        label: 'IDL',
        position: 'DL',
        order: 2,
      },
      {
        id: 'edge-right',
        label: 'EDGE',
        position: 'EDGE',
        order: 2,
      },
      {
        id: 'linebacker-left',
        label: 'LB',
        position: 'LB',
        order: 1,
      },
      {
        id: 'linebacker-right',
        label: 'LB',
        position: 'LB',
        order: 2,
      },
      {
        id: 'corner-left',
        label: 'CB',
        position: 'CB',
        order: 1,
      },
      {
        id: 'safety-left',
        label: 'S',
        position: 'S',
        order: 1,
      },
      {
        id: 'nickel',
        label: 'CB',
        position: 'CB',
        order: 3,
      },
      {
        id: 'safety-right',
        label: 'S',
        position: 'S',
        order: 2,
      },
      {
        id: 'corner-right',
        label: 'CB',
        position: 'CB',
        order: 2,
      },
    ],
  },
]

const specialistSlots: Array<StarterSlot> = [
  { id: 'kicker', label: 'K', position: 'K', order: 1 },
  { id: 'punter', label: 'P', position: 'P', order: 1 },
  {
    id: 'long-snapper',
    label: 'LS',
    position: 'LS',
    order: 1,
  },
]

const rotationGroups: Array<RotationGroup> = [
  {
    id: 'QB',
    label: 'Quarterback',
    note: 'QB',
    allocations: [{ positions: ['QB'], count: 1 }],
  },
  {
    id: 'HB',
    label: 'Backfield',
    note: 'HB · FB',
    allocations: [
      { positions: ['RB', 'HB'], count: 1 },
      { positions: ['FB'], count: 1 },
    ],
  },
  {
    id: 'WR',
    label: 'Receivers',
    note: 'WR · SLOT · TE',
    allocations: [
      { positions: ['WR', 'SLOT'], count: 3 },
      { positions: ['TE'], count: 2 },
    ],
  },
  {
    id: 'OL',
    label: 'Offensive line',
    note: 'OT · OG · OC',
    allocations: [
      { positions: ['OT', 'LT', 'RT'], count: 1 },
      { positions: ['OG', 'LG', 'RG'], count: 1 },
    ],
  },
  {
    id: 'IDL',
    label: 'Interior defensive line',
    note: 'IDL',
    allocations: [{ positions: ['DL', 'DT', 'NT', 'IDL'], count: 3 }],
  },
  {
    id: 'EDGE',
    label: 'Edge',
    note: 'EDGE',
    allocations: [{ positions: ['EDGE', 'DE', 'SDE', 'WDE'], count: 2 }],
  },
  {
    id: 'LB',
    label: 'Linebackers',
    note: 'LB',
    allocations: [{ positions: ['LB', 'ILB', 'OLB'], count: 2 }],
  },
  {
    id: 'DB',
    label: 'Defensive backs',
    note: 'CB · S',
    allocations: [
      { positions: ['CB', 'NICKEL'], count: 1 },
      { positions: ['S'], count: 1 },
    ],
  },
  {
    id: 'K',
    label: 'Kickers',
    note: 'K',
    allocations: [{ positions: ['K'], count: 1 }],
  },
  {
    id: 'P',
    label: 'Punters',
    note: 'P',
    allocations: [{ positions: ['P'], count: 1 }],
  },
  {
    id: 'LS',
    label: 'Long snappers',
    note: 'LS',
    allocations: [{ positions: ['LS'], count: 1 }],
  },
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
        className="min-h-screen bg-michigan-cream text-michigan-blue"
        inert={selected ? true : undefined}
      >
        <header className="border-b-4 border-michigan-maize bg-michigan-blue text-white">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <div className="grid h-8 w-9 shrink-0 place-items-center border-2 border-michigan-maize bg-michigan-maize font-serif text-lg font-black text-michigan-blue [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)] sm:h-9 sm:w-10 sm:text-xl">
                M
              </div>
              <div>
                <p className="hidden text-[10px] font-bold uppercase tracking-[0.18em] text-michigan-maize sm:block">
                  Michigan football
                </p>
                <h1 className="truncate text-xs font-black sm:text-base">
                  Personnel archive
                </h1>
              </div>
            </div>
            <dl className="grid grid-cols-3 divide-x divide-white/25">
              <Stat value={activeCount} label="Current" />
              <Stat
                value={rosterIsComplete ? players.length : `${players.length}+`}
                label="Players"
              />
              <Stat
                value={isHydrating ? `${draftCount}+` : draftCount}
                label="NFL"
              />
            </dl>
          </div>
        </header>

        <div className="sticky top-0 z-30 border-b border-michigan-blue/20 bg-michigan-cream/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1500px] flex-col gap-1.5 px-4 py-1.5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <nav
              aria-label="Roster views"
              className="scrollbar-none -mx-1 overflow-x-auto"
            >
              <div className="flex min-w-max gap-1 px-1">
                {views.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setView(item.id)}
                    aria-current={view === item.id ? 'page' : undefined}
                    className={`border-b-2 px-2 py-1 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue ${
                      view === item.id
                        ? 'border-michigan-maize text-michigan-blue'
                        : 'border-transparent text-neutral-500 hover:border-michigan-maize-soft hover:text-michigan-blue'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
                <Link
                  to="/games"
                  className="border-b-2 border-transparent px-2 py-1 text-sm font-bold text-neutral-500 transition hover:border-michigan-maize hover:text-michigan-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
                >
                  National games
                </Link>
                <Link
                  to="/admin/roster"
                  className="border-b-2 border-transparent px-2 py-1 text-sm font-bold text-neutral-500 transition hover:border-michigan-maize hover:text-michigan-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
                >
                  Roster admin
                </Link>
              </div>
            </nav>
            <label className="relative block w-full lg:w-64">
              <span className="sr-only">Search players</span>
              <SearchIcon />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, school, class…"
                className="w-full border border-michigan-blue/25 bg-white py-1 pl-9 pr-3 text-sm outline-none transition placeholder:text-neutral-400 focus:border-michigan-blue focus:ring-2 focus:ring-michigan-maize"
              />
            </label>
          </div>
        </div>

        <section className="mx-auto max-w-[1500px] px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          {rosterLoadFailed && (
            <div className="mb-4 flex flex-col gap-2 border-y border-neutral-300 py-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold">
                  Some departed players could not load.
                </p>
                <p className="text-xs text-neutral-500">
                  Historical totals may be incomplete.
                </p>
              </div>
              <button
                type="button"
                onClick={retryRoster}
                className="border border-neutral-950 px-3 py-1 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
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
                <DepthChart
                  players={players}
                  visiblePlayers={visiblePlayers}
                  select={setSelected}
                />
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
    <div className="flex flex-col px-1 text-center sm:px-4">
      <dt className="order-2 text-[9px] font-bold uppercase tracking-[0.1em] text-michigan-maize">
        {label}
      </dt>
      <dd className="order-1 text-xs font-black tabular-nums sm:text-base">
        {value}
      </dd>
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
    <div className="mb-4 flex flex-col gap-2 border-y border-neutral-200 py-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-michigan-maize" />
        <div>
          <p className="text-sm font-bold">
            {!rosterComplete
              ? 'Loading player history'
              : failed
                ? `${failed} profiles failed`
                : 'Loading player details'}
          </p>
          <p className="text-xs text-neutral-500">
            {loaded} of {total} profiles
          </p>
        </div>
      </div>
      {failed && rosterComplete ? (
        <button
          type="button"
          onClick={retry}
          className="border border-neutral-950 px-3 py-1 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          Retry missing profiles
        </button>
      ) : (
        <div className="h-1 w-full overflow-hidden bg-michigan-blue-soft sm:w-40">
          <div
            className={`h-full bg-michigan-blue transition-[width] ${rosterComplete ? '' : 'animate-pulse'}`}
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
    <div className="mb-3 max-w-3xl border-b border-michigan-blue/20 pb-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <h2 className="text-xl font-black tracking-[-0.02em] text-michigan-blue sm:text-2xl">
          {title}
        </h2>
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-michigan-blue">
          {eyebrow}
        </p>
      </div>
      <p className="mt-0.5 text-sm leading-5 text-neutral-500">{children}</p>
    </div>
  )
}

function DepthChart({
  players,
  visiblePlayers,
  select,
}: {
  players: Array<EnrichedPlayer>
  visiblePlayers: Array<EnrichedPlayer>
  select: (player: EnrichedPlayer) => void
}) {
  const [depthView, setDepthView] = useState<DepthView>('offense')
  const active = players.filter((entry) => entry.stint.status === 'active')
  const visibleIds = new Set(
    visiblePlayers
      .filter((entry) => entry.stint.status === 'active')
      .map((entry) => entry.player._id),
  )
  const starterAssignments = starterUnits.flatMap((unit) =>
    unit.slots.flatMap((slot) => {
      const entry = findDepthPlayer(active, slot.position, slot.order)
      return entry ? [{ entry, slot }] : []
    }),
  )
  const specialistAssignments = specialistSlots.flatMap((slot) => {
    const entry = findDepthPlayer(active, slot.position, slot.order)
    return entry ? [{ entry, slot }] : []
  })
  const firstUnitAssignments = [...starterAssignments, ...specialistAssignments]
  const starterIds = new Set(
    firstUnitAssignments.map(({ entry }) => entry.player._id),
  )
  const rotations = buildRotationGroups(active, starterIds)
  const rotationIds = new Set(
    rotations.flatMap((group) =>
      group.entries.map((entry) => entry.player._id),
    ),
  )
  const tieredPlayers = active
    .filter((entry) => visibleIds.has(entry.player._id))
    .sort(compareDepthPlayers)
    .map((entry) => ({
      entry,
      tier: effectiveDepthTier(entry, starterIds, rotationIds),
    }))
  const hasVisibleActive = visibleIds.size > 0
  const rooms = depthRooms.map((room) => ({
    ...room,
    starters: tieredPlayers.filter(
      ({ entry, tier }) =>
        tier === 'starters' && depthRoom(entry.stint.position) === room.id,
    ),
    rotation: tieredPlayers.filter(
      ({ entry, tier }) =>
        tier === 'rotation' && depthRoom(entry.stint.position) === room.id,
    ),
    depth: tieredPlayers.filter(
      ({ entry, tier }) =>
        tier === 'depth' && depthRoom(entry.stint.position) === room.id,
    ),
    prospects: tieredPlayers.filter(
      ({ entry, tier }) =>
        tier === 'prospects' && depthRoom(entry.stint.position) === room.id,
    ),
    walkOns: tieredPlayers.filter(
      ({ entry, tier }) =>
        tier === 'walk-ons' && depthRoom(entry.stint.position) === room.id,
    ),
  }))
  const depthTabs: Array<{ id: DepthView; label: string; count: number }> = [
    {
      id: 'offense',
      label: 'Offense',
      count: countDepthPlayers(rooms.filter((room) => room.unit === 'offense')),
    },
    {
      id: 'defense',
      label: 'Defense',
      count: countDepthPlayers(rooms.filter((room) => room.unit === 'defense')),
    },
    {
      id: 'special-teams',
      label: 'Special Teams',
      count: countDepthPlayers(
        rooms.filter((room) => room.unit === 'special-teams'),
      ),
    },
  ]

  return (
    <>
      <SectionIntro eyebrow="2026 roster" title="Depth chart & rotation">
        Position rooms sit side by side, with one continuous player list in each
        room. Prospects are in their first two seasons after high school; older
        scholarship players outside the rotation sit in depth. These are roster
        tiers, not official starts or snap projections.
      </SectionIntro>
      {!hasVisibleActive ? (
        <HydratingEmpty label="No active players match this search." />
      ) : (
        <div>
          <nav
            aria-label="Depth chart units"
            className="scrollbar-none -mx-1 mb-5 overflow-x-auto border-b border-michigan-blue/20"
          >
            <div
              role="tablist"
              aria-label="Depth chart units"
              className="flex min-w-max gap-1 px-1"
            >
              {depthTabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`depth-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  onClick={() => setDepthView(tab.id)}
                  onKeyDown={(event) =>
                    handleDepthTabKeyDown(
                      event,
                      tab.id,
                      depthTabs,
                      setDepthView,
                    )
                  }
                  aria-controls={`depth-panel-${tab.id}`}
                  aria-selected={depthView === tab.id}
                  tabIndex={depthView === tab.id ? 0 : -1}
                  className={`flex items-center gap-2 border-b-4 px-3 py-2 text-sm font-black transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-michigan-blue ${
                    depthView === tab.id
                      ? 'border-michigan-maize bg-michigan-blue text-white'
                      : 'border-transparent text-neutral-500 hover:border-michigan-maize-soft hover:text-michigan-blue'
                  }`}
                >
                  {tab.label}
                  <span
                    className={`text-[10px] tabular-nums ${depthView === tab.id ? 'text-michigan-maize' : 'text-neutral-400'}`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </nav>

          {depthTabs.map((tab) => (
            <section
              key={tab.id}
              id={`depth-panel-${tab.id}`}
              role="tabpanel"
              aria-labelledby={`depth-tab-${tab.id}`}
              hidden={depthView !== tab.id}
            >
              <DepthUnitPanel
                label={tab.label}
                rooms={rooms.filter((room) => room.unit === tab.id)}
                select={select}
              />
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function handleDepthTabKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  current: DepthView,
  tabs: Array<{ id: DepthView }>,
  select: (tab: DepthView) => void,
) {
  const currentIndex = tabs.findIndex((tab) => tab.id === current)
  const lastIndex = tabs.length - 1
  const nextIndex =
    event.key === 'ArrowRight'
      ? currentIndex === lastIndex
        ? 0
        : currentIndex + 1
      : event.key === 'ArrowLeft'
        ? currentIndex === 0
          ? lastIndex
          : currentIndex - 1
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? lastIndex
            : undefined

  if (nextIndex === undefined) return

  event.preventDefault()
  const next = tabs[nextIndex]
  select(next.id)
  event.currentTarget.parentElement
    ?.querySelector<HTMLButtonElement>(`#depth-tab-${next.id}`)
    ?.focus()
}

type DepthTierEntry = {
  entry: EnrichedPlayer
}

type DepthTierTone =
  'starters' | 'rotation' | 'depth' | 'prospects' | 'walk-ons'

type PreparedDepthRoom = DepthRoom & {
  starters: Array<DepthTierEntry>
  rotation: Array<DepthTierEntry>
  depth: Array<DepthTierEntry>
  prospects: Array<DepthTierEntry>
  walkOns: Array<DepthTierEntry>
}

function DepthUnitPanel({
  label,
  rooms,
  select,
}: {
  label: string
  rooms: Array<PreparedDepthRoom>
  select: (player: EnrichedPlayer) => void
}) {
  const count = countDepthPlayers(rooms)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b-2 border-michigan-blue pb-1.5">
        <h3 className="text-lg font-black tracking-[-0.02em]">
          {label} depth chart
        </h3>
        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500">
          {count} {count === 1 ? 'player' : 'players'} · {rooms.length} position
          rooms
        </p>
      </div>
      {count === 0 ? (
        <HydratingEmpty
          label={`No ${label.toLowerCase()} players match this search.`}
        />
      ) : (
        <div>
          <EligibilityLegend />
          <div className="grid items-start gap-x-6 gap-y-8 xl:grid-cols-2">
            {rooms.map((room) => (
              <DepthPositionTable key={room.id} room={room} select={select} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function EligibilityLegend() {
  const bands = [
    { label: 'Green · years 1–2', tone: 'border-emerald-200 bg-emerald-50' },
    { label: 'Yellow · year 3+', tone: 'border-amber-200 bg-amber-50' },
    { label: 'Red · final year', tone: 'border-red-200 bg-red-50' },
  ]

  return (
    <ul
      aria-label="Eligibility row color key"
      className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-bold text-neutral-600"
    >
      <li className="uppercase tracking-[0.1em] text-neutral-500">
        Player rows
      </li>
      {bands.map((band) => (
        <li key={band.label} className="flex items-center gap-1.5">
          <span className={`h-3 w-3 border ${band.tone}`} aria-hidden="true" />
          {band.label}
        </li>
      ))}
    </ul>
  )
}

function DepthPositionTable({
  room,
  select,
}: {
  room: PreparedDepthRoom
  select: (player: EnrichedPlayer) => void
}) {
  const count = countDepthPlayers([room])
  const tiers: Array<{
    title: string
    tone: DepthTierTone
    entries: Array<DepthTierEntry>
  }> = [
    { title: 'Starters', tone: 'starters', entries: room.starters },
    { title: 'Rotation', tone: 'rotation', entries: room.rotation },
    { title: 'Depth', tone: 'depth', entries: room.depth },
    { title: 'Prospects', tone: 'prospects', entries: room.prospects },
    { title: 'Walk-ons', tone: 'walk-ons', entries: room.walkOns },
  ]

  return (
    <section className="min-w-0" aria-labelledby={`depth-room-${room.id}`}>
      <div className="flex min-h-10 items-baseline justify-between gap-3 border-b-2 border-neutral-800 bg-neutral-100 px-3 py-2">
        <h4 id={`depth-room-${room.id}`}>
          <span className="font-black">{room.label}</span>
          <span className="ml-2 text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500">
            {room.note}
          </span>
        </h4>
        <span className="text-xs font-black tabular-nums">{count}</span>
      </div>
      <div className="overflow-x-auto border-b border-neutral-300 bg-white">
        <table className="w-full min-w-[340px] border-collapse text-left">
          <caption className="sr-only">
            {room.label} players grouped by depth tier
          </caption>
          <thead className="bg-neutral-900 text-[9px] uppercase tracking-[0.12em] text-white">
            <tr>
              <th scope="col" className="w-28 px-3 py-2 font-black">
                Tier
              </th>
              <th scope="col" className="w-14 px-2 py-2 text-center font-black">
                No.
              </th>
              <th scope="col" className="px-3 py-2 font-black">
                Player
              </th>
              <th scope="col" className="w-12 px-2 py-2 font-black">
                Pos
              </th>
            </tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <DepthTierRows
                key={tier.title}
                title={tier.title}
                tone={tier.tone}
                entries={tier.entries}
                select={select}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function DepthTierRows({
  title,
  tone,
  entries,
  select,
}: {
  title: string
  tone: DepthTierTone
  entries: Array<DepthTierEntry>
  select: (player: EnrichedPlayer) => void
}) {
  if (entries.length === 0) {
    return (
      <tr className={`border-t-4 bg-white ${depthTierSeparatorClass(tone)}`}>
        <th
          scope="row"
          className={`border-r-4 px-3 py-3 align-top text-[10px] font-black uppercase tracking-[0.1em] ${depthTierLabelClass(tone)}`}
        >
          <span className="block">{title}</span>
          <span className="mt-1.5 inline-flex border border-current/20 px-1.5 py-0.5 text-[9px] leading-none tabular-nums opacity-70">
            0 players
          </span>
        </th>
        <td colSpan={3} className="px-3 py-3 text-xs text-neutral-400">
          No players in this group.
        </td>
      </tr>
    )
  }

  return (
    <>
      {entries.map(({ entry }, index) => {
        const eligibility = getEligibilityDisplay(entry)

        return (
          <tr
            key={entry.player._id}
            className={`${
              index === 0
                ? `border-t-4 ${depthTierSeparatorClass(tone)}`
                : 'border-t border-neutral-100'
            } ${eligibilityRowClass(eligibility.band)}`}
          >
            {index === 0 && (
              <th
                rowSpan={entries.length}
                scope="rowgroup"
                className={`border-r-4 px-3 py-3 align-top text-[10px] font-black uppercase tracking-[0.1em] ${depthTierLabelClass(tone)}`}
              >
                <span className="block">{title}</span>
                <span className="mt-1.5 inline-flex border border-current/20 px-1.5 py-0.5 text-[9px] leading-none tabular-nums opacity-70">
                  {entries.length} {entries.length === 1 ? 'player' : 'players'}
                </span>
              </th>
            )}
            <td
              className="px-2 py-2 text-center text-lg font-black tabular-nums text-neutral-950"
              aria-label={
                entry.stint.jerseyNumber === undefined
                  ? 'No jersey number'
                  : `Jersey number ${entry.stint.jerseyNumber}`
              }
            >
              {jersey(entry.stint.jerseyNumber)}
            </td>
            <td className="px-3 py-1.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <button
                  type="button"
                  onClick={() => select(entry)}
                  className="min-w-0 text-left text-sm font-bold transition hover:text-michigan-blue focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
                >
                  {entry.player.displayName}
                  <span className="sr-only">
                    , {eligibility.label}, roster year {eligibility.year}
                  </span>
                </button>
                <RecruitingYear
                  season={entry.profile?.recruiting?.recruitingSeason}
                />
                {entry.stint.injury && (
                  <InjuryIndicator injury={entry.stint.injury} />
                )}
              </div>
            </td>
            <td className="px-2 py-2 text-xs font-medium text-neutral-700">
              {entry.stint.position}
            </td>
          </tr>
        )
      })}
    </>
  )
}

function depthTierLabelClass(tone: DepthTierTone) {
  switch (tone) {
    case 'starters':
      return 'border-neutral-950 bg-neutral-900 text-white'
    case 'rotation':
      return 'border-neutral-700 bg-neutral-200 text-neutral-950'
    case 'depth':
      return 'border-neutral-500 bg-neutral-100 text-neutral-900'
    case 'prospects':
      return 'border-neutral-400 bg-neutral-50 text-neutral-800'
    case 'walk-ons':
      return 'border-neutral-400 bg-neutral-100 text-neutral-700'
  }
}

function depthTierSeparatorClass(tone: DepthTierTone) {
  switch (tone) {
    case 'starters':
      return 'border-neutral-950'
    case 'rotation':
      return 'border-neutral-700'
    case 'depth':
      return 'border-neutral-500'
    case 'prospects':
      return 'border-neutral-400'
    case 'walk-ons':
      return 'border-neutral-300'
  }
}

function InjuryIndicator({
  injury,
}: {
  injury: NonNullable<EnrichedPlayer['stint']['injury']>
}) {
  const indicator = injuryIndicator(injury.kind)
  const title = [
    indicator.label,
    injury.note,
    injury.expectedReturn && `Expected return: ${injury.expectedReturn}`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <span
      role="img"
      aria-label={indicator.label}
      className={`inline-flex shrink-0 items-center text-sm font-black leading-none ${indicator.className}`}
      title={title}
    >
      <span aria-hidden="true" className="tracking-[-0.12em]">
        {'✚'.repeat(indicator.crosses)}
      </span>
    </span>
  )
}

function countDepthPlayers(rooms: Array<PreparedDepthRoom>) {
  return rooms.reduce(
    (total, room) =>
      total +
      room.starters.length +
      room.rotation.length +
      room.depth.length +
      room.prospects.length +
      room.walkOns.length,
    0,
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
      <SectionIntro eyebrow="Prospect year" title="Recruit classes">
        Original class year; transfers and walk-ons may arrive later.
      </SectionIntro>
      <FilterChips
        values={seasons}
        selected={season}
        setSelected={setSeason}
        allLabel="All classes"
      />
      <div className="space-y-4">
        {groups.map(([year, entries]) => (
          <article key={year} className="border-t border-neutral-300 pt-2">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
              <h3 className="text-2xl font-black">{year}</h3>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                {entries.length} players · {sourceSummary(entries)}
              </p>
            </div>
            <div className="grid border-t border-neutral-200 sm:grid-cols-2 sm:gap-x-5 xl:grid-cols-3">
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
      <SectionIntro eyebrow="NFL entry" title="Draft classes">
        Draft picks and undrafted free agents by year.
      </SectionIntro>
      {groups.length === 0 ? (
        <HydratingEmpty label="Draft outcomes are still loading." />
      ) : (
        <div className="space-y-4">
          {groups.map(([year, entries]) => (
            <article key={year} className="border-t border-neutral-300 pt-2">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-2xl font-black">{year}</h3>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-500">
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
              <div className="divide-y divide-neutral-100 border-t border-neutral-200">
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
                        className="grid w-full grid-cols-[3.25rem_1fr_auto] items-center gap-2 py-2 text-left transition hover:bg-michigan-blue-soft focus-visible:bg-michigan-maize-soft focus-visible:outline-none sm:grid-cols-[4.5rem_1fr_7rem_7rem]"
                      >
                        <span className="text-base font-black">
                          {draft.status === 'drafted'
                            ? `#${draft.overallPick}`
                            : 'UDFA'}
                        </span>
                        <span>
                          <span className="block font-bold">
                            {entry.player.displayName}
                          </span>
                          <span className="text-xs text-neutral-500">
                            {entry.stint.position} · Michigan{' '}
                            {entry.stint.startSeason}–
                            {entry.stint.endSeason ?? 'present'}
                          </span>
                        </span>
                        <span className="hidden text-sm text-neutral-500 sm:block">
                          {draft.status === 'drafted'
                            ? `Round ${draft.round}`
                            : 'Free agent'}
                        </span>
                        <span className="text-right text-xs font-black">
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
      <SectionIntro eyebrow="Recorded labels" title="Players by position">
        Historical position labels are preserved.
      </SectionIntro>
      <div className="grid items-start border-t border-neutral-300 md:grid-cols-2 md:gap-x-6 xl:grid-cols-3">
        {groups.map(([position, entries], index) => (
          <details
            key={position}
            open={index < 6}
            className="group border-b border-neutral-300"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between py-2 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-neutral-950 [&::-webkit-details-marker]:hidden">
              <span className="flex items-baseline gap-2">
                <span className="text-lg font-black">{position}</span>
                <span className="text-xs text-neutral-500">
                  {entries.length} players
                </span>
              </span>
              <ChevronIcon />
            </summary>
            <div className="divide-y divide-neutral-100 border-t border-neutral-200">
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
                    className="flex w-full items-center justify-between py-2 text-left transition hover:bg-michigan-blue-soft focus-visible:bg-michigan-maize-soft focus-visible:outline-none"
                  >
                    <span>
                      <span className="block text-sm font-bold">
                        {entry.player.displayName}
                      </span>
                      <span className="text-xs text-neutral-500">
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
      <SectionIntro eyebrow="Full archive" title="All players">
        Recruiting, roster, production, movement and NFL history.
      </SectionIntro>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(['all', 'active', 'committed', 'departed'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setStatus(value)}
            className={`border px-3 py-1 text-xs font-bold capitalize transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950 ${
              status === value
                ? 'border-michigan-blue bg-michigan-blue text-white'
                : 'border-michigan-blue/25 text-neutral-600 hover:border-michigan-blue hover:bg-michigan-maize-soft hover:text-michigan-blue'
            }`}
          >
            {value} ·{' '}
            {value === 'all'
              ? players.length
              : players.filter((entry) => entry.stint.status === value).length}
          </button>
        ))}
      </div>
      <div className="overflow-hidden border-y border-neutral-300">
        <div className="hidden grid-cols-[2fr_0.65fr_0.65fr_0.8fr_0.8fr] gap-3 border-b border-michigan-blue/25 bg-michigan-blue-soft px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-michigan-blue md:grid">
          <span>Player</span>
          <span>Position</span>
          <span>Arrived</span>
          <span>Recruit class</span>
          <span>Status</span>
        </div>
        <div className="divide-y divide-neutral-100">
          {filtered.map((entry) => (
            <button
              key={entry.player._id}
              type="button"
              onClick={() => select(entry)}
              className="grid w-full grid-cols-[1fr_auto] items-start gap-x-3 px-2 py-1.5 text-left transition hover:bg-michigan-blue-soft focus-visible:bg-michigan-maize-soft focus-visible:outline-none md:grid-cols-[2fr_0.65fr_0.65fr_0.8fr_0.8fr] md:items-center md:gap-3 md:px-3 md:py-2"
            >
              <span className="min-w-0">
                <span className="block truncate font-bold leading-5">
                  {entry.player.displayName}
                </span>
                <span className="block truncate text-xs leading-4 text-neutral-500">
                  {entry.player.hometown}, {entry.player.homeState} ·{' '}
                  {entry.player.highSchool}
                </span>
                <span className="block truncate text-xs leading-4 text-neutral-500 md:hidden">
                  {entry.stint.position} · {entry.stint.startSeason} · class{' '}
                  {entry.profile?.recruiting?.recruitingSeason ?? '…'}
                </span>
              </span>
              <span className="hidden text-sm font-bold md:block">
                {entry.stint.position}
              </span>
              <span className="hidden text-sm text-neutral-500 md:block">
                {entry.stint.startSeason}
              </span>
              <span className="hidden text-sm text-neutral-500 md:block">
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
      className="border-b border-neutral-200 py-2 text-left transition hover:bg-michigan-blue-soft focus-visible:bg-michigan-maize-soft focus-visible:outline-none"
    >
      <span className="block font-bold">{entry.player.displayName}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
        {meta}
      </span>
      <span className="mt-1 block text-xs text-neutral-500">{detail}</span>
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
  const draft = profile?.draft

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
      <button
        type="button"
        aria-label="Close player details"
        onClick={close}
        tabIndex={-1}
        className="absolute inset-0 bg-black/45"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-title"
        className="relative h-full w-full max-w-xl overflow-y-auto border-l-4 border-michigan-maize bg-michigan-cream"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-michigan-maize bg-michigan-blue px-4 py-2 text-white sm:px-5">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-michigan-maize">
            Player profile
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={close}
            className="grid h-8 w-8 place-items-center transition hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-maize"
            aria-label="Close player profile"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="border-b border-neutral-300 px-4 py-3 sm:px-5">
          <div className="flex items-start gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center border border-michigan-blue bg-michigan-maize text-lg font-black text-michigan-blue">
              {jersey(entry.stint.jerseyNumber)}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={entry.stint.status} />
              </div>
              <h2
                id="player-title"
                className="mt-1 text-2xl font-black leading-tight"
              >
                {entry.player.displayName}
              </h2>
              <p className="text-sm text-neutral-500">
                {entry.stint.position} · Michigan {entry.stint.startSeason}–
                {entry.stint.endSeason ?? 'present'}
              </p>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-5">
          <DetailSection title="Player info">
            <dl className="grid grid-cols-3 gap-x-3 gap-y-2.5">
              <Detail label="Pos" value={entry.stint.position} />
              <Detail
                label="Ht"
                value={formatHeight(entry.stint.heightInches)}
              />
              <Detail
                label="Wt"
                value={formatWeight(entry.stint.weightPounds)}
              />
              <Detail
                className="col-span-2"
                label="High school"
                value={entry.player.highSchool}
              />
              <Detail
                label="Location"
                value={`${entry.player.hometown}, ${entry.player.homeState}`}
              />
            </dl>
          </DetailSection>

          {entry.stint.injury && (
            <DetailSection title="Availability">
              <div className="border-l-4 border-neutral-800 bg-neutral-100 px-3 py-2">
                <InjuryIndicator injury={entry.stint.injury} />
                {entry.stint.injury.note && (
                  <p className="mt-1 text-sm text-neutral-700">
                    {entry.stint.injury.note}
                  </p>
                )}
                {entry.stint.injury.expectedReturn && (
                  <p className="mt-1 text-xs font-bold text-neutral-500">
                    Expected return: {entry.stint.injury.expectedReturn}
                  </p>
                )}
              </div>
            </DetailSection>
          )}

          {entry.stint.positionChanges &&
            entry.stint.positionChanges.length > 0 && (
              <DetailSection title="Position changes">
                <ol className="divide-y divide-neutral-200 border-y border-neutral-300">
                  {[...entry.stint.positionChanges].reverse().map((change) => (
                    <li key={change.recordedAt} className="py-2 text-sm">
                      <span className="font-black">
                        {change.fromPosition} → {change.toPosition}
                      </span>
                      <span className="ml-2 text-xs text-neutral-500">
                        {change.effectiveSeason}
                      </span>
                      {change.note && (
                        <p className="mt-0.5 text-xs text-neutral-600">
                          {change.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              </DetailSection>
            )}

          {!profile ? (
            <HydratingEmpty label="Full player details are loading…" />
          ) : (
            <>
              <DetailSection title="Recruiting">
                {recruiting ? (
                  <RecruitingSummary recruiting={recruiting} />
                ) : (
                  <p className="text-sm text-neutral-500">
                    No recruiting profile.
                  </p>
                )}
              </DetailSection>

              <DetailSection title="Michigan production">
                <SeasonHistory entry={entry} profile={profile} />
              </DetailSection>

              <DetailSection title="Movement timeline">
                <ol className="space-y-2">
                  {profile.movements.map((movement) => (
                    <li
                      key={movement._id}
                      className="grid grid-cols-[3rem_1fr] gap-2"
                    >
                      <span className="text-sm font-black text-neutral-500">
                        {movement.season}
                      </span>
                      <span className="text-sm font-semibold">
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
                  <p className="text-sm leading-5 text-neutral-500">
                    No NFL entry recorded.
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
      <p className="text-sm leading-5 text-neutral-500">
        Season data covers 2015–2025.
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
  const recordedStats = profile.seasonalStats
    .filter((stat) => stat.season >= firstSeason && stat.season <= finalSeason)
    .sort((a, b) => b.season - a.season)
  const totalGames = recordedStats.reduce(
    (total, stat) => total + stat.gamesPlayed,
    0,
  )
  const totalSnaps = recordedStats.reduce(
    (total, stat) => total + stat.snaps,
    0,
  )
  const peakGrade = recordedStats.reduce(
    (best, stat) => (stat.pffRating > best ? stat.pffRating : best),
    0,
  )

  return (
    <>
      <p className="border-l-2 border-michigan-maize pl-2 text-sm font-semibold leading-5">
        {careerNarrative(recordedStats)}
      </p>

      <dl className="mt-2 grid grid-cols-4 divide-x divide-neutral-200 border-y border-neutral-200">
        <ProductionMetric label="Seasons" value={recordedStats.length} />
        <ProductionMetric label="Games" value={totalGames} />
        <ProductionMetric label="Snaps" value={totalSnaps.toLocaleString()} />
        <ProductionMetric label="High grade" value={peakGrade.toFixed(1)} />
      </dl>

      <div className="mt-2 overflow-hidden border-y border-neutral-200">
        <div className="grid grid-cols-[0.75fr_0.65fr_0.5fr_0.75fr_0.7fr] gap-2 border-b border-michigan-blue/20 bg-michigan-blue-soft px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.1em] text-michigan-blue">
          <span>Year</span>
          <span>Pos</span>
          <span>GP</span>
          <span>Snaps</span>
          <span>Grade</span>
        </div>
        <div className="divide-y divide-neutral-100">
          {rows.map((season) => {
            const stat = statsBySeason.get(season)
            return (
              <div
                key={season}
                className="grid grid-cols-[0.75fr_0.65fr_0.5fr_0.75fr_0.7fr] items-center gap-2 px-2 py-1.5 text-sm"
              >
                <span className="font-black">{season}</span>
                <span className="font-bold">
                  {stat?.position ?? entry.stint.position}
                </span>
                <span className="font-semibold tabular-nums text-neutral-600">
                  {stat?.gamesPlayed ?? 0}
                </span>
                <span className="font-semibold tabular-nums text-neutral-600">
                  {(stat?.snaps ?? 0).toLocaleString()}
                </span>
                <span className="font-black tabular-nums">
                  {(stat?.pffRating ?? 0).toFixed(1)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
      <p className="mt-1.5 text-xs leading-4 text-neutral-500">
        Missing years count as zero games, snaps and grade.
      </p>
    </>
  )
}

function ProductionMetric({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex min-w-0 flex-col px-2 py-1.5">
      <dt className="order-2 truncate text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </dt>
      <dd className="order-1 truncate text-base font-black tabular-nums">
        {value}
      </dd>
    </div>
  )
}

function careerNarrative(stats: PlayerProfile['seasonalStats']) {
  if (stats.length === 0) return 'No recorded snaps through 2025.'

  const snapPeak = stats.reduce((leader, stat) =>
    stat.snaps > leader.snaps ? stat : leader,
  )
  const gradePeak = stats.reduce((leader, stat) =>
    stat.pffRating > leader.pffRating ? stat : leader,
  )

  if (snapPeak._id === gradePeak._id) {
    return `${snapPeak.season}: ${snapPeak.snaps.toLocaleString()} snaps in ${snapPeak.gamesPlayed} games, ${snapPeak.pffRating.toFixed(1)} grade.`
  }

  return `Most snaps: ${snapPeak.snaps.toLocaleString()} in ${snapPeak.season}. Top grade: ${gradePeak.pffRating.toFixed(1)} in ${gradePeak.season}.`
}

type RecruitingProfile = NonNullable<PlayerProfile['recruiting']>

function RecruitingSummary({ recruiting }: { recruiting: RecruitingProfile }) {
  const stars = recruitingStars(recruiting)

  return (
    <>
      <div className="flex items-center justify-between gap-4 border-l-4 border-michigan-maize bg-michigan-blue-soft px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">
            Recruiting class
          </p>
          <p className="text-2xl font-black tabular-nums leading-none">
            {recruiting.recruitingSeason}
          </p>
          <p className="mt-1 truncate text-xs font-bold text-neutral-600">
            {sourceLabel(recruiting.source)}
            {recruiting.position ? ` · ${recruiting.position}` : ''}
          </p>
        </div>
        <StarRating stars={stars} />
      </div>

      <div className="mt-2 overflow-x-auto border-y border-neutral-300">
        <table className="w-full table-fixed text-left tabular-nums">
          <caption className="sr-only">
            Composite and 247 recruiting ratings and ranks
          </caption>
          <thead className="bg-neutral-100 text-[9px] font-black uppercase tracking-[0.1em] text-neutral-500">
            <tr>
              <th scope="col" className="w-[28%] px-2 py-1.5">
                Source
              </th>
              <th scope="col" className="w-[24%] px-2 py-1.5 text-right">
                Rating
              </th>
              <th
                scope="col"
                aria-label="Overall rank"
                className="w-[16%] px-2 py-1.5 text-right"
              >
                OVR
              </th>
              <th
                scope="col"
                aria-label="Position rank"
                className="w-[16%] px-2 py-1.5 text-right"
              >
                POS
              </th>
              <th
                scope="col"
                aria-label="State rank"
                className="w-[16%] px-2 py-1.5 text-right"
              >
                ST
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 text-sm">
            <RecruitingRatingRow
              source="Composite"
              rating={recruiting.compositeRating?.toFixed(4)}
              overallRank={recruiting.compositeOverallRank}
              positionRank={recruiting.compositePositionRank}
              stateRank={recruiting.compositeStateRank}
            />
            <RecruitingRatingRow
              source="247"
              rating={formatServiceRating(recruiting.service247Rating)}
              overallRank={recruiting.service247OverallRank}
              positionRank={recruiting.service247PositionRank}
              stateRank={recruiting.service247StateRank}
            />
          </tbody>
        </table>
      </div>
    </>
  )
}

function RecruitingRatingRow({
  source,
  rating,
  overallRank,
  positionRank,
  stateRank,
}: {
  source: string
  rating: string | undefined
  overallRank: number | undefined
  positionRank: number | undefined
  stateRank: number | undefined
}) {
  return (
    <tr>
      <th scope="row" className="px-2 py-2 font-black">
        {source}
      </th>
      <td className="px-2 py-2 text-right font-bold">{rating ?? '—'}</td>
      <td className="px-2 py-2 text-right font-bold">
        {rank(overallRank) ?? '—'}
      </td>
      <td className="px-2 py-2 text-right font-bold">
        {rank(positionRank) ?? '—'}
      </td>
      <td className="px-2 py-2 text-right font-bold">
        {rank(stateRank) ?? '—'}
      </td>
    </tr>
  )
}

function StarRating({ stars }: { stars: number | undefined }) {
  if (stars === undefined) {
    return (
      <span className="shrink-0 text-xs font-black uppercase tracking-[0.1em] text-neutral-500">
        Unrated
      </span>
    )
  }

  return (
    <div className="shrink-0 text-right">
      <div
        className="flex justify-end gap-0.5"
        aria-label={`${stars}-star recruit`}
      >
        {Array.from({ length: stars }, (_, index) => (
          <StarIcon key={index} />
        ))}
      </div>
      <p className="mt-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-neutral-500">
        {stars}-star
      </p>
    </div>
  )
}

function StarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-6 w-6 fill-michigan-maize stroke-michigan-blue"
      strokeWidth="1.25"
    >
      <path d="m12 2.6 2.8 5.7 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9L12 2.6Z" />
    </svg>
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
    <section className="border-b border-neutral-200 py-3 last:border-b-0">
      <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-michigan-blue">
        {title}
      </h3>
      {children}
    </section>
  )
}

function DetailGrid({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-2">{children}</dl>
}

function Detail({
  label,
  value,
  className = '',
}: {
  label: string
  value: ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <dt className="text-[9px] font-bold uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </dt>
      <dd className="text-sm font-bold">{value ?? '—'}</dd>
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
    <div className="scrollbar-none -mx-1 mb-3 overflow-x-auto pb-1">
      <div className="flex min-w-max gap-1.5 px-1">
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
    <span className="border border-michigan-blue/25 bg-michigan-blue-soft px-1.5 py-0.5 font-bold text-michigan-blue">
      {sourceLabel(source)}
    </span>
  )
}

function StatusBadge({
  status,
}: {
  status: 'active' | 'committed' | 'departed'
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-neutral-500">
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${status === 'active' ? 'bg-michigan-blue' : status === 'committed' ? 'bg-michigan-maize' : 'bg-neutral-300'}`}
      />
      {status}
    </span>
  )
}

function EmptySearch({ clear }: { clear: () => void }) {
  return (
    <div className="border-y border-neutral-300 py-8 text-center">
      <h2 className="text-xl font-black">No players found</h2>
      <p className="mt-1 text-sm text-neutral-500">
        Try another name, position, school, year or team.
      </p>
      <button
        type="button"
        onClick={clear}
        className="mt-3 border border-neutral-950 px-3 py-1.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
      >
        Clear search
      </button>
    </div>
  )
}

function HydratingEmpty({ label }: { label: string }) {
  return (
    <div className="border-y border-neutral-200 py-3 text-sm text-neutral-500">
      {label}
    </div>
  )
}

export function RosterLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-michigan-blue px-6 text-white">
      <div className="text-center">
        <div className="mx-auto grid h-14 w-16 place-items-center border-2 border-michigan-maize bg-michigan-maize font-serif text-3xl font-black text-michigan-blue [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)]">
          M
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-michigan-maize">
          Loading roster
        </p>
      </div>
    </main>
  )
}

export function RosterError() {
  return (
    <main className="grid min-h-screen place-items-center bg-michigan-cream px-6 text-center text-michigan-blue">
      <div className="max-w-md">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-michigan-blue">
          Connection error
        </p>
        <h1 className="mt-1 text-2xl font-black">Couldn’t load the roster.</h1>
        <p className="mt-2 text-sm leading-5 text-neutral-500">
          Check the deployment URL and network connection.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 border border-neutral-950 px-3 py-1.5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
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

function findDepthPlayer(
  players: Array<EnrichedPlayer>,
  position: string,
  order: number,
) {
  return players.find(
    (entry) =>
      entry.stint.position === position &&
      entry.stint.depthChartOrder === order,
  )
}

function buildRotationGroups(
  active: Array<EnrichedPlayer>,
  starterIds: Set<string>,
) {
  const claimed = new Set(starterIds)

  return rotationGroups.map((group) => {
    const entries = group.allocations.flatMap((allocation) => {
      const selected = active
        .filter(
          (entry) =>
            allocation.positions.includes(entry.stint.position) &&
            !claimed.has(entry.player._id),
        )
        .sort(compareRotationCandidates)
        .slice(0, allocation.count)
      for (const entry of selected) claimed.add(entry.player._id)
      return selected
    })

    return { ...group, entries: entries.sort(compareDepthPlayers) }
  })
}

function isEarlyCareerProspect(entry: EnrichedPlayer) {
  return CURRENT_ROSTER_SEASON < entry.stint.eligibilityLeaveSeason
}

function effectiveDepthTier(
  entry: EnrichedPlayer,
  starterIds: Set<string>,
  rotationIds: Set<string>,
): DepthTierTone {
  if (entry.stint.depthTierOverride) return entry.stint.depthTierOverride
  if (starterIds.has(entry.player._id)) return 'starters'
  if (rotationIds.has(entry.player._id)) return 'rotation'
  if (entry.profile?.recruiting?.source === 'walk_on') return 'walk-ons'
  return isEarlyCareerProspect(entry) ? 'prospects' : 'depth'
}

function getEligibilityDisplay(entry: EnrichedPlayer) {
  const year = Math.max(
    1,
    CURRENT_ROSTER_SEASON - (entry.stint.eligibilityLeaveSeason - 2) + 1,
  )

  const band: EligibilityBand =
    CURRENT_ROSTER_SEASON >= entry.stint.eligibilityEndSeason
      ? 'final'
      : year >= 3
        ? 'nfl-eligible'
        : 'developing'

  return {
    band,
    year,
    label:
      band === 'final'
        ? 'Final eligibility year'
        : band === 'nfl-eligible'
          ? 'NFL-eligible'
          : 'Developing',
  }
}

function eligibilityRowClass(band: EligibilityBand) {
  if (band === 'final') return 'bg-red-50/80'
  if (band === 'nfl-eligible') return 'bg-amber-50/80'
  return 'bg-emerald-50/80'
}

function RecruitingYear({ season }: { season: number | undefined }) {
  return (
    <span
      className="shrink-0 text-xs font-medium text-neutral-500 tabular-nums"
      aria-label={
        season === undefined
          ? 'Recruiting class unavailable'
          : `Recruiting class ${season}`
      }
    >
      {season ?? '—'}
    </span>
  )
}

function injuryIndicator(
  kind: NonNullable<EnrichedPlayer['stint']['injury']>['kind'],
) {
  if (kind === 'season_ending')
    return {
      className: 'text-red-800',
      crosses: 3,
      label: 'Season-ending injury',
    }
  if (kind === 'long_term')
    return {
      className: 'text-red-600',
      crosses: 2,
      label: 'Long-term injury',
    }
  return {
    className: 'text-red-500',
    crosses: 1,
    label: 'Short-term injury',
  }
}

function compareRotationCandidates(a: EnrichedPlayer, b: EnrichedPlayer) {
  const aRelativeDepth =
    (a.stint.depthChartOrder ?? 999) - starterCount(a.stint.position)
  const bRelativeDepth =
    (b.stint.depthChartOrder ?? 999) - starterCount(b.stint.position)
  return aRelativeDepth - bRelativeDepth || compareDepthPlayers(a, b)
}

function compareDepthPlayers(a: EnrichedPlayer, b: EnrichedPlayer) {
  return (
    depthRoomOrder(depthRoom(a.stint.position)) -
      depthRoomOrder(depthRoom(b.stint.position)) ||
    positionOrder.indexOf(a.stint.position) -
      positionOrder.indexOf(b.stint.position) ||
    (a.stint.depthChartOrder ?? 999) - (b.stint.depthChartOrder ?? 999) ||
    a.player.displayName.localeCompare(b.player.displayName)
  )
}

function starterCount(position: string) {
  return [
    ...starterUnits.flatMap((unit) => unit.slots),
    ...specialistSlots,
  ].filter((slot) => slot.position === position).length
}

function depthRoom(position: string): DepthRoomId | 'OTHER' {
  if (position === 'QB') return 'QB'
  if (['RB', 'HB', 'FB'].includes(position)) return 'HB'
  if (['WR', 'SLOT', 'TE'].includes(position)) return 'WR'
  if (['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'OC', 'C', 'OL'].includes(position))
    return 'OL'
  if (['DL', 'DT', 'NT', 'IDL', 'DI'].includes(position)) return 'IDL'
  if (['EDGE', 'DE', 'SDE', 'WDE', 'ED'].includes(position)) return 'EDGE'
  if (['LB', 'ILB', 'OLB'].includes(position)) return 'LB'
  if (['CB', 'NICKEL', 'S', 'DB'].includes(position)) return 'DB'
  if (position === 'K') return 'K'
  if (position === 'P') return 'P'
  if (position === 'LS') return 'LS'
  return 'OTHER'
}

function depthRoomOrder(room: DepthRoomId | 'OTHER') {
  return [
    'QB',
    'HB',
    'WR',
    'OL',
    'IDL',
    'EDGE',
    'LB',
    'DB',
    'K',
    'P',
    'LS',
    'OTHER',
  ].indexOf(room)
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
  return value === undefined ? '—' : `#${value}`
}

function rank(value: number | undefined) {
  return value === undefined ? undefined : `#${value}`
}

function formatHeight(height: number | undefined) {
  return height === undefined
    ? undefined
    : `${Math.floor(height / 12)}′ ${height % 12}″`
}

function formatWeight(weight: number | undefined) {
  return weight === undefined ? undefined : `${weight} lb`
}

function formatServiceRating(rating: number | undefined) {
  if (rating === undefined) return undefined
  return Number.isInteger(rating) ? rating.toFixed(0) : rating.toFixed(2)
}

function recruitingStars(recruiting: RecruitingProfile) {
  if (
    recruiting.compositeOverallRank !== undefined &&
    recruiting.compositeOverallRank <= 32
  ) {
    return 5
  }

  if (recruiting.compositeRating !== undefined) {
    if (recruiting.compositeRating >= 0.89) return 4
    if (recruiting.compositeRating >= 0.8) return 3
    return 2
  }

  if (recruiting.service247Rating !== undefined) {
    if (recruiting.service247Rating >= 98) return 5
    if (recruiting.service247Rating >= 90) return 4
    if (recruiting.service247Rating >= 80) return 3
    return 2
  }

  return undefined
}

function chipClass(active: boolean) {
  return `border px-3 py-1 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue ${active ? 'border-michigan-blue bg-michigan-blue text-white' : 'border-michigan-blue/25 text-neutral-600 hover:border-michigan-blue hover:bg-michigan-maize-soft hover:text-michigan-blue'}`
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
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
      className="h-4 w-4 text-neutral-400 transition group-open:rotate-180"
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
