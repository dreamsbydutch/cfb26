import { useEffect, useRef, useState } from 'react'
import type { ManualTvEvent } from './watchRating'

export function TvOverrideEditor({
  label,
  main,
  backup,
  onSave,
  onCancel,
}: {
  label: string
  main: ManualTvEvent | null
  backup: ManualTvEvent | null
  onSave: (main: ManualTvEvent | null, backup: ManualTvEvent | null) => void
  onCancel: () => void
}) {
  const [mainCustom, setMainCustom] = useState(Boolean(main))
  const [backupCustom, setBackupCustom] = useState(Boolean(backup))
  const [network, setNetwork] = useState(main?.network ?? '')
  const [event, setEvent] = useState(main?.event ?? '')
  const [backupNetwork, setBackupNetwork] = useState(backup?.network ?? '')
  const [backupEvent, setBackupEvent] = useState(backup?.event ?? '')
  const [allowFlip, setAllowFlip] = useState(main?.allowFlip ?? true)
  const [error, setError] = useState('')
  const firstField = useRef<HTMLSelectElement>(null)
  useEffect(() => {
    firstField.current?.focus()
  }, [])
  const flips = !mainCustom || allowFlip
  return (
    <form
      className="app-card mb-3 p-4 text-sm text-white"
      aria-label={`Edit ${label}`}
      onSubmit={(e) => {
        e.preventDefault()
        if (
          (mainCustom && (!network.trim() || !event.trim())) ||
          (flips &&
            backupCustom &&
            (!backupNetwork.trim() || !backupEvent.trim()))
        ) {
          setError('Enter a network and event for each manual slot.')
          return
        }
        onSave(
          mainCustom
            ? { network: network.trim(), event: event.trim(), allowFlip }
            : null,
          flips && backupCustom
            ? {
                network: backupNetwork.trim(),
                event: backupEvent.trim(),
                allowFlip: true,
              }
            : null,
        )
      }}
    >
      <h3 className="mb-3 font-bold">Edit {label}</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-xs font-bold text-white/60">
            Main slot
          </legend>
          <label className="block text-xs">
            Selection
            <select
              ref={firstField}
              className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-transparent p-2"
              value={mainCustom ? 'manual' : 'auto'}
              onChange={(e) => setMainCustom(e.target.value === 'manual')}
            >
              <option value="auto">Automatic football</option>
              <option value="manual">Manual event</option>
            </select>
          </label>
          {mainCustom && (
            <>
              <EventFields
                network={network}
                event={event}
                setNetwork={setNetwork}
                setEvent={setEvent}
              />
              <label className="flex min-h-11 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={allowFlip}
                  onChange={(e) => setAllowFlip(e.target.checked)}
                />
                Allow a flip-to event on this TV
              </label>
            </>
          )}
        </fieldset>
        <fieldset className="min-w-0 space-y-2" disabled={!flips}>
          <legend className="mb-2 text-xs font-bold text-white/60">
            Flip-to slot
          </legend>
          {flips ? (
            <>
              <label className="block text-xs">
                Selection
                <select
                  className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-transparent p-2"
                  value={backupCustom ? 'manual' : 'auto'}
                  onChange={(e) => setBackupCustom(e.target.value === 'manual')}
                >
                  <option value="auto">Automatic football</option>
                  <option value="manual">Manual event</option>
                </select>
              </label>
              {backupCustom && (
                <EventFields
                  network={backupNetwork}
                  event={backupEvent}
                  setNetwork={setBackupNetwork}
                  setEvent={setBackupEvent}
                />
              )}
            </>
          ) : (
            <p className="text-xs text-white/50">
              No flipping on this TV. Other TVs receive the available football
              picks.
            </p>
          )}
        </fieldset>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-sm">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-white/50">
        Manual events stay locked until cleared. Saved in this browser.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          className="app-filter-active min-h-11 rounded-lg px-4 text-xs font-bold"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-lg border border-white/20 px-4 text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onSave(null, null)}
          className="min-h-11 rounded-lg border border-white/20 px-4 text-xs"
        >
          Reset this TV
        </button>
      </div>
    </form>
  )
}

function EventFields({
  network,
  event,
  setNetwork,
  setEvent,
}: {
  network: string
  event: string
  setNetwork: (value: string) => void
  setEvent: (value: string) => void
}) {
  return (
    <>
      <label className="block text-xs">
        Network
        <input
          className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-transparent p-2"
          required
          maxLength={60}
          value={network}
          onChange={(e) => setNetwork(e.target.value)}
          placeholder="e.g. Sportsnet"
        />
      </label>
      <label className="block text-xs">
        Event
        <input
          className="mt-1 block min-h-11 w-full rounded-lg border border-white/20 bg-transparent p-2"
          required
          maxLength={120}
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          placeholder="e.g. Blue Jays vs Yankees"
        />
      </label>
    </>
  )
}
