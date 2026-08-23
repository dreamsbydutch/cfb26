import { useEffect, useMemo, useState } from 'react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation, useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import type { FormEvent, ReactNode } from 'react'

type RosterEntry = FunctionReturnType<typeof api.rosters.list>[number]
type DepthTier = NonNullable<RosterEntry['stint']['depthTierOverride']>
type InjuryKind = NonNullable<RosterEntry['stint']['injury']>['kind']

const CURRENT_SEASON = 2026
const inputClass =
  'w-full border border-neutral-400 bg-white px-3 py-2 text-sm text-neutral-950 outline-none transition focus:border-michigan-blue focus:ring-2 focus:ring-michigan-maize'

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

export function RosterAdmin() {
  const { data: roster } = useSuspenseQuery(
    convexQuery(api.rosters.list, {
      limit: 500,
      programKey: 'michigan',
      status: 'active',
    }),
  )
  const updatePlayer = useMutation(api.rosterAdmin.updatePlayer)
  const players = useMemo(
    () =>
      [...roster].sort((left, right) =>
        left.player.displayName.localeCompare(right.player.displayName),
      ),
    [roster],
  )
  const [selectedId, setSelectedId] = useState<
    RosterEntry['player']['_id'] | undefined
  >(players[0]?.player._id)
  const selected = players.find((entry) => entry.player._id === selectedId)
  const selectedProfile = useQuery(
    api.players.getProfile,
    selected ? { playerId: selected.player._id } : 'skip',
  )
  const [adminKey, setAdminKey] = useState('')
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
  const [message, setMessage] = useState<
    { kind: 'error' | 'success'; text: string } | undefined
  >()

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
      setMessage({
        kind: 'error',
        text: adminErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="min-h-screen bg-michigan-cream text-michigan-blue">
      <header className="border-b-4 border-michigan-maize bg-michigan-blue text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-michigan-maize">
              Restricted roster tools
            </p>
            <h1 className="text-xl font-black">Roster admin</h1>
          </div>
          <Link
            to="/"
            className="border border-white/40 px-3 py-1.5 text-sm font-bold transition hover:border-michigan-maize focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-maize"
          >
            Back to roster
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 border-l-4 border-neutral-800 bg-neutral-100 px-4 py-3">
          <h2 className="font-black">Single-owner access</h2>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-neutral-600">
            The access key is checked by Convex and kept only in this page's
            memory. It is never saved by the browser. If the server key is not
            configured, every update is denied.
          </p>
        </div>

        <form onSubmit={save} className="space-y-7">
          <fieldset className="grid gap-4 border-t-2 border-neutral-900 pt-4 md:grid-cols-2">
            <legend className="pr-3 text-lg font-black">
              Access and player
            </legend>
            <Field label="Admin access key">
              <input
                type="password"
                value={adminKey}
                onChange={(event) => setAdminKey(event.target.value)}
                autoComplete="current-password"
                className={inputClass}
                required
              />
            </Field>
            <Field label="Player">
              <select
                value={selectedId ?? ''}
                onChange={(event) => {
                  setSelectedId(
                    players.find(
                      (entry) => entry.player._id === event.target.value,
                    )?.player._id,
                  )
                  setMessage(undefined)
                }}
                className={inputClass}
                required
              >
                {players.map((entry) => (
                  <option key={entry.player._id} value={entry.player._id}>
                    {entry.player.displayName} ·{' '}
                    {entry.stint.jerseyNumber === undefined
                      ? '—'
                      : `#${entry.stint.jerseyNumber}`}{' '}
                    · {entry.stint.position}
                  </option>
                ))}
              </select>
            </Field>
          </fieldset>

          {selected && (
            <>
              <div className="flex flex-wrap items-center gap-3 border-y border-neutral-300 bg-white px-3 py-3">
                <span className="text-2xl font-black tabular-nums text-neutral-950">
                  {selected.stint.jerseyNumber === undefined
                    ? '—'
                    : `#${selected.stint.jerseyNumber}`}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-black text-neutral-950">
                    {selected.player.displayName}
                  </p>
                  <p className="text-xs font-bold text-neutral-500">
                    {selected.stint.position}
                  </p>
                </div>
                <span className="bg-neutral-900 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-white tabular-nums">
                  Recruit {selectedProfile?.recruiting?.recruitingSeason ?? '—'}
                </span>
              </div>

              <fieldset className="grid gap-4 border-t-2 border-neutral-900 pt-4 md:grid-cols-3">
                <legend className="pr-3 text-lg font-black">
                  Depth chart and eligibility
                </legend>
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
                <Field label="Extra eligibility seasons">
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
                    className={inputClass}
                  />
                </Field>
                <div className="self-end bg-neutral-100 px-3 py-2 text-sm text-neutral-600">
                  Eligibility ends in{' '}
                  <strong className="text-neutral-950">
                    {selected.stint.eligibilityStartSeason +
                      4 +
                      selected.stint.medicalExtensionSeasons +
                      extraEligibility}
                  </strong>
                </div>
              </fieldset>

              <fieldset className="grid gap-4 border-t-2 border-neutral-900 pt-4 md:grid-cols-2">
                <legend className="pr-3 text-lg font-black">
                  Position change
                </legend>
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
                    className={inputClass}
                    required
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Position-change note (optional)">
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
              </fieldset>

              <fieldset className="grid gap-4 border-t-2 border-neutral-900 pt-4 md:grid-cols-3">
                <legend className="pr-3 text-lg font-black">
                  Availability
                </legend>
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
                <Field label="Expected return (optional)">
                  <input
                    value={expectedReturn}
                    onChange={(event) => setExpectedReturn(event.target.value)}
                    maxLength={80}
                    disabled={injuryKind === 'none'}
                    placeholder="Example: Week 4"
                    className={inputClass}
                  />
                </Field>
                <Field label="Injury note (optional)">
                  <input
                    value={injuryNote}
                    onChange={(event) => setInjuryNote(event.target.value)}
                    maxLength={160}
                    disabled={injuryKind === 'none'}
                    placeholder="Public roster note"
                    className={inputClass}
                  />
                </Field>
              </fieldset>

              <div className="flex flex-wrap items-center gap-3 border-t border-neutral-300 pt-4">
                <button
                  type="submit"
                  disabled={saving || adminKey.length === 0}
                  className="bg-michigan-blue px-5 py-2 text-sm font-black text-white transition hover:bg-michigan-blue/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-michigan-blue"
                >
                  {saving ? 'Saving…' : 'Save player changes'}
                </button>
                <p
                  aria-live="polite"
                  className={`text-sm font-bold ${
                    message?.kind === 'error'
                      ? 'text-red-800'
                      : 'text-emerald-800'
                  }`}
                >
                  {message?.text}
                </p>
              </div>
            </>
          )}
        </form>
      </section>
    </main>
  )
}

function adminErrorMessage(error: unknown) {
  if (!(error instanceof Error)) return 'The roster update failed.'
  const serverMessage = error.message.match(/Uncaught Error: ([^\n]+)/)?.[1]
  return serverMessage ?? 'The roster update failed.'
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-neutral-600">
        {label}
      </span>
      {children}
    </label>
  )
}

export function RosterAdminLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-michigan-cream px-4 text-michigan-blue">
      <p className="text-sm font-black uppercase tracking-[0.14em]">
        Loading roster admin…
      </p>
    </main>
  )
}
