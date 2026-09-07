import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useConvex, useMutation } from 'convex/react'
import { useState } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { FunctionReturnType } from 'convex/server'
import {
  AppShell,
  EmptyState,
  Metric,
  SectionTabs,
} from '~/components/AppShell'

type AdminView = 'games' | 'operations' | 'people' | 'seasons'
type Notice = { kind: 'error' | 'success'; text: string } | null
const CURRENT_SEASON = new Date().getFullYear()
const SESSION_KEY = 'cfb26-owner-session'
const DATASETS = [
  'players',
  'commitments',
  'rosterStints',
  'playerSeasons',
  'evaluations',
  'movementEvents',
  'draftOutcomes',
  'playerGames',
  'nflIdentities',
  'nflWeeklyRosters',
  'nflPlayerGames',
  'nflSeasonSummaries',
  'providerIdentities',
  'seasonRules',
  'unresolvedMatches',
] as const
type SeasonDashboard = NonNullable<
  FunctionReturnType<typeof api.rosters.getSeasonDashboard>
>
type DataHealth = FunctionReturnType<typeof api.rosterAdmin.getDataHealth>
type ExportPage = FunctionReturnType<typeof api.rosterAdmin.exportMichiganPage>

function initialToken() {
  return typeof window === 'undefined'
    ? ''
    : (window.localStorage.getItem(SESSION_KEY) ?? '')
}

export function RosterAdmin() {
  const [token, setToken] = useState(initialToken)
  const login = useMutation(api.rosterAdmin.login)
  const [notice, setNotice] = useState<Notice>(null)

  if (!token) {
    return (
      <AppShell
        active="admin"
        eyebrow="Private owner area"
        title="One editor. Every consequential workflow."
      >
        <form
          className="mx-auto max-w-md border-t-8 border-[#ffcb05] bg-white p-7 shadow-xl"
          onSubmit={(event) => {
            event.preventDefault()
            const password = String(
              new FormData(event.currentTarget).get('password') ?? '',
            )
            void login({ password })
              .then((session) => {
                window.localStorage.setItem(SESSION_KEY, session.token)
                setToken(session.token)
              })
              .catch((error: unknown) =>
                setNotice({ kind: 'error', text: message(error) }),
              )
          }}
        >
          <h2 className="font-serif text-3xl font-black text-[#00274c]">
            Owner sign in
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The password is exchanged for a revocable 12-hour session. It is
            never stored in the browser.
          </p>
          <label className="mt-6 block text-xs font-black uppercase tracking-[0.12em]">
            Owner password
            <input
              name="password"
              type="password"
              required
              className={inputClass}
            />
          </label>
          {notice && <NoticeBox notice={notice} />}
          <button className={primaryButton}>Open administration</button>
        </form>
      </AppShell>
    )
  }
  return (
    <AuthenticatedAdmin
      token={token}
      onExpire={() => {
        window.localStorage.removeItem(SESSION_KEY)
        setToken('')
      }}
    />
  )
}

