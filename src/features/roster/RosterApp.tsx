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

type DepthGroup =
  'QB' | 'HB' | 'WR' | 'OL' | 'IDL' | 'EDGE' | 'LB' | 'DB' | 'ST'

type StarterSlot = {
  id: string
  label: string
  position: string
  order: number
  layout: string
}

type RotationGroup = {
  id: Exclude<DepthGroup, 'ST'>
  label: string
  note: string
  allocations: Array<{ positions: Array<string>; count: number }>
}

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
        layout: 'lg:col-span-3 lg:col-start-1 lg:row-start-1',
      },
      {
        id: 'slot',
        label: 'SLOT',
        position: 'SLOT',
        order: 1,
        layout: 'lg:col-span-3 lg:col-start-4 lg:row-start-1',
      },
      {
        id: 'te',
        label: 'TE',
        position: 'TE',
        order: 1,
        layout: 'lg:col-span-3 lg:col-start-7 lg:row-start-1',
      },
      {
        id: 'wr-right',
        label: 'WR',
        position: 'WR',
        order: 2,
        layout: 'lg:col-span-3 lg:col-start-10 lg:row-start-1',
      },
      {
        id: 'left-tackle',
        label: 'OT',
        position: 'OT',
        order: 1,
        layout: 'lg:col-span-2 lg:col-start-1 lg:row-start-2',
      },
      {
        id: 'left-guard',
        label: 'OG',
        position: 'OG',
        order: 1,
        layout: 'lg:col-span-2 lg:col-start-3 lg:row-start-2',
      },
      {
        id: 'center',
        label: 'OC',
        position: 'OC',
        order: 1,
        layout: 'lg:col-span-2 lg:col-start-6 lg:row-start-2',
      },
      {
        id: 'right-guard',
        label: 'OG',
        position: 'OG',
        order: 2,
        layout: 'lg:col-span-2 lg:col-start-9 lg:row-start-2',
      },
      {
        id: 'right-tackle',
        label: 'OT',
        position: 'OT',
        order: 2,
        layout: 'lg:col-span-2 lg:col-start-11 lg:row-start-2',
      },
      {
        id: 'quarterback',
        label: 'QB',
        position: 'QB',
        order: 1,
        layout: 'lg:col-span-4 lg:col-start-4 lg:row-start-3',
      },
      {
        id: 'halfback',
        label: 'HB',
        position: 'RB',
        order: 1,
        layout: 'lg:col-span-3 lg:col-start-8 lg:row-start-3',
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
        layout: 'lg:col-span-3 lg:col-start-1 lg:row-start-1',
      },
      {
        id: 'idl-left',
        label: 'IDL',
        position: 'DL',
        order: 1,
        layout: 'lg:col-span-3 lg:col-start-4 lg:row-start-1',
      },
      {
        id: 'idl-right',
        label: 'IDL',
        position: 'DL',
        order: 2,
        layout: 'lg:col-span-3 lg:col-start-7 lg:row-start-1',
      },
      {
        id: 'edge-right',
        label: 'EDGE',
        position: 'EDGE',
        order: 2,
        layout: 'lg:col-span-3 lg:col-start-10 lg:row-start-1',
      },
      {
        id: 'linebacker-left',
        label: 'LB',
        position: 'LB',
        order: 1,
        layout: 'lg:col-span-3 lg:col-start-4 lg:row-start-2',
      },
      {
        id: 'linebacker-right',
        label: 'LB',
        position: 'LB',
        order: 2,
        layout: 'lg:col-span-3 lg:col-start-7 lg:row-start-2',
      },
      {
        id: 'corner-left',
        label: 'CB',
        position: 'CB',
        order: 1,
        layout: 'lg:col-span-2 lg:col-start-1 lg:row-start-3',
      },
      {
        id: 'safety-left',
        label: 'S',
        position: 'S',
        order: 1,
        layout: 'lg:col-span-2 lg:col-start-3 lg:row-start-3',
      },
      {
        id: 'nickel',
        label: 'CB',
        position: 'CB',
        order: 3,
        layout: 'lg:col-span-2 lg:col-start-6 lg:row-start-3',
      },
      {
        id: 'safety-right',
        label: 'S',
        position: 'S',
        order: 2,
        layout: 'lg:col-span-2 lg:col-start-9 lg:row-start-3',
      },
      {
        id: 'corner-right',
        label: 'CB',
        position: 'CB',
        order: 2,
        layout: 'lg:col-span-2 lg:col-start-11 lg:row-start-3',
      },
    ],
  },
]

