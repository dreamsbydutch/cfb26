import { useEffect, useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { FormEvent, ReactNode } from 'react'

type RosterEntry = FunctionReturnType<typeof api.rosters.list>[number]
type Program = FunctionReturnType<typeof api.teamData.listPrograms>[number]
type PlayerId = RosterEntry['player']['_id']
type DepthTier = NonNullable<RosterEntry['stint']['depthTierOverride']>
type InjuryKind = NonNullable<RosterEntry['stint']['injury']>['kind']
type EntrySource = 'high_school' | 'transfer' | 'walk_on'
type DepartureKind = 'transfer_out' | 'graduated' | 'retired' | 'dismissed'
type Workspace = 'edit' | 'add' | 'remove'
type FormMessage = { kind: 'error' | 'success'; text: string }

const CURRENT_SEASON = 2026
const inputClass =
  'w-full border border-neutral-400 bg-white px-3 py-2.5 text-sm text-neutral-950 outline-none transition placeholder:text-neutral-400 focus:border-michigan-blue focus:ring-2 focus:ring-michigan-maize disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500'
const compactInputClass = `${inputClass} tabular-nums`

const tierOptions: Array<{ label: string; value: 'automatic' | DepthTier }> = [
  { label: 'Automatic placement', value: 'automatic' },
  { label: 'Starters', value: 'starters' },
  { label: 'Rotation', value: 'rotation' },
  { label: 'Depth', value: 'depth' },
  { label: 'Prospects', value: 'prospects' },
  { label: 'Walk-ons', value: 'walk-ons' },
]

const injuryOptions: Array<{ label: string; value: 'none' | InjuryKind }> = [
  { label: 'Available — no injury', value: 'none' },
  { label: 'Short term', value: 'short_term' },
  { label: 'Long term', value: 'long_term' },
  { label: 'Out for the season', value: 'season_ending' },
]

const workspaceOptions: Array<{
  description: string
  label: string
  value: Workspace
}> = [
  {
    description: 'Depth, eligibility, position, and availability',
    label: 'Edit a player',
    value: 'edit',
  },
  {
    description: 'Recruit, transfer, or walk-on arrival',
    label: 'Add to roster',
    value: 'add',
  },
  {
    description: 'Transfer, graduation, retirement, or dismissal',
    label: 'Remove from roster',
    value: 'remove',
  },
]

const entryOptions: Array<{
  description: string
  label: string
  value: EntrySource
}> = [
  {
    description: 'Joins Michigan directly from high school.',
    label: 'Recruit',
    value: 'high_school',
  },
  {
    description: 'Arrives after playing or enrolling elsewhere.',
    label: 'Transfer',
    value: 'transfer',
  },
  {
    description: 'Joins the program without a scholarship offer.',
    label: 'Walk-on',
    value: 'walk_on',
  },
]

const departureOptions: Array<{
  description: string
  label: string
  value: DepartureKind
}> = [
  {
    description: 'Leaves Michigan for another program.',
    label: 'Transfer out',
    value: 'transfer_out',
  },
  {
    description: 'Completes the Michigan playing career.',
    label: 'Graduated',
    value: 'graduated',
  },
  {
    description: 'Ends the playing career before graduation.',
    label: 'Retired',
    value: 'retired',
  },
  {
    description: 'Is removed from the Michigan program.',
    label: 'Dismissed',
    value: 'dismissed',
  },
]

export function RosterAdmin() {
  const { data: roster } = useSuspenseQuery(
    convexQuery(api.rosters.list, {
      limit: 500,
      programKey: 'michigan',
      status: 'active',
    }),
  )
  const { data: allPrograms } = useSuspenseQuery(
    convexQuery(api.teamData.listPrograms, { limit: 500 }),
  )
  const players = useMemo(
    () =>
      [...roster].sort((left, right) =>
        left.player.displayName.localeCompare(right.player.displayName),
      ),
    [roster],
  )
  const programs = useMemo(
    () =>
      allPrograms
        .filter((program) => program.key !== 'michigan')
        .sort((left, right) => left.name.localeCompare(right.name)),
    [allPrograms],
  )
  const [workspace, setWorkspace] = useState<Workspace>('edit')
  const [adminKey, setAdminKey] = useState('')

  return (
    <main className="min-h-screen bg-michigan-cream text-michigan-blue">
      <header className="border-b-4 border-michigan-maize bg-michigan-blue text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-michigan-maize">
              Restricted roster tools
            </p>
            <h1 className="text-2xl font-black">Roster movement desk</h1>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden border-r border-white/25 pr-3 text-right sm:block">
              <strong className="block text-lg leading-none tabular-nums">
                {players.length}
              </strong>
              <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/65">
                Active players
              </span>
            </span>
            <Link
              to="/"
              className="border border-white/40 px-3 py-1.5 text-sm font-bold transition hover:border-michigan-maize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-maize"
            >
              Back to roster
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8">
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <section className="border-t-4 border-neutral-900 bg-white px-4 py-4">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">
              Single-owner access
            </p>
            <Field
              label="Admin access key"
              hint="Kept only in this page's memory and checked on every move."
            >
              <input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                autoComplete="current-password"
                className={inputClass}
              />
            </Field>
          </section>

          <nav
            aria-label="Roster admin tasks"
            className="grid gap-px bg-neutral-300"
          >
            {workspaceOptions.map((option) => {
              const selected = workspace === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setWorkspace(option.value)}
                  aria-current={selected ? 'page' : undefined}
                  className={`border-l-4 px-4 py-3 text-left transition focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue ${
                    selected
                      ? option.value === 'remove'
                        ? 'border-red-700 bg-red-50 text-red-950'
                        : 'border-michigan-blue bg-white text-michigan-blue'
                      : 'border-transparent bg-neutral-100 text-neutral-700 hover:bg-white'
                  }`}
                >
                  <span className="block text-sm font-black">
                    {option.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-neutral-500">
                    {option.description}
                  </span>
                </button>
              )
            })}
          </nav>

          <p className="border-l-2 border-neutral-400 pl-3 text-xs leading-5 text-neutral-600">
            Additions and departures write the player’s lifecycle atomically, so
            profiles, roster status, and movement history stay together.
          </p>
        </aside>

        <div className="min-w-0">
          {workspace === 'edit' && (
            <EditPlayerForm adminKey={adminKey} players={players} />
          )}
          {workspace === 'add' && (
            <AddPlayerForm adminKey={adminKey} programs={programs} />
          )}
          {workspace === 'remove' && (
            <RemovePlayerForm
              adminKey={adminKey}
              players={players}
              programs={programs}
            />
          )}
        </div>
      </div>
    </main>
  )
}