function AuthenticatedAdmin({
  token,
  onExpire,
}: {
  token: string
  onExpire: () => void
}) {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const [view, setView] = useState<AdminView>('people')
  const [notice, setNotice] = useState<Notice>(null)
  const session = useQuery(
    convexQuery(api.rosterAdmin.sessionStatus, { sessionToken: token }),
  )
  const roster = useQuery(
    convexQuery(api.rosters.getSeasonDashboard, {
      programKey: 'michigan',
      season,
    }),
  )
  const games = useQuery(
    convexQuery(api.games.listProgramGames, {
      fromSeason: season,
      limit: 40,
      programKey: 'michigan',
      toSeason: season,
    }),
  )
  const health = useQuery(
    convexQuery(api.rosterAdmin.getDataHealth, { sessionToken: token }),
  )
  const logout = useMutation(api.rosterAdmin.logout)
  const revokeAll = useMutation(api.rosterAdmin.revokeAllOwnerSessions)
  if (session.data && !session.data.authenticated) {
    onExpire()
    return null
  }
  const data = roster.data
  return (
    <AppShell
      active="admin"
      eyebrow="Authenticated owner workspace"
      title="Record reality, then verify the system agrees."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.12em]">
          Season
          <select
            value={season}
            onChange={(event) => setSeason(Number(event.target.value))}
            className="border border-slate-400 bg-white px-3 py-2 text-sm"
          >
            <option>{CURRENT_SEASON + 1}</option>
            {Array.from({ length: CURRENT_SEASON - 2014 }, (_, index) => (
              <option key={index}>{CURRENT_SEASON - index}</option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void logout({ sessionToken: token }).finally(onExpire)
            }
            className={secondaryButton}
          >
            Sign out
          </button>
          <button
            type="button"
            onClick={() =>
              window.confirm('Revoke every owner session?') &&
              void revokeAll({ sessionToken: token }).finally(onExpire)
            }
            className={secondaryButton}
          >
            Revoke all
          </button>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Player Seasons" value={data?.entries.length ?? '—'} />
        <Metric
          label="Open matches"
          value={health.data?.unresolved.length ?? '—'}
        />
        <Metric
          label="Sync failures"
          value={
            health.data?.sync.filter((row) => row.status === 'failed').length ??
            '—'
          }
        />
        <Metric
          label="Verified backups"
          value={health.data?.backups.length ?? '—'}
        />
      </div>
      {notice && <NoticeBox notice={notice} />}
      <SectionTabs
        active={view}
        onChange={setView}
        tabs={[
          { id: 'people', label: 'People & lifecycle' },
          { id: 'seasons', label: 'Player Seasons' },
          { id: 'games', label: 'Player Games' },
          { id: 'operations', label: 'Operations' },
        ]}
      />
      {view === 'people' && (
        <People
          token={token}
          season={season}
          data={data ?? null}
          notify={setNotice}
        />
      )}
      {view === 'seasons' && (
        <PlayerSeasons
          token={token}
          season={season}
          data={data ?? null}
          notify={setNotice}
        />
      )}
      {view === 'games' && (
        <PlayerGames
          token={token}
          backupManifestId={health.data?.backups[0]?._id ?? null}
          data={data ?? null}
          games={games.data?.games ?? []}
          notify={setNotice}
        />
      )}
      {view === 'operations' && (
        <Operations
          token={token}
          season={season}
          data={data ?? null}
          health={health.data}
          notify={setNotice}
        />
      )}
    </AppShell>
  )
}

function People({
  token,
  season,
  data,
  notify,
}: {
  token: string
  season: number
  data: SeasonDashboard | null
  notify: (notice: Notice) => void
}) {
  const createPerson = useMutation(api.rosterAdmin.createPerson)
  const addEvaluation = useMutation(api.rosterAdmin.addEvaluation)
  const setCommitment = useMutation(api.rosterAdmin.setCommitmentStatus)
  const startStint = useMutation(api.rosterAdmin.startStint)
  const recordDeparture = useMutation(api.rosterAdmin.recordDeparture)
  const upsertDraft = useMutation(api.rosterAdmin.upsertDraftOutcome)
  const upsertNfl = useMutation(api.rosterAdmin.upsertNflIdentity)
  const upsertNflWeek = useMutation(api.rosterAdmin.upsertNflWeeklyRoster)
  const programs = useQuery(
    convexQuery(api.teamData.listPrograms, { limit: 500 }),
  )
  const [playerId, setPlayerId] = useState('')
  const lifecyclePeople = [
    ...(data?.entries.map((entry) => entry.player).filter(Boolean) ?? []),
    ...(data?.commitments.map((entry) => entry.player).filter(Boolean) ?? []),
  ].filter(
    (player, index, rows) =>
      rows.findIndex((candidate) => candidate?._id === player?._id) === index,
  )
  const selectedEntry = data?.entries.find(
    (entry) => entry.player?._id === playerId,
  )
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AdminCard
        title="Create a person"
        note="Commitment and enrollment remain separate. Only these five facts are required."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            void createPerson({
              canonicalName: value(form, 'name'),
              entryMethod: value(form, 'method') as
                'high_school' | 'transfer' | 'walk_on' | 'legacy',
              entrySeason: Number(value(form, 'season')),
              initialPosition: value(form, 'position'),
              state: value(form, 'state') as 'prospect' | 'enrolled' | 'alumni',
              sessionToken: token,
            })
              .then((result) => {
                setPlayerId(String(result.playerId))
                notify(success('Person created.'))
              })
              .catch((error: unknown) => notify(failure(error)))
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <Field label="Canonical name" name="name" required />
          <Field
            label="Entry season"
            name="season"
            type="number"
            defaultValue={CURRENT_SEASON}
            required
          />
          <Field
            label="Initial position"
            name="position"
            defaultValue="ATH"
            required
          />
          <Select
            label="Entry method"
            name="method"
            options={['high_school', 'transfer', 'walk_on', 'legacy']}
          />
          <Select
            label="State"
            name="state"
            options={['prospect', 'enrolled', 'alumni']}
          />
          <div className="self-end">
            <button className={primaryButton}>Create person</button>
          </div>
        </form>
      </AdminCard>
      <AdminCard
        title="Lifecycle"
        note="Enroll or decommit prospects, open another Michigan stint, and record a final departure without collapsing the person's history."
      >
        <label className="block text-xs font-black uppercase tracking-[0.12em]">
          Person
          <select
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
            className={inputClass}
          >
            <option value="">Choose a person</option>
            {lifecyclePeople.map(
              (player) =>
                player && (
                  <option key={player._id} value={player._id}>
                    {player.displayName}
                  </option>
                ),
            )}
          </select>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!playerId}
            className={secondaryButton}
            onClick={() =>
              void setCommitment({
                playerId: playerId as Id<'players'>,
                season,
                sessionToken: token,
                status: 'enrolled',
              })
                .then(() => notify(success('Prospect enrolled.')))
                .catch((error: unknown) => notify(failure(error)))
            }
          >
            Enroll prospect
          </button>
          <button
            type="button"
            disabled={!playerId}
            className={secondaryButton}
            onClick={() =>
              void setCommitment({
                playerId: playerId as Id<'players'>,
                season,
                sessionToken: token,
                status: 'decommitted',
              })
                .then(() => notify(success('Decommitment recorded.')))
                .catch((error: unknown) => notify(failure(error)))
            }
          >
            Record decommitment
          </button>
          <button
            type="button"
            disabled={!playerId}
            className={secondaryButton}
            onClick={() => {
              const position = window.prompt(
                'Initial position for the new stint',
                selectedEntry?.season.listedPosition ?? 'ATH',
              )
              if (!position) return
              void startStint({
                entryMethod: 'transfer',
                initialPosition: position,
                playerId: playerId as Id<'players'>,
                season,
                sessionToken: token,
              })
                .then(() => notify(success('Michigan stint started.')))
                .catch((error: unknown) => notify(failure(error)))
            }}
          >
            Start another stint
          </button>
          <button
            type="button"
            disabled={!selectedEntry}
            className={secondaryButton}
            onClick={() =>
              selectedEntry &&
              void recordDeparture({
                finalSeason: season,
                kind: 'graduated',
                playerId: selectedEntry.player!._id,
                sessionToken: token,
                stintId: selectedEntry.season.stintId,
              })
                .then(() => notify(success('Departure recorded.')))
                .catch((error: unknown) => notify(failure(error)))
            }
          >
            Record graduation
          </button>
        </div>
      </AdminCard>
      <AdminCard
        title="Evaluation event"
        note="Recruiting, transfer, draft, and owner evaluations are dated, repeatable evidence."
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            void addEvaluation({
              dataQuality: 'owner_verified',
              direction: value(form, 'direction') as
                'inbound' | 'outbound' | 'neutral',
              evaluatedAt: Date.parse(value(form, 'date')),
              kind: value(form, 'kind') as
                'recruiting' | 'transfer' | 'draft' | 'owner',
              notes: value(form, 'notes') || undefined,
              playerId: playerId as Id<'players'>,
              provider: value(form, 'provider'),
              rank: nullableNumber(form, 'rank'),
              scale: value(form, 'scale'),
              score: nullableNumber(form, 'score'),
              sessionToken: token,
            })
              .then(() => notify(success('Evaluation event added.')))
              .catch((error: unknown) => notify(failure(error)))
          }}
        >
          <Select
            label="Kind"
            name="kind"
            options={['recruiting', 'transfer', 'draft', 'owner']}
          />
          <Select
            label="Direction"
            name="direction"
            options={['inbound', 'outbound', 'neutral']}
          />
          <Field
            label="Provider"
            name="provider"
            defaultValue="CFB26"
            required
          />
          <Field
            label="Date"
            name="date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          <Field label="Scale" name="scale" defaultValue="0-100" required />
          <Field label="Score" name="score" type="number" step="0.1" />
          <Field label="Rank" name="rank" type="number" />
          <Field label="Notes" name="notes" />
          <button disabled={!playerId} className={primaryButton}>
            Add evaluation
          </button>
        </form>
      </AdminCard>
      <AdminCard
        title="Draft and NFL gap fill"
        note="Link the Michigan person to nflverse, record entry outcomes, and fill an individual weekly roster gap."
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const providerId = value(form, 'providerId')
            void upsertNfl({
              entryPath: value(form, 'entryPath') as
                | 'drafted'
                | 'undrafted_free_agent'
                | 'practice_squad'
                | 'later_entry',
              firstSeason: Number(value(form, 'firstSeason')),
              playerId: playerId as Id<'players'>,
              providerId,
              sessionToken: token,
            })
              .then(() => notify(success('NFL identity linked.')))
              .catch((error: unknown) => notify(failure(error)))
          }}
        >
          <Field label="nflverse GSIS ID" name="providerId" required />
          <Select
            label="Entry path"
            name="entryPath"
            options={[
              'drafted',
              'undrafted_free_agent',
              'practice_squad',
              'later_entry',
            ]}
          />
          <Field
            label="First NFL season"
            name="firstSeason"
            type="number"
            defaultValue={CURRENT_SEASON}
            required
          />
          <button disabled={!playerId} className={primaryButton}>
            Link identity
          </button>
        </form>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={!playerId}
            className={secondaryButton}
            onClick={() =>
              void upsertDraft({
                overallPick: null,
                playerId: playerId as Id<'players'>,
                round: null,
                sessionToken: token,
                status: 'undrafted_free_agent',
                year: CURRENT_SEASON,
              })
                .then(() => notify(success('UDFA outcome saved.')))
                .catch((error: unknown) => notify(failure(error)))
            }
          >
            Record UDFA
          </button>
          <button
            type="button"
            disabled={!playerId}
            className={secondaryButton}
            onClick={() => {
              const team = window.prompt('NFL team abbreviation')
              const week = window.prompt('NFL week')
              if (!team || !week) return
              void upsertNflWeek({
                playerId: playerId as Id<'players'>,
                season: CURRENT_SEASON,
                sessionToken: token,
                status: 'active',
                team,
                week: Number(week),
              })
                .then(() => notify(success('NFL weekly roster gap saved.')))
                .catch((error: unknown) => notify(failure(error)))
            }}
          >
            Fill NFL roster week
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {programs.data?.length ?? 0} national programs are available for
          transfer identity context.
        </p>
      </AdminCard>
    </div>
  )
}

