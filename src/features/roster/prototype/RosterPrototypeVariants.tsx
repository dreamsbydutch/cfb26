import { PrototypeEmpty, titleCase } from './PrototypeShared'
import type { api } from '../../../../convex/_generated/api'
import type { Id } from '../../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import type { RosterEntry, SeasonDashboard } from '../useMichiganRoster'

type Movement = FunctionReturnType<typeof api.rosters.listMovements>[number]

export type ActiveRosterEntry = RosterEntry & {
  player: NonNullable<RosterEntry['player']>
}

export interface PrototypeViewProps {
  comparison: Array<Id<'players'>>
  data: SeasonDashboard
  entries: Array<ActiveRosterEntry>
  filteredEntries: Array<ActiveRosterEntry>
  movements: Array<Movement>
  onCompare: (id: Id<'players'>) => void
  onRoomChange: (room: string) => void
  onSelect: (id: Id<'players'>) => void
  room: string
  rooms: Array<string>
  search: string
  season: number
}

export function PersonnelCommand(props: PrototypeViewProps) {
  const {
    comparison,
    data,
    entries,
    filteredEntries,
    movements,
    onCompare,
    onRoomChange,
    onSelect,
    room,
    rooms,
    search,
    season,
  } = props
  const starters = entries.filter(
    (entry) => entry.season.role === 'starter',
  ).length
  const transfers = entries.filter(
    (entry) => entry.player.entryMethod === 'transfer',
  ).length
  const limited = entries.filter(
    (entry) =>
      entry.season.depthStatus === 'limited' ||
      entry.season.depthStatus === 'out',
  ).length
  return (
    <main id="overview" className="command-layout">
      <section className="command-hero">
        <div>
          <p className="prototype-kicker">
            {season} · Michigan personnel command
          </p>
          <h1>
            How is Michigan’s roster built
            <span>—and where is it changing?</span>
          </h1>
        </div>
        <div className="command-hero__status">
          <span className="live-indicator">Live</span>
          <b>{data.program.name}</b>
          <small>{entries.length} active roster records</small>
        </div>
      </section>

      <section className="command-kpis" aria-label="Roster summary">
        <DataMetric
          label="Rostered"
          value={entries.length}
          note="Player Seasons"
        />
        <DataMetric
          label="Scholarships"
          value={data.scholarship.counted}
          note={
            data.rosterLimit
              ? `${data.rosterLimit} season limit`
              : 'No limit loaded'
          }
        />
        <DataMetric
          label="Transfers"
          value={transfers}
          note="Current roster origin"
        />
        <DataMetric
          label="Starters"
          value={starters}
          note="Owner-designated role"
        />
        <DataMetric
          tone={limited > 0 ? 'warning' : 'default'}
          label="Availability"
          value={limited}
          note="Limited or out"
        />
      </section>

      <div className="command-grid">
        <section className="command-construction">
          <SectionHeading
            eyebrow="Roster construction"
            title="How the room was assembled"
            note="Current roster by original entry path"
          />
          <ConstructionBars entries={entries} />
        </section>
        <MovementLedger movements={movements} season={season} />
        <WarningsPanel warnings={data.warnings} />
      </div>

      <section id="roster-board" className="command-board">
        <div className="command-board__header">
          <SectionHeading
            eyebrow="Personnel board"
            title="Position rooms"
            note={`${filteredEntries.length} of ${entries.length} roster records shown`}
          />
          <RoomFilters active={room} onChange={onRoomChange} rooms={rooms} />
        </div>
        {filteredEntries.length === 0 ? (
          <PrototypeEmpty>
            No roster records match “{search}” in {room.toLocaleLowerCase()}.
          </PrototypeEmpty>
        ) : (
          <div className="command-rooms">
            {groupByRoom(filteredEntries).map(([roomName, roomEntries]) => (
              <article key={roomName} className="command-room">
                <header>
                  <div>
                    <span>{roomName}</span>
                    <small>{roomEntries.length} players</small>
                  </div>
                  <RoleDots entries={roomEntries} />
                </header>
                <div className="command-room__rows">
                  {roomEntries.map((entry) => (
                    <CommandPlayerRow
                      key={entry.season._id}
                      checked={comparison.includes(entry.player._id)}
                      entry={entry}
                      onCompare={onCompare}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}

export function ScoutWorkbench(props: PrototypeViewProps) {
  const {
    comparison,
    data,
    entries,
    filteredEntries,
    movements,
    onCompare,
    onRoomChange,
    onSelect,
    room,
    rooms,
    search,
    season,
  } = props
  return (
    <main id="overview" className="workbench-layout">
      <header className="workbench-title">
        <div>
          <p className="prototype-kicker">Live player file · {season}</p>
          <h1>Michigan roster workbench</h1>
        </div>
        <p>
          Sort the personnel problem by room. Open a player file, flag a
          comparison, and keep movement context in view.
        </p>
      </header>
      <div className="workbench-grid">
        <aside className="workbench-rail">
          <div className="workbench-rail__label">Room index</div>
          <button
            type="button"
            aria-pressed={room === 'All rooms'}
            onClick={() => onRoomChange('All rooms')}
          >
            <span>All rooms</span>
            <b>{entries.length}</b>
          </button>
          {rooms.map((roomName) => (
            <button
              key={roomName}
              type="button"
              aria-pressed={room === roomName}
              onClick={() => onRoomChange(roomName)}
            >
              <span>{roomName}</span>
              <b>
                {
                  entries.filter(
                    (entry) => entry.season.positionRoom === roomName,
                  ).length
                }
              </b>
            </button>
          ))}
        </aside>

        <section id="roster-board" className="workbench-table-wrap">
          <div className="workbench-table__head">
            <div>
              <span>{room}</span>
              <b>{filteredEntries.length} records</b>
            </div>
            <div className="workbench-key">
              <i className="key-starter" /> Starter
              <i className="key-rotation" /> Rotation
              <i className="key-reserve" /> Reserve
            </div>
          </div>
          {filteredEntries.length === 0 ? (
            <PrototypeEmpty>
              No roster records match “{search}” in {room.toLocaleLowerCase()}.
            </PrototypeEmpty>
          ) : (
            <div className="workbench-table-scroll">
              <table className="workbench-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Player</th>
                    <th>Pos</th>
                    <th>Role</th>
                    <th>Experience</th>
                    <th>Games / starts</th>
                    <th>Scholarship</th>
                    <th>Available</th>
                    <th>
                      <span className="sr-only">Compare</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry) => (
                    <tr key={entry.season._id} data-role={entry.season.role}>
                      <td className="workbench-number">
                        {entry.season.jerseyNumber ?? '—'}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="player-link"
                          onClick={() => onSelect(entry.player._id)}
                        >
                          {entry.player.displayName}
                        </button>
                        <small>{entry.season.positionRoom}</small>
                      </td>
                      <td>{entry.season.listedPosition}</td>
                      <td>
                        <RoleBadge role={entry.season.role} />
                      </td>
                      <td>{experienceLabel(entry, season)}</td>
                      <td className="tabular-cell">
                        {entry.season.gamesPlayed} / {entry.season.starts}
                      </td>
                      <td>{titleCase(entry.season.scholarshipStatus)}</td>
                      <td>
                        <AvailabilityBadge value={entry.season.depthStatus} />
                      </td>
                      <td>
                        <CompareToggle
                          checked={comparison.includes(entry.player._id)}
                          entry={entry}
                          onCompare={onCompare}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="workbench-inspector">
          <section>
            <div className="workbench-inspector__label">Construction file</div>
            <ConstructionBars entries={entries} compact />
          </section>
          <section id="movement-feed">
            <div className="workbench-inspector__label">Season movement</div>
            <CompactMovement movements={movements} />
          </section>
          <section id="development-panel">
            <div className="workbench-inspector__label">Data exceptions</div>
            <div className="exception-count">
              <strong>{data.warnings.length}</strong>
              <span>
                {data.warnings.length === 1 ? 'open warning' : 'open warnings'}
              </span>
            </div>
            {data.warnings.slice(0, 3).map((warning) => (
              <p key={warning} className="exception-copy">
                {warning}
              </p>
            ))}
          </section>
        </aside>
      </div>
    </main>
  )
}

export function RosterMatrix(props: PrototypeViewProps) {
  const {
    comparison,
    data,
    entries,
    filteredEntries,
    movements,
    onCompare,
    onRoomChange,
    onSelect,
    room,
    rooms,
    search,
    season,
  } = props
  const roleCounts = countBy(entries, (entry) => entry.season.role)
  return (
    <main id="overview" className="matrix-layout">
      <header className="matrix-title">
        <div className="matrix-title__index">M / {season}</div>
        <div>
          <p className="prototype-kicker">Roster topology</p>
          <h1>See the whole team as a system.</h1>
        </div>
        <p>
          Every room, role, origin, and availability signal on one scan-first
          surface.
        </p>
      </header>

      <section className="matrix-stats" aria-label="Roster composition">
        <MatrixStat label="Players" value={entries.length} />
        <MatrixStat label="Rooms" value={rooms.length} />
        <MatrixStat label="Starters" value={roleCounts.get('starter') ?? 0} />
        <MatrixStat label="Rotation" value={roleCounts.get('rotation') ?? 0} />
        <MatrixStat
          label="Scholarship"
          value={`${data.scholarship.counted}${data.rosterLimit ? ` / ${data.rosterLimit}` : ''}`}
        />
        <MatrixStat label="Warnings" value={data.warnings.length} alert />
      </section>

      <section className="matrix-control-strip">
        <RoomFilters active={room} onChange={onRoomChange} rooms={rooms} />
        <span>
          {filteredEntries.length} records{' '}
          {search ? `matching “${search}”` : ''}
        </span>
      </section>

      <section id="roster-board" className="matrix-board">
        <div className="matrix-board__labels" aria-hidden="true">
          <span>Position room</span>
          <span>Starter</span>
          <span>Rotation</span>
          <span>Reserve / unassigned</span>
        </div>
        {filteredEntries.length === 0 ? (
          <PrototypeEmpty>
            No roster records match “{search}” in {room.toLocaleLowerCase()}.
          </PrototypeEmpty>
        ) : (
          groupByRoom(filteredEntries).map(([roomName, roomEntries]) => (
            <article key={roomName} className="matrix-row">
              <header>
                <strong>{roomName}</strong>
                <span>{roomEntries.length}</span>
              </header>
              {(['starter', 'rotation', 'reserve'] as const).map((roleName) => (
                <div key={roleName} className="matrix-cell">
                  {roomEntries
                    .filter((entry) =>
                      roleName === 'reserve'
                        ? entry.season.role === 'reserve' ||
                          entry.season.role === 'unassigned'
                        : entry.season.role === roleName,
                    )
                    .map((entry) => (
                      <MatrixPlayer
                        key={entry.season._id}
                        checked={comparison.includes(entry.player._id)}
                        entry={entry}
                        onCompare={onCompare}
                        onSelect={onSelect}
                      />
                    ))}
                </div>
              ))}
            </article>
          ))
        )}
      </section>

      <div className="matrix-lower">
        <section id="movement-feed" className="matrix-movements">
          <SectionHeading
            eyebrow="Change map"
            title={`${season} movement ledger`}
            note="Lifecycle events grouped by type"
          />
          <MovementTiles movements={movements} />
        </section>
        <section id="development-panel" className="matrix-development">
          <SectionHeading
            eyebrow="Development profile"
            title="Experience against role"
            note="Current season participation evidence"
          />
          <DevelopmentGrid entries={entries} season={season} />
        </section>
      </div>
    </main>
  )
}

function CommandPlayerRow({
  checked,
  entry,
  onCompare,
  onSelect,
}: {
  checked: boolean
  entry: ActiveRosterEntry
  onCompare: (id: Id<'players'>) => void
  onSelect: (id: Id<'players'>) => void
}) {
  return (
    <div className="command-player" data-role={entry.season.role}>
      <span className="command-player__number">
        {entry.season.jerseyNumber ?? '—'}
      </span>
      <button
        type="button"
        className="player-link"
        onClick={() => onSelect(entry.player._id)}
      >
        {entry.player.displayName}
        <small>
          {entry.season.listedPosition} ·{' '}
          {experienceLabel(entry, entry.season.season)}
        </small>
      </button>
      <RoleBadge role={entry.season.role} />
      <CompareToggle checked={checked} entry={entry} onCompare={onCompare} />
    </div>
  )
}

function MatrixPlayer({
  checked,
  entry,
  onCompare,
  onSelect,
}: {
  checked: boolean
  entry: ActiveRosterEntry
  onCompare: (id: Id<'players'>) => void
  onSelect: (id: Id<'players'>) => void
}) {
  return (
    <div className="matrix-player" data-status={entry.season.depthStatus}>
      <button type="button" onClick={() => onSelect(entry.player._id)}>
        <b>{entry.season.jerseyNumber ?? '—'}</b>
        <span>{entry.player.displayName}</span>
        <small>{entry.season.listedPosition}</small>
      </button>
      <CompareToggle checked={checked} entry={entry} onCompare={onCompare} />
    </div>
  )
}

function CompareToggle({
  checked,
  entry,
  onCompare,
}: {
  checked: boolean
  entry: ActiveRosterEntry
  onCompare: (id: Id<'players'>) => void
}) {
  return (
    <label className="compare-toggle" title="Add to four-player comparison">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onCompare(entry.player._id)}
      />
      <span>Compare {entry.player.displayName}</span>
    </label>
  )
}

function RoleBadge({ role }: { role: ActiveRosterEntry['season']['role'] }) {
  return (
    <span className="role-badge" data-role={role}>
      {titleCase(role)}
    </span>
  )
}

function AvailabilityBadge({
  value,
}: {
  value: ActiveRosterEntry['season']['depthStatus']
}) {
  return (
    <span className="availability-badge" data-status={value}>
      {titleCase(value)}
    </span>
  )
}

function DataMetric({
  label,
  note,
  tone = 'default',
  value,
}: {
  label: string
  note: string
  tone?: 'default' | 'warning'
  value: number | string
}) {
  return (
    <div className="data-metric" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  )
}

function MatrixStat({
  alert = false,
  label,
  value,
}: {
  alert?: boolean
  label: string
  value: number | string
}) {
  return (
    <div className="matrix-stat" data-alert={alert || undefined}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  )
}

function SectionHeading({
  eyebrow,
  note,
  title,
}: {
  eyebrow: string
  note: string
  title: string
}) {
  return (
    <header className="prototype-section-heading">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      <p>{note}</p>
    </header>
  )
}

function RoomFilters({
  active,
  onChange,
  rooms,
}: {
  active: string
  onChange: (value: string) => void
  rooms: Array<string>
}) {
  return (
    <div className="room-filters" aria-label="Filter by position room">
      {['All rooms', ...rooms].map((room) => (
        <button
          key={room}
          type="button"
          aria-pressed={active === room}
          onClick={() => onChange(room)}
        >
          {room}
        </button>
      ))}
    </div>
  )
}

function ConstructionBars({
  compact = false,
  entries,
}: {
  compact?: boolean
  entries: Array<ActiveRosterEntry>
}) {
  const paths = [
    ['high_school', 'High school'],
    ['transfer', 'Transfer'],
    ['walk_on', 'Walk-on'],
    ['legacy', 'Legacy file'],
  ] as const
  return (
    <div
      className={`construction-bars ${compact ? 'construction-bars--compact' : ''}`}
    >
      {paths.map(([key, label]) => {
        const count = entries.filter(
          (entry) => entry.player.entryMethod === key,
        ).length
        const percentage =
          entries.length === 0 ? 0 : (count / entries.length) * 100
        return (
          <div key={key}>
            <div className="construction-bars__label">
              <span>{label}</span>
              <b>{count}</b>
            </div>
            <div className="construction-bars__track">
              <i style={{ width: `${percentage}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MovementLedger({
  movements,
  season,
}: {
  movements: Array<Movement>
  season: number
}) {
  return (
    <section id="movement-feed" className="command-movement">
      <SectionHeading
        eyebrow="What changed"
        title={`${season} movement ledger`}
        note={`${movements.length} lifecycle events`}
      />
      <MovementTiles movements={movements} />
      <div className="movement-list">
        {movements.slice(0, 6).map((movement) => (
          <div key={movement.event._id}>
            <span className="movement-glyph">
              {movementGlyph(movement.event.kind)}
            </span>
            <span>
              <b>{movement.player?.displayName ?? 'Unresolved player'}</b>
              <small>{titleCase(movement.event.kind)}</small>
            </span>
          </div>
        ))}
        {movements.length === 0 && <p>No movement events recorded.</p>}
      </div>
    </section>
  )
}

function CompactMovement({ movements }: { movements: Array<Movement> }) {
  const grouped = countBy(movements, (movement) => movement.event.kind)
  if (movements.length === 0)
    return <p className="muted-copy">No events recorded.</p>
  return (
    <div className="compact-movement">
      {[...grouped.entries()]
        .sort((left, right) => right[1] - left[1])
        .slice(0, 6)
        .map(([kind, count]) => (
          <div key={kind}>
            <span>{titleCase(kind)}</span>
            <b>{count}</b>
          </div>
        ))}
    </div>
  )
}

function MovementTiles({ movements }: { movements: Array<Movement> }) {
  const grouped = countBy(movements, (movement) => movement.event.kind)
  if (movements.length === 0)
    return <p className="muted-copy">No events recorded.</p>
  return (
    <div className="movement-tiles">
      {[...grouped.entries()]
        .sort((left, right) => right[1] - left[1])
        .map(([kind, count]) => (
          <div key={kind}>
            <span>{movementGlyph(kind)}</span>
            <b>{count}</b>
            <small>{titleCase(kind)}</small>
          </div>
        ))}
    </div>
  )
}

function WarningsPanel({ warnings }: { warnings: Array<string> }) {
  return (
    <section id="development-panel" className="command-warnings">
      <SectionHeading
        eyebrow="Evidence health"
        title={
          warnings.length > 0
            ? `${warnings.length} checks need attention`
            : 'Roster checks clear'
        }
        note="Unknown remains distinct from zero"
      />
      {warnings.length > 0 ? (
        <ul>
          {warnings.slice(0, 5).map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : (
        <p>No roster-limit, scholarship, or eligibility warnings.</p>
      )}
    </section>
  )
}

function RoleDots({ entries }: { entries: Array<ActiveRosterEntry> }) {
  const grouped = countBy(entries, (entry) => entry.season.role)
  return (
    <div className="role-dots" aria-label="Role distribution">
      {(['starter', 'rotation', 'reserve', 'unassigned'] as const).map(
        (role) =>
          grouped.has(role) && (
            <span
              key={role}
              data-role={role}
              title={`${grouped.get(role)} ${role}`}
            >
              {grouped.get(role)}
            </span>
          ),
      )}
    </div>
  )
}

function DevelopmentGrid({
  entries,
  season,
}: {
  entries: Array<ActiveRosterEntry>
  season: number
}) {
  const buckets = [
    [
      'Year 1',
      entries.filter((entry) => season - entry.player.entrySeason <= 0),
    ],
    [
      'Year 2',
      entries.filter((entry) => season - entry.player.entrySeason === 1),
    ],
    [
      'Year 3',
      entries.filter((entry) => season - entry.player.entrySeason === 2),
    ],
    [
      'Year 4+',
      entries.filter((entry) => season - entry.player.entrySeason >= 3),
    ],
  ] as const
  return (
    <div className="development-grid">
      {buckets.map(([label, rows]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{rows.length}</strong>
          <small>
            {rows.filter((entry) => entry.season.role === 'starter').length}{' '}
            starters ·{' '}
            {rows.reduce((sum, entry) => sum + entry.season.starts, 0)} starts
          </small>
        </div>
      ))}
    </div>
  )
}

function groupByRoom(entries: Array<ActiveRosterEntry>) {
  const grouped = new Map<string, Array<ActiveRosterEntry>>()
  for (const entry of entries) {
    const values = grouped.get(entry.season.positionRoom) ?? []
    values.push(entry)
    grouped.set(entry.season.positionRoom, values)
  }
  return [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )
}

function countBy<T>(rows: Array<T>, key: (row: T) => string) {
  return rows.reduce((counts, row) => {
    const value = key(row)
    counts.set(value, (counts.get(value) ?? 0) + 1)
    return counts
  }, new Map<string, number>())
}

function experienceLabel(entry: ActiveRosterEntry, season: number) {
  const years = Math.max(season - entry.player.entrySeason + 1, 1)
  return `Year ${years}`
}

function movementGlyph(kind: string) {
  if (kind === 'transfer_in' || kind === 'recruited' || kind === 'enrolled')
    return '↘'
  if (
    kind === 'transfer_out' ||
    kind === 'graduated' ||
    kind === 'retired' ||
    kind === 'dismissed' ||
    kind === 'decommitted'
  )
    return '↗'
  return '↺'
}