const specialistSlots: Array<StarterSlot> = [
  { id: 'kicker', label: 'K', position: 'K', order: 1, layout: '' },
  { id: 'punter', label: 'P', position: 'P', order: 1, layout: '' },
  { id: 'long-snapper', label: 'LS', position: 'LS', order: 1, layout: '' },
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
  const active = players.filter((entry) => entry.stint.status === 'active')
  const visibleIds = new Set(
    visiblePlayers
      .filter((entry) => entry.stint.status === 'active')
      .map((entry) => entry.player._id),
  )
  const isFiltered = visiblePlayers.length !== players.length
  const starterAssignments = starterUnits.flatMap((unit) =>
    unit.slots.flatMap((slot) => {
      const entry = findDepthPlayer(active, slot.position, slot.order)
      return entry ? [{ entry, slot, unit: unit.id }] : []
    }),
  )
  const specialistAssignments = specialistSlots.flatMap((slot) => {
    const entry = findDepthPlayer(active, slot.position, slot.order)
    return entry ? [{ entry, slot }] : []
  })
  const starterIds = new Set(
    [...starterAssignments, ...specialistAssignments].map(
      ({ entry }) => entry.player._id,
    ),
  )
  const rotations = buildRotationGroups(active, starterIds)
  const rotationIds = new Set(
    rotations.flatMap((group) =>
      group.entries.map((entry) => entry.player._id),
    ),
  )
  const reserves = active
    .filter(
      (entry) =>
        !starterIds.has(entry.player._id) && !rotationIds.has(entry.player._id),
    )
    .sort(compareDepthPlayers)
  const visibleReserves = reserves.filter((entry) =>
    visibleIds.has(entry.player._id),
  )
  const prospectReserves = visibleReserves.filter(
    (entry) => entry.profile?.recruiting?.source !== 'walk_on',
  )
  const walkOnReserves = visibleReserves.filter(
    (entry) => entry.profile?.recruiting?.source === 'walk_on',
  )
  const visibleStarterUnits = starterUnits
    .map((unit) => ({
      ...unit,
      assignments: starterAssignments.filter(
        (assignment) =>
          assignment.unit === unit.id &&
          visibleIds.has(assignment.entry.player._id),
      ),
    }))
    .filter((unit) => !isFiltered || unit.assignments.length > 0)
  const visibleSpecialists = specialistAssignments.filter(({ entry }) =>
    visibleIds.has(entry.player._id),
  )
  const visibleRotations = rotations
    .map((group) => ({
      ...group,
      entries: group.entries.filter((entry) =>
        visibleIds.has(entry.player._id),
      ),
    }))
    .filter((group) => !isFiltered || group.entries.length > 0)
  const showFirstUnit =
    !isFiltered ||
    visibleStarterUnits.length > 0 ||
    visibleSpecialists.length > 0
  const showRotation = !isFiltered || visibleRotations.length > 0
  const showReserves = !isFiltered || visibleReserves.length > 0
  const hasVisibleActive = visibleIds.size > 0

  return (
    <>
      <SectionIntro eyebrow="2026 roster" title="Depth chart & rotation">
        First-listed players fill the base offense, defense and specialists.
        Rotation room sizes follow the 2015–2025 snap-count workload report;
        these are roster tiers, not official starts or snap projections.
      </SectionIntro>
      {!hasVisibleActive ? (
        <HydratingEmpty label="No active players match this search." />
      ) : (
        <div className="space-y-7">
          {showFirstUnit && (
            <section aria-labelledby="starters-heading">
              <DepthSectionHeading
                id="starters-heading"
                number="01"
                title="First unit"
                detail="22-player base lineup"
              />
              <div className="grid gap-4 xl:grid-cols-2">
                {visibleStarterUnits.map((unit) => (
                  <StarterUnit
                    key={unit.id}
                    label={unit.label}
                    personnel={unit.personnel}
                    assignments={unit.assignments}
                    select={select}
                  />
                ))}
              </div>
              {(!isFiltered || visibleSpecialists.length > 0) && (
                <div className="mt-3 border-y border-michigan-blue/20 bg-white px-3 py-2 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-[0.14em] text-michigan-blue">
                      Specialists
                    </h4>
                    <p className="text-xs text-neutral-500">
                      First-listed kicking unit
                    </p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:mt-0 sm:grid-cols-3">
                    {visibleSpecialists.map(({ entry, slot }) => (
                      <CompactDepthPlayer
                        key={entry.player._id}
                        entry={entry}
                        label={slot.label}
                        select={select}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {showRotation && (
            <section aria-labelledby="rotation-heading">
              <DepthSectionHeading
                id="rotation-heading"
                number="02"
                title="Rotation"
                detail="Workload-sized position rooms"
              />
              <div className="grid border-t border-michigan-blue/25 sm:grid-cols-2 sm:gap-x-5 xl:grid-cols-4">
                {visibleRotations.map((group) => (
                  <article
                    key={group.id}
                    className="border-b border-michigan-blue/20 py-3"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-black">{group.label}</h4>
                        <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500">
                          {group.note}
                        </p>
                      </div>
                      <span className="grid h-7 min-w-7 place-items-center bg-michigan-maize px-1 text-xs font-black text-michigan-blue">
                        {group.entries.length}
                      </span>
                    </div>
                    <ol className="space-y-1">
                      {group.entries.map((entry) => (
                        <li key={entry.player._id}>
                          <DepthPlayerRow entry={entry} select={select} />
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          )}

          {showReserves && (
            <section aria-labelledby="reserves-heading">
              <DepthSectionHeading
                id="reserves-heading"
                number="03"
                title="Reserves"
                detail={`${visibleReserves.length} ${visibleReserves.length === 1 ? 'player' : 'players'} beyond the rotation`}
              />
              <div className="grid gap-5 lg:grid-cols-2">
                {(!isFiltered || prospectReserves.length > 0) && (
                  <ReserveList
                    title="Prospects"
                    description="Scholarship recruits and transfers"
                    entries={prospectReserves}
                    select={select}
                  />
                )}
                {(!isFiltered || walkOnReserves.length > 0) && (
                  <ReserveList
                    title="Walk-ons"
                    description="Players recorded as walk-on arrivals"
                    entries={walkOnReserves}
                    select={select}
                  />
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}

function DepthSectionHeading({
  id,
  number,
  title,
  detail,
}: {
  id: string
  number: string
  title: string
  detail: string
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 border-b-2 border-michigan-blue pb-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-black tabular-nums text-michigan-maize [text-shadow:0_1px_0_#00274c]">
          {number}
        </span>
        <h3 id={id} className="text-lg font-black tracking-[-0.02em]">
          {title}
        </h3>
      </div>
      <p className="text-right text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-500">
        {detail}
      </p>
    </div>
  )
}

function StarterUnit({
  label,
  personnel,
  assignments,
  select,
}: {
  label: string
  personnel: string
  assignments: Array<{
    entry: EnrichedPlayer
    slot: StarterSlot
  }>
  select: (player: EnrichedPlayer) => void
}) {
  return (
    <article className="overflow-hidden border border-michigan-blue bg-michigan-blue shadow-[4px_4px_0_#ffcb05]">
      <header className="flex items-center justify-between border-b border-white/20 px-3 py-2 text-white">
        <h4 className="font-black">{label}</h4>
        <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-michigan-maize">
          {personnel}
        </span>
      </header>
      <div className="grid grid-cols-2 gap-2 p-3 lg:grid-cols-12 lg:grid-rows-3">
        {assignments.map(({ entry, slot }) => (
          <button
            key={slot.id}
            type="button"
            onClick={() => select(entry)}
            title={entry.player.displayName}
            className={`group min-w-0 border border-white/50 bg-michigan-cream p-2 text-left text-michigan-blue transition hover:-translate-y-0.5 hover:border-michigan-maize hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-maize ${slot.layout}`}
          >
            <span className="flex items-center justify-between gap-1">
              <span className="bg-michigan-maize px-1.5 py-0.5 text-[9px] font-black uppercase tracking-[0.1em]">
                {slot.label}
              </span>
              <span className="text-[10px] font-black tabular-nums text-neutral-500">
                {jersey(entry.stint.jerseyNumber)}
              </span>
            </span>
            <span className="mt-1 block text-[11px] font-black leading-tight sm:text-xs">
              {entry.player.displayName}
            </span>
            <span className="block truncate text-[10px] text-neutral-500">
              {entry.stint.position} · {entry.stint.startSeason}
            </span>
          </button>
        ))}
      </div>
    </article>
  )
}

function CompactDepthPlayer({
  entry,
  label,
  select,
}: {
  entry: EnrichedPlayer
  label: string
  select: (player: EnrichedPlayer) => void
}) {
  return (
    <button
      type="button"
      onClick={() => select(entry)}
      className="flex min-w-0 items-center gap-2 border-l-2 border-michigan-maize px-2 text-left transition hover:bg-michigan-blue-soft focus-visible:bg-michigan-maize-soft focus-visible:outline-none"
    >
      <span className="text-xs font-black">{label}</span>
      <span className="truncate text-xs font-bold">
        {entry.player.displayName}
      </span>
    </button>
  )
}

function DepthPlayerRow({
  entry,
  select,
}: {
  entry: EnrichedPlayer
  select: (player: EnrichedPlayer) => void
}) {
  return (
    <button
      type="button"
      onClick={() => select(entry)}
      className="group grid w-full grid-cols-[2.3rem_1fr_auto] items-center gap-2 border-l-2 border-transparent px-1.5 py-1.5 text-left transition hover:border-michigan-maize hover:bg-michigan-blue-soft focus-visible:border-michigan-maize focus-visible:bg-michigan-maize-soft focus-visible:outline-none"
    >
      <span className="text-[9px] font-black uppercase tracking-[0.08em] text-neutral-500 group-hover:text-michigan-blue">
        {entry.stint.position}
      </span>
      <span className="truncate text-sm font-bold">
        {entry.player.displayName}
      </span>
      <span className="text-[10px] font-bold tabular-nums text-neutral-500">
        {jersey(entry.stint.jerseyNumber)}
      </span>
    </button>
  )
}

function ReserveList({
  title,
  description,
  entries,
  select,
}: {
  title: string
  description: string
  entries: Array<EnrichedPlayer>
  select: (player: EnrichedPlayer) => void
}) {
  return (
    <article className="border-t-4 border-michigan-maize bg-white">
      <header className="flex items-start justify-between gap-3 border-b border-michigan-blue/20 px-3 py-2">
        <div>
          <h4 className="font-black">{title}</h4>
          <p className="text-xs text-neutral-500">{description}</p>
        </div>
        <span className="text-lg font-black tabular-nums">
          {entries.length}
        </span>
      </header>
      {entries.length === 0 ? (
        <p className="px-3 py-4 text-sm text-neutral-500">No players shown.</p>
      ) : (
        <ol className="grid divide-y divide-neutral-100 px-2 sm:grid-cols-2 sm:gap-x-3 sm:[&>li:nth-child(2)]:border-t-0">
          {entries.map((entry) => (
            <li key={entry.player._id}>
              <button
                type="button"
                onClick={() => select(entry)}
                className="grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-2 px-1 py-2 text-left transition hover:bg-michigan-blue-soft focus-visible:bg-michigan-maize-soft focus-visible:outline-none"
              >
                <span className="text-[9px] font-black uppercase tracking-[0.08em] text-michigan-blue">
                  {depthGroup(entry.stint.position)}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">
                    {entry.player.displayName}
                  </span>
                  <span className="block text-[10px] text-neutral-500">
                    {entry.stint.position} · depth {entry.stint.depthChartOrder}
                  </span>
                </span>
                <span className="text-[10px] font-bold text-neutral-500">
                  {jersey(entry.stint.jerseyNumber)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </article>
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
  const medicalExtensionSeasons = getMedicalExtensionSeasons(entry.stint)
  const eligibilityEndSeason =
    entry.stint.eligibilityStartSeason + 4 + medicalExtensionSeasons

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
              {entry.stint.jerseyNumber ?? entry.stint.position}
            </div>
            <div>
              <StatusBadge status={entry.stint.status} />
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
              <Detail label="Eligibility ends" value={eligibilityEndSeason} />
              <Detail label="Standard eligibility" value="5 seasons" />
              <Detail
                label="Medical extension"
                value={
                  medicalExtensionSeasons === 0
                    ? 'None'
                    : `${medicalExtensionSeasons} season${medicalExtensionSeasons === 1 ? '' : 's'}`
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

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
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

function compareRotationCandidates(a: EnrichedPlayer, b: EnrichedPlayer) {
  const aRelativeDepth =
    (a.stint.depthChartOrder ?? 999) - starterCount(a.stint.position)
  const bRelativeDepth =
    (b.stint.depthChartOrder ?? 999) - starterCount(b.stint.position)
  return aRelativeDepth - bRelativeDepth || compareDepthPlayers(a, b)
}

function compareDepthPlayers(a: EnrichedPlayer, b: EnrichedPlayer) {
  return (
    depthGroupOrder(depthGroup(a.stint.position)) -
      depthGroupOrder(depthGroup(b.stint.position)) ||
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

function depthGroup(position: string): DepthGroup {
  if (position === 'QB') return 'QB'
  if (['RB', 'HB', 'FB'].includes(position)) return 'HB'
  if (['WR', 'SLOT', 'TE'].includes(position)) return 'WR'
  if (['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'OC', 'C', 'OL'].includes(position))
    return 'OL'
  if (['DL', 'DT', 'NT', 'IDL', 'DI'].includes(position)) return 'IDL'
  if (['EDGE', 'DE', 'SDE', 'WDE', 'ED'].includes(position)) return 'EDGE'
  if (['LB', 'ILB', 'OLB'].includes(position)) return 'LB'
  if (['CB', 'NICKEL', 'S', 'DB'].includes(position)) return 'DB'
  return 'ST'
}

function depthGroupOrder(group: DepthGroup) {
  return ['QB', 'HB', 'WR', 'OL', 'IDL', 'EDGE', 'LB', 'DB', 'ST'].indexOf(
    group,
  )
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

function getMedicalExtensionSeasons(stint: EnrichedPlayer['stint']) {
  const transitionStint = stint as Omit<
    EnrichedPlayer['stint'],
    'medicalExtensionSeasons'
  > & {
    medicalExtensionSeasons?: number
    redshirtSeasons?: number
  }

  return Math.max(
    transitionStint.medicalExtensionSeasons ??
      (transitionStint.redshirtSeasons ?? 1) - 1,
    0,
  )
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