function PlayerSeasons({
  token,
  season,
  data,
  notify,
}: {
  token: string
  season: number
  data: SeasonDashboard | null
  notify: (notice: Notice) => void
}) {
  const upsert = useMutation(api.rosterAdmin.upsertPlayerSeason)
  const [selectedId, setSelectedId] = useState('')
  const selected = data?.entries.find(
    (entry) => entry.player?._id === selectedId,
  )
  if (!data) return <EmptyState>No roster is available for editing.</EmptyState>
  return (
    <AdminCard
      title="Season record, depth and eligibility"
      note="Every annual value is explicit. Unknown scholarship and availability states remain visible."
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          if (!selected?.player) return
          const form = new FormData(event.currentTarget)
          void upsert({
            availabilityNote: value(form, 'availability') || undefined,
            captain: form.get('captain') === 'on',
            dataQuality: 'owner_verified',
            depthStatus: value(form, 'depthStatus') as
              'available' | 'limited' | 'out' | 'unknown',
            eligibleThroughSeasonOverride: nullableNumber(
              form,
              'eligibleThrough',
            ),
            eligibilityEvidence: selected.season.eligibilityEvidence,
            gamesPlayed: Number(value(form, 'gamesPlayed')),
            heightInches: nullableNumber(form, 'height'),
            honors: value(form, 'honors')
              .split(',')
              .map((item) => item.trim())
              .filter(Boolean),
            jerseyNumber: nullableNumber(form, 'jersey'),
            listedPosition: value(form, 'position'),
            playerId: selected.player._id,
            roomOrder: nullableNumber(form, 'roomOrder'),
            role: value(form, 'role') as
              'starter' | 'rotation' | 'reserve' | 'unassigned',
            rosterStatus: value(form, 'rosterStatus') as
              'active' | 'inactive' | 'departed',
            scholarshipStatus: value(form, 'scholarship') as
              'scholarship' | 'walk_on' | 'exempt' | 'unknown',
            season,
            sessionToken: token,
            sourceLinks: [],
            starts: Number(value(form, 'starts')),
            stintId: selected.season.stintId,
            weightPounds: nullableNumber(form, 'weight'),
          })
            .then(() => notify(success('Player Season saved.')))
            .catch((error: unknown) => notify(failure(error)))
        }}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <label className="sm:col-span-2 lg:col-span-4 text-xs font-black uppercase tracking-[0.12em]">
          Player
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className={inputClass}
            required
          >
            <option value="">Choose a player</option>
            {data.entries.map(
              (entry) =>
                entry.player && (
                  <option key={entry.player._id} value={entry.player._id}>
                    {entry.player.displayName}
                  </option>
                ),
            )}
          </select>
        </label>
        {selected && (
          <>
            <Field
              label="Jersey"
              name="jersey"
              type="number"
              defaultValue={selected.season.jerseyNumber ?? ''}
            />
            <Field
              label="Position"
              name="position"
              defaultValue={selected.season.listedPosition}
              required
            />
            <Field
              label="Height (in)"
              name="height"
              type="number"
              defaultValue={selected.season.heightInches ?? ''}
            />
            <Field
              label="Weight"
              name="weight"
              type="number"
              defaultValue={selected.season.weightPounds ?? ''}
            />
            <Select
              label="Role"
              name="role"
              options={['starter', 'rotation', 'reserve', 'unassigned']}
              defaultValue={selected.season.role}
            />
            <Field
              label="Room order"
              name="roomOrder"
              type="number"
              defaultValue={selected.season.roomOrder ?? ''}
            />
            <Select
              label="Scholarship"
              name="scholarship"
              options={['scholarship', 'walk_on', 'exempt', 'unknown']}
              defaultValue={selected.season.scholarshipStatus}
            />
            <Select
              label="Availability"
              name="depthStatus"
              options={['available', 'limited', 'out', 'unknown']}
              defaultValue={selected.season.depthStatus}
            />
            <Select
              label="Roster status"
              name="rosterStatus"
              options={['active', 'inactive', 'departed']}
              defaultValue={selected.season.rosterStatus}
            />
            <Field
              label="Games played"
              name="gamesPlayed"
              type="number"
              defaultValue={selected.season.gamesPlayed}
              required
            />
            <Field
              label="Starts"
              name="starts"
              type="number"
              defaultValue={selected.season.starts}
              required
            />
            <Field
              label="Eligible through override"
              name="eligibleThrough"
              type="number"
              defaultValue={selected.season.eligibleThroughSeasonOverride ?? ''}
            />
            <Field
              label="Availability note"
              name="availability"
              defaultValue={selected.season.availabilityNote ?? ''}
            />
            <Field
              label="Honors (comma separated)"
              name="honors"
              defaultValue={selected.season.honors.join(', ')}
            />
            <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold">
              <input
                name="captain"
                type="checkbox"
                defaultChecked={selected.season.captain}
              />{' '}
              Captain
            </label>
            <div className="self-end">
              <button className={primaryButton}>Save season</button>
            </div>
          </>
        )}
      </form>
    </AdminCard>
  )
}