function EditPlayerForm({
  adminKey,
  players,
}: {
  adminKey: string
  players: Array<RosterEntry>
}) {
  const updatePlayer = useMutation(api.rosterAdmin.updatePlayer)
  const [selectedId, setSelectedId] = useState<PlayerId | undefined>(
    players[0]?.player._id,
  )
  const selected = players.find((entry) => entry.player._id === selectedId)
  const selectedProfile = useQuery(
    api.players.getProfile,
    selected ? { playerId: selected.player._id } : 'skip',
  )
  const [depthTier, setDepthTier] = useState<'automatic' | DepthTier>(
    'automatic',
  )
  const [position, setPosition] = useState('')
  const [extraEligibility, setExtraEligibility] = useState(0)
  const [injuryKind, setInjuryKind] = useState<'none' | InjuryKind>('none')
  const [injuryNote, setInjuryNote] = useState('')
  const [expectedReturn, setExpectedReturn] = useState('')
  const [effectiveSeason, setEffectiveSeason] = useState(CURRENT_SEASON)
  const [positionChangeNote, setPositionChangeNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<FormMessage>()

  useEffect(() => {
    if (
      selectedId &&
      players.some((entry) => entry.player._id === selectedId)
    ) {
      return
    }
    setSelectedId(players[0]?.player._id)
  }, [players, selectedId])

  useEffect(() => {
    if (!selected) return
    setDepthTier(selected.stint.depthTierOverride ?? 'automatic')
    setPosition(selected.stint.position)
    setExtraEligibility(selected.stint.extraEligibilitySeasons)
    setInjuryKind(selected.stint.injury?.kind ?? 'none')
    setInjuryNote(selected.stint.injury?.note ?? '')
    setExpectedReturn(selected.stint.injury?.expectedReturn ?? '')
    setEffectiveSeason(CURRENT_SEASON)
    setPositionChangeNote('')
  }, [selected])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    setSaving(true)
    setMessage(undefined)

    try {
      await updatePlayer({
        adminKey,
        depthTier: depthTier === 'automatic' ? null : depthTier,
        effectiveSeason,
        extraEligibilitySeasons: extraEligibility,
        injury:
          injuryKind === 'none'
            ? null
            : {
                expectedReturn: expectedReturn || undefined,
                kind: injuryKind,
                note: injuryNote || undefined,
              },
        playerId: selected.player._id,
        position,
        positionChangeNote: positionChangeNote || undefined,
        programKey: 'michigan',
      })
      setMessage({
        kind: 'success',
        text: `${selected.player.displayName} was updated.`,
      })
      setPositionChangeNote('')
    } catch (error) {
      setMessage({ kind: 'error', text: adminErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <WorkspacePanel
      eyebrow="Player maintenance"
      title="Edit an active player"
      description="Adjust current roster facts without rewriting the player’s arrival or history."
    >
      {players.length === 0 ? (
        <EmptyRoster />
      ) : (
        <form onSubmit={save} className="space-y-8">
          <PlayerPicker
            players={players}
            selectedId={selectedId}
            onSelect={(playerId) => {
              setSelectedId(playerId)
              setMessage(undefined)
            }}
          />

          {selected && (
            <>
              <PlayerSummary
                entry={selected}
                recruitingSeason={selectedProfile?.recruiting?.recruitingSeason}
              />

              <EditorSection
                title="Depth chart and eligibility"
                description="Automatic placement uses position, roster order, acquisition type, and roster year. An override always wins."
              >
                <Field label="Depth-chart section">
                  <select
                    value={depthTier}
                    onChange={(event) =>
                      setDepthTier(
                        event.target.value as 'automatic' | DepthTier,
                      )
                    }
                    className={inputClass}
                  >
                    {tierOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Extra eligibility seasons"
                  hint="Owner-granted time beyond the standard window and medical extensions."
                >
                  <input
                    type="number"
                    min={0}
                    max={5}
                    step={1}
                    value={extraEligibility}
                    onChange={(event) =>
                      setExtraEligibility(
                        event.currentTarget.valueAsNumber || 0,
                      )
                    }
                    className={compactInputClass}
                  />
                </Field>
                <div className="self-end border-l-4 border-michigan-maize bg-neutral-100 px-3 py-2.5 text-sm text-neutral-600">
                  Eligibility ends in{' '}
                  <strong className="text-neutral-950 tabular-nums">
                    {selected.stint.eligibilityStartSeason +
                      4 +
                      selected.stint.medicalExtensionSeasons +
                      extraEligibility}
                  </strong>
                </div>
              </EditorSection>

              <EditorSection
                title="Position change"
                description="Changing the position records the old and new labels in the player’s public history."
              >
                <Field label="Current position">
                  <input
                    value={position}
                    onChange={(event) => setPosition(event.target.value)}
                    maxLength={16}
                    className={inputClass}
                    required
                  />
                </Field>
                <Field label="Effective season">
                  <input
                    type="number"
                    min={1900}
                    max={2100}
                    value={effectiveSeason}
                    onChange={(event) =>
                      setEffectiveSeason(
                        event.currentTarget.valueAsNumber || CURRENT_SEASON,
                      )
                    }
                    className={compactInputClass}
                    required
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field
                    label="Position-change note"
                    hint="Optional, public, and limited to 160 characters."
                  >
                    <input
                      value={positionChangeNote}
                      onChange={(event) =>
                        setPositionChangeNote(event.target.value)
                      }
                      maxLength={160}
                      placeholder="Why or when the move was made"
                      className={inputClass}
                    />
                  </Field>
                </div>
                {selected.stint.positionChanges &&
                  selected.stint.positionChanges.length > 0 && (
                    <div className="md:col-span-2">
                      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
                        Recorded changes
                      </p>
                      <ul className="mt-1 divide-y divide-neutral-200 border-y border-neutral-300 text-sm">
                        {[...selected.stint.positionChanges]
                          .reverse()
                          .map((change) => (
                            <li key={change.recordedAt} className="py-2">
                              <strong>
                                {change.fromPosition} → {change.toPosition}
                              </strong>{' '}
                              · {change.effectiveSeason}
                              {change.note ? ` · ${change.note}` : ''}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
              </EditorSection>

              <EditorSection
                title="Availability"
                description="The current injury marker is public on the roster and replaces any previous marker."
                columns="md:grid-cols-3"
              >
                <Field label="Injury status">
                  <select
                    value={injuryKind}
                    onChange={(event) =>
                      setInjuryKind(event.target.value as 'none' | InjuryKind)
                    }
                    className={inputClass}
                  >
                    {injuryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Expected return"
                  hint="Optional; for example, Week 4."
                >
                  <input
                    value={expectedReturn}
                    onChange={(event) => setExpectedReturn(event.target.value)}
                    maxLength={80}
                    disabled={injuryKind === 'none'}
                    placeholder="Week 4"
                    className={inputClass}
                  />
                </Field>
                <Field label="Injury note" hint="Optional public roster note.">
                  <input
                    value={injuryNote}
                    onChange={(event) => setInjuryNote(event.target.value)}
                    maxLength={160}
                    disabled={injuryKind === 'none'}
                    placeholder="Availability context"
                    className={inputClass}
                  />
                </Field>
              </EditorSection>

              <FormActions
                buttonLabel="Save player changes"
                pendingLabel="Saving…"
                disabled={saving || adminKey.length === 0}
                pending={saving}
                message={message}
              />
            </>
          )}
        </form>
      )}
    </WorkspacePanel>
  )
}

function AddPlayerForm({
  adminKey,
  programs,
}: {
  adminKey: string
  programs: Array<Program>
}) {
  const addPlayer = useMutation(api.rosterAdmin.addPlayer)
  const [entrySource, setEntrySource] = useState<EntrySource>('high_school')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<FormMessage>()

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const previousProgram = programs.find(
      (program) => program._id === formText(data, 'previousProgramId'),
    )
    if (entrySource === 'transfer' && !previousProgram) {
      setMessage({
        kind: 'error',
        text: 'Choose the transfer’s previous school.',
      })
      return
    }

    setSaving(true)
    setMessage(undefined)

    try {
      const displayName = formText(data, 'displayName')
      await addPlayer({
        adminKey,
        displayName,
        eligibilityStartSeason: formNumber(data, 'eligibilityStartSeason'),
        entrySource,
        extraEligibilitySeasons: formNumber(data, 'extraEligibilitySeasons'),
        highSchool: formText(data, 'highSchool'),
        homeState: formText(data, 'homeState'),
        hometown: formText(data, 'hometown'),
        jerseyNumber: optionalFormNumber(data, 'jerseyNumber'),
        medicalExtensionSeasons: formNumber(data, 'medicalExtensionSeasons'),
        position: formText(data, 'position'),
        previousProgramId:
          entrySource === 'high_school' ? undefined : previousProgram?._id,
        programKey: 'michigan',
        recruiting: {
          compositeOverallRank: optionalFormNumber(
            data,
            'compositeOverallRank',
          ),
          compositePositionRank: optionalFormNumber(
            data,
            'compositePositionRank',
          ),
          compositeRating: optionalFormNumber(data, 'compositeRating'),
          compositeStateRank: optionalFormNumber(data, 'compositeStateRank'),
          heightInches: optionalFormNumber(data, 'recruitingHeightInches'),
          position: formText(data, 'recruitingPosition'),
          service247OverallRank: optionalFormNumber(
            data,
            'service247OverallRank',
          ),
          service247PositionRank: optionalFormNumber(
            data,
            'service247PositionRank',
          ),
          service247Rating: optionalFormNumber(data, 'service247Rating'),
          service247StateRank: optionalFormNumber(data, 'service247StateRank'),
          weightPounds: optionalFormNumber(data, 'recruitingWeightPounds'),
        },
        recruitingSeason: formNumber(data, 'recruitingSeason'),
        rosterHeightInches: optionalFormNumber(data, 'rosterHeightInches'),
        rosterWeightPounds: optionalFormNumber(data, 'rosterWeightPounds'),
        startSeason: formNumber(data, 'startSeason'),
      })
      form.reset()
      setEntrySource('high_school')
      setMessage({
        kind: 'success',
        text: `${displayName} was added to the active roster with a complete arrival record.`,
      })
    } catch (error) {
      setMessage({ kind: 'error', text: adminErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <WorkspacePanel
      eyebrow="Roster arrival"
      title="Add a player"
      description="Record the player once, then classify how and when they joined Michigan. Required fields build the active roster, profile, and movement history together."
    >
      <form onSubmit={add} className="space-y-8">
        <ChoiceGroup
          legend="How is this player joining?"
          name="entrySource"
          options={entryOptions}
          value={entrySource}
          onChange={setEntrySource}
          tone="blue"
        />

        <EditorSection
          title="Player and roster identity"
          description="Use the current Michigan position and measurements here. Recruiting measurements are recorded separately below."
          columns="md:grid-cols-3"
        >
          <div className="md:col-span-2">
            <Field label="Full name">
              <input
                name="displayName"
                maxLength={100}
                autoComplete="off"
                className={inputClass}
                required
              />
            </Field>
          </div>
          <Field label="Jersey number" hint="Optional; 0–99.">
            <input
              name="jerseyNumber"
              type="number"
              min={0}
              max={99}
              step={1}
              className={compactInputClass}
            />
          </Field>
          <Field label="Current position">
            <input
              name="position"
              maxLength={16}
              placeholder="QB"
              className={inputClass}
              required
            />
          </Field>
          <Field
            label="Roster height"
            hint="Optional, in total inches; 74 = 6′2″."
          >
            <input
              name="rosterHeightInches"
              type="number"
              min={48}
              max={96}
              step={1}
              className={compactInputClass}
            />
          </Field>
          <Field label="Roster weight" hint="Optional, in pounds.">
            <input
              name="rosterWeightPounds"
              type="number"
              min={100}
              max={500}
              step={1}
              className={compactInputClass}
            />
          </Field>
        </EditorSection>

        <EditorSection
          title="Origin"
          description="These facts identify the player and remain stable even if roster measurements or position change."
          columns="md:grid-cols-3"
        >
          <Field label="Hometown">
            <input
              name="hometown"
              maxLength={80}
              autoComplete="address-level2"
              className={inputClass}
              required
            />
          </Field>
          <Field
            label="State / region"
            hint="State code or short region label."
          >
            <input
              name="homeState"
              maxLength={24}
              autoComplete="address-level1"
              placeholder="MI"
              className={inputClass}
              required
            />
          </Field>
          <Field label="High school">
            <input
              name="highSchool"
              maxLength={120}
              autoComplete="off"
              className={inputClass}
              required
            />
          </Field>
          {entrySource !== 'high_school' && (
            <div className="md:col-span-3">
              <ProgramSelect
                label={
                  entrySource === 'transfer'
                    ? 'Previous school'
                    : 'Previous school (optional)'
                }
                name="previousProgramId"
                programs={programs}
                required={entrySource === 'transfer'}
              />
            </div>
          )}
        </EditorSection>

        <EditorSection
          title="Arrival and eligibility clocks"
          description="The original recruiting class and Michigan arrival can differ for transfers, walk-ons, and reclassifications."
          columns="md:grid-cols-3"
        >
          <Field label="Original recruiting class">
            <input
              name="recruitingSeason"
              type="number"
              min={1900}
              max={2100}
              defaultValue={CURRENT_SEASON}
              className={compactInputClass}
              required
            />
          </Field>
          <Field label="Michigan arrival season">
            <input
              name="startSeason"
              type="number"
              min={1900}
              max={2100}
              defaultValue={CURRENT_SEASON}
              className={compactInputClass}
              required
            />
          </Field>
          <Field
            label="Eligibility start season"
            hint="Usually the original recruiting class."
          >
            <input
              name="eligibilityStartSeason"
              type="number"
              min={1900}
              max={2100}
              defaultValue={CURRENT_SEASON}
              className={compactInputClass}
              required
            />
          </Field>
          <Field label="Medical extension seasons">
            <input
              name="medicalExtensionSeasons"
              type="number"
              min={0}
              max={5}
              step={1}
              defaultValue={0}
              className={compactInputClass}
              required
            />
          </Field>
          <Field
            label="Other extra eligibility"
            hint="Owner-granted seasons outside medical extensions."
          >
            <input
              name="extraEligibilitySeasons"
              type="number"
              min={0}
              max={5}
              step={1}
              defaultValue={0}
              className={compactInputClass}
              required
            />
          </Field>
          <div className="self-end border-l-4 border-michigan-maize bg-neutral-100 px-3 py-2.5 text-sm leading-5 text-neutral-600">
            The backend derives first NFL eligibility and the five-season end
            date from these clocks.
          </div>
        </EditorSection>

        <EditorSection
          title="Original recruiting profile"
          description="Keep original recruiting position and measurements separate from today’s roster facts."
          columns="md:grid-cols-3"
        >
          <Field label="Recruiting position">
            <input
              name="recruitingPosition"
              maxLength={16}
              placeholder="QB"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Recruiting height" hint="Optional, in total inches.">
            <input
              name="recruitingHeightInches"
              type="number"
              min={48}
              max={96}
              step={1}
              className={compactInputClass}
            />
          </Field>
          <Field label="Recruiting weight" hint="Optional, in pounds.">
            <input
              name="recruitingWeightPounds"
              type="number"
              min={100}
              max={500}
              step={1}
              className={compactInputClass}
            />
          </Field>
        </EditorSection>

        <details className="border-y border-neutral-300 bg-neutral-50 open:bg-white">
          <summary className="cursor-pointer px-4 py-3 text-sm font-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue">
            Add optional Composite and 247 ratings
          </summary>
          <div className="grid gap-4 border-t border-neutral-200 px-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
            <RatingFields prefix="composite" label="Composite" ratingMax={1} />
            <RatingFields prefix="service247" label="247" ratingMax={100} />
          </div>
        </details>

        <FormActions
          buttonLabel="Add player to active roster"
          pendingLabel="Adding player…"
          disabled={saving || adminKey.length === 0}
          pending={saving}
          message={message}
        />
      </form>
    </WorkspacePanel>
  )
}

function RemovePlayerForm({
  adminKey,
  players,
  programs,
}: {
  adminKey: string
  players: Array<RosterEntry>
  programs: Array<Program>
}) {
  const removePlayer = useMutation(api.rosterAdmin.removePlayer)
  const [selectedId, setSelectedId] = useState<PlayerId | undefined>(
    players[0]?.player._id,
  )
  const selected = players.find((entry) => entry.player._id === selectedId)
  const [departureKind, setDepartureKind] =
    useState<DepartureKind>('transfer_out')
  const [destinationProgramId, setDestinationProgramId] = useState('')
  const [finalSeason, setFinalSeason] = useState(CURRENT_SEASON)
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<FormMessage>()

  useEffect(() => {
    if (
      selectedId &&
      players.some((entry) => entry.player._id === selectedId)
    ) {
      return
    }
    setSelectedId(players[0]?.player._id)
  }, [players, selectedId])

  useEffect(() => {
    setConfirmed(false)
    setMessage(undefined)
  }, [selectedId])

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || !confirmed) return
    const destination = programs.find(
      (program) => program._id === destinationProgramId,
    )
    if (departureKind === 'transfer_out' && !destination) {
      setMessage({ kind: 'error', text: 'Choose the transfer destination.' })
      return
    }

    const playerName = selected.player.displayName
    setSaving(true)
    setMessage(undefined)
    try {
      await removePlayer({
        adminKey,
        departureKind,
        destinationProgramId:
          departureKind === 'transfer_out' ? destination?._id : undefined,
        finalSeason,
        playerId: selected.player._id,
        programKey: 'michigan',
      })
      setConfirmed(false)
      setDestinationProgramId('')
      setMessage({
        kind: 'success',
        text: `${playerName} was removed from the active roster and retained in Michigan history.`,
      })
    } catch (error) {
      setMessage({ kind: 'error', text: adminErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <WorkspacePanel
      eyebrow="Roster departure"
      title="Remove an active player"
      description="This does not delete the player. It closes the Michigan stint and writes the departure into movement history."
      tone="danger"
    >
      {players.length === 0 ? (
        <EmptyRoster />
      ) : (
        <form onSubmit={remove} className="space-y-8">
          <PlayerPicker
            players={players}
            selectedId={selectedId}
            onSelect={(playerId) => setSelectedId(playerId)}
            tone="danger"
          />

          {selected && (
            <>
              <PlayerSummary entry={selected} />

              <ChoiceGroup
                legend="Why is this player leaving?"
                name="departureKind"
                options={departureOptions}
                value={departureKind}
                onChange={(value) => {
                  setDepartureKind(value)
                  if (value !== 'transfer_out') setDestinationProgramId('')
                  setConfirmed(false)
                }}
                tone="danger"
              />

              <EditorSection
                title="Departure record"
                description="Movement history uses the following offseason as the event year, so a final 2026 season creates a 2027 departure event."
              >
                <Field label="Final Michigan season">
                  <input
                    type="number"
                    min={selected.stint.startSeason}
                    max={2100}
                    value={finalSeason}
                    onChange={(event) => {
                      setFinalSeason(
                        event.currentTarget.valueAsNumber || CURRENT_SEASON,
                      )
                      setConfirmed(false)
                    }}
                    className={compactInputClass}
                    required
                  />
                </Field>
                {departureKind === 'transfer_out' ? (
                  <ProgramSelect
                    label="Destination school"
                    name="destinationProgramId"
                    programs={programs}
                    value={destinationProgramId}
                    onChange={(value) => {
                      setDestinationProgramId(value)
                      setConfirmed(false)
                    }}
                    required
                  />
                ) : (
                  <div className="self-end border-l-4 border-neutral-400 bg-neutral-100 px-3 py-2.5 text-sm leading-5 text-neutral-600">
                    No destination is attached to a{' '}
                    {departureLabel(departureKind)} record.
                  </div>
                )}
              </EditorSection>

              <section className="border-2 border-red-700 bg-red-50 px-4 py-4 text-red-950">
                <h3 className="font-black">Confirm the roster change</h3>
                <p className="mt-1 text-sm leading-5">
                  <strong>{selected.player.displayName}</strong> will disappear
                  from the active depth chart. Their profile, Michigan seasons,
                  production, and the new departure event remain available.
                </p>
                <label className="mt-4 flex cursor-pointer items-start gap-3 border-t border-red-200 pt-4 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    className="mt-0.5 size-4 accent-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
                  />
                  <span>
                    I confirm {selected.player.displayName}’s final Michigan
                    season is {finalSeason} and this departure is correct.
                  </span>
                </label>
              </section>

              <FormActions
                buttonLabel="Record departure"
                pendingLabel="Recording departure…"
                disabled={
                  saving ||
                  adminKey.length === 0 ||
                  !confirmed ||
                  (departureKind === 'transfer_out' && !destinationProgramId)
                }
                pending={saving}
                message={message}
                tone="danger"
              />
            </>
          )}
        </form>
      )}
    </WorkspacePanel>
  )
}

function WorkspacePanel({
  children,
  description,
  eyebrow,
  title,
  tone = 'default',
}: {
  children: ReactNode
  description: string
  eyebrow: string
  title: string
  tone?: 'danger' | 'default'
}) {
  return (
    <section className="bg-white px-4 py-5 sm:px-6 sm:py-6">
      <header
        className={`mb-7 border-l-4 pl-4 ${tone === 'danger' ? 'border-red-700' : 'border-michigan-maize'}`}
      >
        <p
          className={`text-[10px] font-black uppercase tracking-[0.14em] ${tone === 'danger' ? 'text-red-700' : 'text-neutral-500'}`}
        >
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-2xl font-black text-neutral-950">{title}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-5 text-neutral-600">
          {description}
        </p>
      </header>
      {children}
    </section>
  )
}

function EditorSection({
  children,
  columns = 'md:grid-cols-2',
  description,
  title,
}: {
  children: ReactNode
  columns?: string
  description: string
  title: string
}) {
  return (
    <fieldset
      className={`grid gap-4 border-t-2 border-neutral-900 pt-4 ${columns}`}
    >
      <legend className="max-w-2xl pr-3">
        <span className="block text-lg font-black text-neutral-950">
          {title}
        </span>
        <span className="mt-0.5 block text-xs font-normal leading-4 text-neutral-500">
          {description}
        </span>
      </legend>
      {children}
    </fieldset>
  )
}

function ChoiceGroup<T extends string>({
  legend,
  name,
  onChange,
  options,
  tone,
  value,
}: {
  legend: string
  name: string
  onChange: (value: T) => void
  options: Array<{ description: string; label: string; value: T }>
  tone: 'blue' | 'danger'
  value: T
}) {
  return (
    <fieldset>
      <legend className="text-sm font-black text-neutral-950">{legend}</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const checked = value === option.value
          return (
            <label
              key={option.value}
              className={`cursor-pointer border-2 px-3 py-3 transition ${
                checked
                  ? tone === 'danger'
                    ? 'border-red-700 bg-red-50'
                    : 'border-michigan-blue bg-blue-50'
                  : 'border-neutral-300 bg-neutral-50 hover:border-neutral-500'
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={name}
                  checked={checked}
                  onChange={() => onChange(option.value)}
                  className={`${tone === 'danger' ? 'accent-red-700' : 'accent-michigan-blue'} focus-visible:outline-2 focus-visible:outline-offset-2`}
                />
                <span className="text-sm font-black text-neutral-950">
                  {option.label}
                </span>
              </span>
              <span className="mt-1 block pl-6 text-xs leading-4 text-neutral-500">
                {option.description}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

function PlayerPicker({
  onSelect,
  players,
  selectedId,
  tone = 'default',
}: {
  onSelect: (playerId: PlayerId) => void
  players: Array<RosterEntry>
  selectedId: PlayerId | undefined
  tone?: 'danger' | 'default'
}) {
  const [search, setSearch] = useState('')
  const filtered = players.filter((entry) => {
    const haystack =
      `${entry.player.displayName} ${entry.stint.position} ${entry.stint.jerseyNumber ?? ''}`.toLowerCase()
    return haystack.includes(search.trim().toLowerCase())
  })

  return (
    <section aria-labelledby="player-picker-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3
            id="player-picker-title"
            className="text-sm font-black text-neutral-950"
          >
            Choose a roster player
          </h3>
          <p className="text-xs text-neutral-500">
            Search by name, position, or number.
          </p>
        </div>
        <label className="w-full sm:w-72">
          <span className="sr-only">Search active players</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search active roster"
            className={inputClass}
          />
        </label>
      </div>
      <div className="mt-3 max-h-64 overflow-y-auto border-y border-neutral-300">
        {filtered.length === 0 ? (
          <p className="px-3 py-5 text-center text-sm text-neutral-500">
            No active players match “{search}”.
          </p>
        ) : (
          filtered.map((entry) => {
            const selected = entry.player._id === selectedId
            return (
              <button
                key={entry.player._id}
                type="button"
                onClick={() => onSelect(entry.player._id)}
                aria-pressed={selected}
                className={`grid w-full grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-neutral-200 px-3 py-2 text-left last:border-b-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${
                  selected
                    ? tone === 'danger'
                      ? 'bg-red-50 text-red-950 focus-visible:outline-red-700'
                      : 'bg-blue-50 text-michigan-blue focus-visible:outline-michigan-blue'
                    : 'bg-white text-neutral-700 hover:bg-neutral-50 focus-visible:outline-michigan-blue'
                }`}
              >
                <span className="font-black tabular-nums">
                  {entry.stint.jerseyNumber === undefined
                    ? '—'
                    : `#${entry.stint.jerseyNumber}`}
                </span>
                <span className="min-w-0 truncate text-sm font-bold">
                  {entry.player.displayName}
                </span>
                <span className="text-xs font-black text-neutral-500">
                  {entry.stint.position}
                </span>
              </button>
            )
          })
        )}
      </div>
      <p className="mt-1 text-right text-[10px] font-bold uppercase tracking-[0.1em] text-neutral-400">
        {filtered.length} of {players.length} players
      </p>
    </section>
  )
}

function PlayerSummary({
  entry,
  recruitingSeason,
}: {
  entry: RosterEntry
  recruitingSeason?: number
}) {
  return (
    <section className="grid gap-3 border-y border-neutral-300 bg-neutral-50 px-3 py-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
      <span className="text-3xl font-black tabular-nums text-neutral-950">
        {entry.stint.jerseyNumber === undefined
          ? '—'
          : `#${entry.stint.jerseyNumber}`}
      </span>
      <div className="min-w-0">
        <p className="font-black text-neutral-950">
          {entry.player.displayName}
        </p>
        <p className="text-xs text-neutral-500">
          {entry.stint.position} · Michigan since {entry.stint.startSeason}
        </p>
      </div>
      <dl className="flex gap-5 text-right text-xs">
        {recruitingSeason !== undefined && (
          <div>
            <dt className="font-bold uppercase tracking-[0.08em] text-neutral-400">
              Recruit class
            </dt>
            <dd className="font-black tabular-nums text-neutral-700">
              {recruitingSeason}
            </dd>
          </div>
        )}
        <div>
          <dt className="font-bold uppercase tracking-[0.08em] text-neutral-400">
            Eligibility end
          </dt>
          <dd className="font-black tabular-nums text-neutral-700">
            {entry.stint.eligibilityEndSeason}
          </dd>
        </div>
      </dl>
    </section>
  )
}

function ProgramSelect({
  label,
  name,
  onChange,
  programs,
  required,
  value,
}: {
  label: string
  name: string
  onChange?: (value: string) => void
  programs: Array<Program>
  required?: boolean
  value?: string
}) {
  return (
    <Field
      label={label}
      hint="Choose the canonical program so movement history links correctly."
    >
      <select
        name={name}
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
        className={inputClass}
        required={required}
      >
        <option value="">Choose a school</option>
        {programs.map((program) => (
          <option key={program._id} value={program._id}>
            {program.name}
          </option>
        ))}
      </select>
    </Field>
  )
}

function RatingFields({
  label,
  prefix,
  ratingMax,
}: {
  label: string
  prefix: 'composite' | 'service247'
  ratingMax: number
}) {
  return (
    <fieldset className="contents">
      <legend className="sr-only">{label} recruiting ratings and ranks</legend>
      <Field label={`${label} rating`}>
        <input
          name={`${prefix}Rating`}
          type="number"
          min={0}
          max={ratingMax}
          step="any"
          className={compactInputClass}
        />
      </Field>
      <Field label={`${label} overall rank`}>
        <input
          name={`${prefix}OverallRank`}
          type="number"
          min={1}
          max={10000}
          step={1}
          className={compactInputClass}
        />
      </Field>
      <Field label={`${label} position rank`}>
        <input
          name={`${prefix}PositionRank`}
          type="number"
          min={1}
          max={10000}
          step={1}
          className={compactInputClass}
        />
      </Field>
      <Field label={`${label} state rank`}>
        <input
          name={`${prefix}StateRank`}
          type="number"
          min={1}
          max={10000}
          step={1}
          className={compactInputClass}
        />
      </Field>
    </fieldset>
  )
}

function FormActions({
  buttonLabel,
  disabled,
  message,
  pending,
  pendingLabel,
  tone = 'default',
}: {
  buttonLabel: string
  disabled: boolean
  message: FormMessage | undefined
  pending: boolean
  pendingLabel: string
  tone?: 'danger' | 'default'
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-neutral-300 pt-4">
      <button
        type="submit"
        disabled={disabled}
        className={`${tone === 'danger' ? 'bg-red-800 hover:bg-red-900 focus-visible:outline-red-800' : 'bg-michigan-blue hover:bg-michigan-blue/90 focus-visible:outline-michigan-blue'} px-5 py-2.5 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2`}
      >
        {pending ? pendingLabel : buttonLabel}
      </button>
      {message && (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={`max-w-xl text-sm font-bold ${message.kind === 'error' ? 'text-red-800' : 'text-emerald-800'}`}
        >
          {message.text}
        </p>
      )}
      {!message && disabled && !pending && (
        <p className="text-xs text-neutral-500">
          Enter the admin key and complete the required fields to continue.
        </p>
      )}
    </div>
  )
}

function Field({
  children,
  hint,
  label,
}: {
  children: ReactNode
  hint?: string
  label: string
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs leading-4 text-neutral-500">
          {hint}
        </span>
      )}
    </label>
  )
}

function EmptyRoster() {
  return (
    <div className="border-y border-neutral-300 bg-neutral-50 px-4 py-10 text-center">
      <h3 className="font-black text-neutral-950">No active players found</h3>
      <p className="mt-1 text-sm text-neutral-500">
        Use “Add to roster” to create the first active player.
      </p>
    </div>
  )
}

function formText(data: FormData, name: string) {
  const value = data.get(name)
  return typeof value === 'string' ? value : ''
}

function formNumber(data: FormData, name: string) {
  return Number(formText(data, name))
}

function optionalFormNumber(data: FormData, name: string) {
  const value = formText(data, name).trim()
  return value ? Number(value) : undefined
}

function departureLabel(kind: DepartureKind) {
  return departureOptions
    .find((option) => option.value === kind)
    ?.label.toLowerCase()
}

function adminErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'The roster change failed.'
  const serverMessage = error.message.match(/Uncaught Error: ([^\n]+)/)?.[1]
  return serverMessage ?? 'The roster change failed.'
}

export function RosterAdminLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-michigan-cream px-4 text-michigan-blue">
      <div className="text-center">
        <div className="mx-auto mb-3 h-1 w-28 overflow-hidden bg-neutral-300">
          <div className="h-full w-1/2 animate-pulse bg-michigan-blue" />
        </div>
        <p className="text-sm font-black uppercase tracking-[0.14em]">
          Loading roster movement desk…
        </p>
      </div>
    </main>
  )
}

export function RosterAdminError() {
  return (
    <main className="grid min-h-screen place-items-center bg-michigan-cream px-6 text-center text-michigan-blue">
      <div className="max-w-md border-t-4 border-red-700 bg-white px-6 py-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-700">
          Connection error
        </p>
        <h1 className="mt-1 text-2xl font-black text-neutral-950">
          Couldn’t load roster administration.
        </h1>
        <p className="mt-2 text-sm leading-5 text-neutral-500">
          Check the Convex deployment and network connection, then reload.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 border border-neutral-950 px-3 py-1.5 text-sm font-bold text-neutral-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
        >
          Reload roster admin
        </button>
      </div>
    </main>
  )
}