function PlayerGames({
  token,
  backupManifestId,
  data,
  games,
  notify,
}: {
  token: string
  backupManifestId: Id<'backupManifests'> | null
  data: SeasonDashboard | null
  games: Array<{
    _id: Id<'collegeGames'>
    awaySourceName: string
    homeSourceName: string
    week: number
  }>
  notify: (notice: Notice) => void
}) {
  const upsert = useMutation(api.seasonalStats.upsertPlayerGame)
  const applyImport = useMutation(api.seasonalStats.applyImport)
  const client = useConvex()
  const [importText, setImportText] = useState('[]')
  const [importPreview, setImportPreview] = useState('')
  if (!data)
    return <EmptyState>No Michigan Player Seasons are available.</EmptyState>
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AdminCard
        title="Michigan Player Game"
        note="Blank means unknown. Explicit zero means no snaps and rejects a grade. Grades are CFB26-authored on a 0–100 scale."
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const phase = (prefix: string) => ({
              grade: nullableNumber(form, `${prefix}Grade`),
              snaps: nullableNumber(form, `${prefix}Snaps`),
            })
            let statistics: Array<{ category: string; value: number }> = []
            try {
              statistics = JSON.parse(
                value(form, 'statistics') || '[]',
              ) as typeof statistics
            } catch {
              notify({ kind: 'error', text: 'Statistics must be valid JSON.' })
              return
            }
            void upsert({
              dataQuality: 'owner_verified',
              defense: phase('defense'),
              gameId: value(form, 'gameId') as Id<'collegeGames'>,
              offense: phase('offense'),
              playerId: value(form, 'playerId') as Id<'players'>,
              sessionToken: token,
              sourceLinks: [],
              specialTeams: phase('specialTeams'),
              statistics,
            })
              .then(() => notify(success('Player Game saved.')))
              .catch((error: unknown) => notify(failure(error)))
          }}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className="sm:col-span-2 text-xs font-black uppercase tracking-[0.12em]">
            Player
            <select name="playerId" className={inputClass} required>
              <option value="">Choose a player</option>
              {data.entries.map(
                (entry) =>
                  entry.player && (
                    <option key={entry.player._id} value={entry.player._id}>
                      {entry.player.displayName}
                    </option>
                  ),
              )}
            </select>
          </label>
          <label className="sm:col-span-2 text-xs font-black uppercase tracking-[0.12em]">
            Game
            <select name="gameId" className={inputClass} required>
              <option value="">Choose a game</option>
              {games.map((game) => (
                <option key={game._id} value={game._id}>
                  W{game.week} · {game.awaySourceName} at {game.homeSourceName}
                </option>
              ))}
            </select>
          </label>
          {(['offense', 'defense', 'specialTeams'] as const).map((phase) => (
            <div key={phase} className="contents">
              <Field
                label={`${phase} snaps`}
                name={`${phase}Snaps`}
                type="number"
              />
              <Field
                label={`${phase} grade`}
                name={`${phase}Grade`}
                type="number"
                step="0.1"
              />
            </div>
          ))}
          <label className="sm:col-span-2 text-xs font-black uppercase tracking-[0.12em]">
            Conventional statistics JSON
            <textarea
              name="statistics"
              rows={3}
              defaultValue="[]"
              className={inputClass}
            />
          </label>
          <div className="self-end">
            <button className={primaryButton}>Save Player Game</button>
          </div>
        </form>
      </AdminCard>
      <AdminCard
        title="Player Game bulk import"
        note="Paste normalized JSON, inspect the no-write validation, then apply with the latest verified Michigan backup."
      >
        <textarea
          value={importText}
          onChange={(event) => {
            setImportText(event.target.value)
            setImportPreview('')
          }}
          rows={12}
          className={inputClass}
          aria-label="Player Game import JSON"
        />
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              try {
                const rows = JSON.parse(importText) as Array<never>
                void client
                  .query(api.seasonalStats.previewImport, {
                    rows,
                    sessionToken: token,
                  })
                  .then((result) =>
                    setImportPreview(JSON.stringify(result, null, 2)),
                  )
                  .catch((error: unknown) => notify(failure(error)))
              } catch {
                notify({ kind: 'error', text: 'Import must be valid JSON.' })
              }
            }}
          >
            Dry run
          </button>
          <button
            type="button"
            disabled={!backupManifestId || !importPreview}
            className={primaryButton}
            onClick={() => {
              if (!backupManifestId) return
              try {
                const rows = JSON.parse(importText) as Array<never>
                void applyImport({
                  backupManifestId,
                  rows,
                  sessionToken: token,
                })
                  .then((result) =>
                    notify(
                      success(`${result.upserted} Player Games imported.`),
                    ),
                  )
                  .catch((error: unknown) => notify(failure(error)))
              } catch {
                notify({ kind: 'error', text: 'Import must be valid JSON.' })
              }
            }}
          >
            Apply import
          </button>
        </div>
        {importPreview && (
          <pre className="mt-4 max-h-72 overflow-auto bg-slate-950 p-3 text-xs text-emerald-300">
            {importPreview}
          </pre>
        )}
      </AdminCard>
    </div>
  )
}

function Operations({
  token,
  season,
  data,
  health,
  notify,
}: {
  token: string
  season: number
  data: SeasonDashboard | null
  health: DataHealth | undefined
  notify: (notice: Notice) => void
}) {
  const client = useConvex()
  const createManifest = useMutation(api.rosterAdmin.createBackupManifest)
  const applyRollover = useMutation(api.rosterAdmin.applyRollover)
  const mergePlayers = useMutation(api.rosterAdmin.mergePlayers)
  const deletePerson = useMutation(api.rosterAdmin.deleteErroneousPerson)
  const upsertRules = useMutation(api.rosterAdmin.upsertSeasonRules)
  const setChampion = useMutation(api.rosterAdmin.setConferenceChampion)
  const resolveIdentity = useMutation(api.rosterAdmin.resolveProviderIdentity)
  const programs = useQuery(
    convexQuery(api.teamData.listPrograms, { limit: 500 }),
  )
  const [backupId, setBackupId] = useState<Id<'backupManifests'> | null>(
    health?.backups[0]?._id ?? null,
  )
  const [rolloverPreview, setRolloverPreview] = useState<string>('')
  const [importText, setImportText] = useState('[]')
  const [preview, setPreview] = useState<string>('')
  const exportBackup = async () => {
    try {
      const exported: Record<string, Array<unknown>> = {}
      for (const dataset of DATASETS) {
        let cursor: string | null = null
        const rows: Array<unknown> = []
        do {
          const page: ExportPage = await client.query(
            api.rosterAdmin.exportMichiganPage,
            { cursor, dataset, numItems: 100, sessionToken: token },
          )
          rows.push(...page.page)
          cursor = page.isDone ? null : page.continueCursor
        } while (cursor)
        exported[dataset] = rows
      }
      const backupCore = { schemaVersion: '2', datasets: exported }
      const canonical = JSON.stringify(backupCore)
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(canonical),
      )
      const fingerprint = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
      const manifestId = await createManifest({
        counts: Object.entries(exported).map(([dataset, rows]) => ({
          count: rows.length,
          dataset,
        })),
        fingerprint,
        reason: 'Owner export before material operation',
        schemaVersion: '2',
        sessionToken: token,
      })
      setBackupId(manifestId)
      const payload = JSON.stringify(
        { ...backupCore, exportedAt: new Date().toISOString(), fingerprint },
        null,
        2,
      )
      const url = URL.createObjectURL(
        new Blob([payload], { type: 'application/json' }),
      )
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `cfb26-michigan-${Date.now()}.json`
      anchor.click()
      URL.revokeObjectURL(url)
      notify(success('Backup downloaded and manifest verified.'))
    } catch (error) {
      notify(failure(error))
    }
  }
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <AdminCard
        title="Backup & rollover"
        note="Material writes require a verified backup manifest. Restore uses the validated Convex import runbook."
      >
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={primaryButton}
            onClick={() => void exportBackup()}
          >
            Export Michigan data
          </button>
          <button
            type="button"
            className={secondaryButton}
            onClick={() =>
              void client
                .query(api.rosterAdmin.previewRollover, {
                  fromSeason: season,
                  programKey: 'michigan',
                  sessionToken: token,
                })
                .then((result) =>
                  setRolloverPreview(JSON.stringify(result, null, 2)),
                )
                .catch((error: unknown) => notify(failure(error)))
            }
          >
            Preview rollover
          </button>
          <button
            type="button"
            disabled={!backupId || !rolloverPreview}
            className={secondaryButton}
            onClick={() =>
              backupId &&
              void applyRollover({
                backupManifestId: backupId,
                fromSeason: season,
                programKey: 'michigan',
                sessionToken: token,
              })
                .then((result) => {
                  setRolloverPreview('')
                  notify(
                    success(
                      `${result.created} Player Seasons rolled into ${result.season}.`,
                    ),
                  )
                })
                .catch((error: unknown) => notify(failure(error)))
            }
          >
            Apply season rollover
          </button>
        </div>
        <p className="mt-3 break-all text-xs text-slate-500">
          Backup manifest: {backupId ?? 'none in this session'}
        </p>
        {rolloverPreview && (
          <pre className="mt-4 max-h-52 overflow-auto bg-slate-950 p-3 text-xs text-emerald-300">
            {rolloverPreview}
          </pre>
        )}
      </AdminCard>
      <AdminCard
        title="Validated roster import"
        note="Paste JSON rows, run the dry run, then apply only with a verified backup."
      >
        <textarea
          value={importText}
          onChange={(event) => setImportText(event.target.value)}
          rows={7}
          className={inputClass}
          aria-label="Roster import JSON"
        />
        <div className="mt-3 flex gap-3">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              try {
                const rows = JSON.parse(importText) as Array<never>
                void client
                  .query(api.rosterAdmin.previewRosterImport, {
                    rows,
                    sessionToken: token,
                  })
                  .then((result) => setPreview(JSON.stringify(result, null, 2)))
                  .catch((error: unknown) => notify(failure(error)))
              } catch {
                notify({ kind: 'error', text: 'Import must be valid JSON.' })
              }
            }}
          >
            Dry run
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={!backupId || !preview}
            onClick={() => {
              if (!backupId) return
              const rows = JSON.parse(importText) as Array<never>
              void client
                .mutation(api.rosterAdmin.applyRosterImport, {
                  backupManifestId: backupId,
                  programKey: 'michigan',
                  rows,
                  sessionToken: token,
                })
                .then((result) =>
                  notify(
                    success(
                      `${result.created.length} created; ${result.matched.length} matched.`,
                    ),
                  ),
                )
                .catch((error: unknown) => notify(failure(error)))
            }}
          >
            Apply import
          </button>
        </div>
        {preview && (
          <pre className="mt-4 max-h-52 overflow-auto bg-slate-950 p-3 text-xs text-emerald-300">
            {preview}
          </pre>
        )}
      </AdminCard>
      <AdminCard
        title="Source health"
        note="Failures retain the last valid data. Core failures block official publication; enrichment failures remain visible."
      >
        <div className="divide-y divide-slate-200">
          {(health?.sync ?? []).map((row) => (
            <div
              key={row._id}
              className="flex justify-between gap-4 py-2 text-sm"
            >
              <span className="font-bold">{row.source}</span>
              <span
                className={
                  row.status === 'failed' ? 'text-red-700' : 'text-emerald-700'
                }
              >
                {row.status}
                {row.error ? ` · ${row.error}` : ''}
              </span>
            </div>
          ))}
        </div>
      </AdminCard>
      <AdminCard
        title="Identity queue"
        note="Provider records remain unresolved until the owner confirms a canonical person; the system never guesses."
      >
        {(health?.unresolved ?? []).length === 0 ? (
          <p className="text-sm text-slate-500">No unresolved identities.</p>
        ) : (
          <div className="space-y-2">
            {health?.unresolved.map((row) => (
              <form
                key={row._id}
                className="bg-slate-50 p-3 text-sm"
                onSubmit={(event) => {
                  event.preventDefault()
                  const playerId = value(
                    new FormData(event.currentTarget),
                    'playerId',
                  )
                  void resolveIdentity({
                    matchId: row._id,
                    playerId: playerId as Id<'players'>,
                    sessionToken: token,
                  })
                    .then(() => notify(success('Provider identity resolved.')))
                    .catch((error: unknown) => notify(failure(error)))
                }}
              >
                <b>{row.label}</b>
                <div>
                  {row.provider} · {row.reason}
                </div>
                <div className="mt-2 flex gap-2">
                  <select name="playerId" className={inputClass} required>
                    <option value="">Canonical person</option>
                    {data?.entries.map(
                      (entry) =>
                        entry.player && (
                          <option
                            key={entry.player._id}
                            value={entry.player._id}
                          >
                            {entry.player.displayName}
                          </option>
                        ),
                    )}
                  </select>
                  <button className={secondaryButton}>Resolve</button>
                </div>
              </form>
            ))}
          </div>
        )}
      </AdminCard>
      <AdminCard
        title="Season rules & champion facts"
        note="Eligibility, roster limits, and playoff qualification use the actual rule set for each season."
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            void upsertRules({
              baseEligibilitySeasons: Number(value(form, 'eligibility')),
              clockSeasons: Number(value(form, 'clock')),
              legacyRedshirtExtendsClock: form.get('redshirt') === 'on',
              playoffByeCount: Number(value(form, 'byes')),
              playoffChampionBidCount: Number(value(form, 'championBids')),
              playoffFieldSize: Number(value(form, 'fieldSize')),
              rosterLimit: nullableNumber(form, 'rosterLimit'),
              season,
              sessionToken: token,
              version: value(form, 'version'),
            })
              .then(() => notify(success('Season rules saved.')))
              .catch((error: unknown) => notify(failure(error)))
          }}
        >
          <Field
            label="Eligibility seasons"
            name="eligibility"
            type="number"
            defaultValue={4}
            required
          />
          <Field
            label="Clock seasons"
            name="clock"
            type="number"
            defaultValue={5}
            required
          />
          <Field label="Roster limit" name="rosterLimit" type="number" />
          <Field
            label="Playoff field"
            name="fieldSize"
            type="number"
            defaultValue={12}
            required
          />
          <Field
            label="Champion bids"
            name="championBids"
            type="number"
            defaultValue={5}
            required
          />
          <Field
            label="Byes"
            name="byes"
            type="number"
            defaultValue={4}
            required
          />
          <Field
            label="Rules version"
            name="version"
            defaultValue={`${season}-official`}
            required
          />
          <label className="flex items-center gap-2 self-end pb-3 text-sm font-bold">
            <input name="redshirt" type="checkbox" defaultChecked /> Legacy
            redshirt extends clock
          </label>
          <button className={primaryButton}>Save season rules</button>
        </form>
        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            void setChampion({
              conference: value(form, 'conference'),
              programId: value(form, 'programId') as Id<'programs'>,
              season,
              sessionToken: token,
            })
              .then(() => notify(success('Conference champion saved.')))
              .catch((error: unknown) => notify(failure(error)))
          }}
        >
          <Field label="Conference" name="conference" required />
          <label className="block text-xs font-black uppercase tracking-[0.12em]">
            Champion
            <select name="programId" className={inputClass} required>
              <option value="">Choose a program</option>
              {programs.data?.map((program) => (
                <option key={program._id} value={program._id}>
                  {program.name}
                </option>
              ))}
            </select>
          </label>
          <button className={secondaryButton}>Record champion</button>
        </form>
      </AdminCard>
      <AdminCard
        title="Identity repair"
        note="Merge duplicates transactionally or delete a person created in error. Both operations require the current backup manifest."
      >
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (!backupId) return
            const form = new FormData(event.currentTarget)
            void mergePlayers({
              backupManifestId: backupId,
              sessionToken: token,
              sourcePlayerId: value(form, 'source') as Id<'players'>,
              targetPlayerId: value(form, 'target') as Id<'players'>,
            })
              .then(() => notify(success('Duplicate merged.')))
              .catch((error: unknown) => notify(failure(error)))
          }}
        >
          {(['source', 'target'] as const).map((name) => (
            <label
              key={name}
              className="block text-xs font-black uppercase tracking-[0.12em]"
            >
              {name === 'source' ? 'Duplicate to remove' : 'Canonical survivor'}
              <select name={name} className={inputClass} required>
                <option value="">Choose a person</option>
                {data?.entries.map(
                  (entry) =>
                    entry.player && (
                      <option key={entry.player._id} value={entry.player._id}>
                        {entry.player.displayName}
                      </option>
                    ),
                )}
              </select>
            </label>
          ))}
          <button disabled={!backupId} className={primaryButton}>
            Merge duplicate
          </button>
        </form>
        <div className="mt-5 border-t border-slate-200 pt-5">
          <button
            type="button"
            disabled={!backupId}
            className={secondaryButton}
            onClick={() => {
              if (!backupId) return
              const playerId = window.prompt(
                'Exact erroneous Player ID to delete',
              )
              if (
                !playerId ||
                !window.confirm(
                  'Delete this person and every dependent record?',
                )
              )
                return
              void deletePerson({
                backupManifestId: backupId,
                playerId: playerId as Id<'players'>,
                sessionToken: token,
              })
                .then(() => notify(success('Erroneous person deleted.')))
                .catch((error: unknown) => notify(failure(error)))
            }}
          >
            Delete erroneous person
          </button>
        </div>
      </AdminCard>
    </div>
  )
}

function AdminCard({
  children,
  note,
  title,
}: {
  children: React.ReactNode
  note: string
  title: string
}) {
  return (
    <section className="rounded-sm border border-slate-300 bg-white p-5 shadow-sm">
      <h2 className="font-serif text-2xl font-black text-[#00274c]">{title}</h2>
      <p className="mt-1 mb-5 text-sm leading-6 text-slate-500">{note}</p>
      {children}
    </section>
  )
}
function Field({
  label,
  name,
  ...props
}: {
  label: string
  name: string
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.12em]">
      {label}
      <input name={name} className={inputClass} {...props} />
    </label>
  )
}
function Select({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue?: string
  label: string
  name: string
  options: Array<string>
}) {
  return (
    <label className="block text-xs font-black uppercase tracking-[0.12em]">
      {label}
      <select name={name} defaultValue={defaultValue} className={inputClass}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replaceAll('_', ' ')}
          </option>
        ))}
      </select>
    </label>
  )
}
function NoticeBox({ notice }: { notice: Exclude<Notice, null> }) {
  return (
    <div
      role="status"
      className={`my-4 border-l-4 p-3 text-sm ${notice.kind === 'error' ? 'border-red-600 bg-red-50 text-red-900' : 'border-emerald-600 bg-emerald-50 text-emerald-900'}`}
    >
      {notice.text}
    </div>
  )
}
function value(form: FormData, key: string) {
  return String(form.get(key) ?? '').trim()
}
function nullableNumber(form: FormData, key: string) {
  const raw = value(form, key)
  return raw === '' ? null : Number(raw)
}
function message(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
function success(text: string): Notice {
  return { kind: 'success', text }
}
function failure(error: unknown): Notice {
  return { kind: 'error', text: message(error) }
}
const inputClass =
  'mt-2 w-full rounded-sm border border-slate-400 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal focus-visible:outline-2 focus-visible:outline-[#00274c]'
const primaryButton =
  'min-h-11 rounded-sm bg-[#00274c] px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white shadow-[3px_3px_0_#ffcb05] disabled:cursor-not-allowed disabled:opacity-40'
const secondaryButton =
  'min-h-11 rounded-sm border border-slate-400 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#00274c] disabled:cursor-not-allowed disabled:opacity-40'

export function RosterAdminLoading() {
  return (
    <AppShell
      active="admin"
      eyebrow="Private owner area"
      title="Loading the administration contract…"
    >
      <EmptyState>Validating owner session and data health.</EmptyState>
    </AppShell>
  )
}
export function RosterAdminError() {
  return (
    <AppShell
      active="admin"
      eyebrow="Administration unavailable"
      title="The owner workspace could not be loaded."
    >
      <EmptyState>
        Check the Convex connection and CFB26_ADMIN_KEY configuration.
      </EmptyState>
    </AppShell>
  )
}
