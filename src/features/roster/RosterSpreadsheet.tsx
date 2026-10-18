import { useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Plus, Save, Search, Undo2, X } from 'lucide-react'
import { ConvexError } from 'convex/values'
import {
  changedSheetFields,
  editableColumn,
  emptySheetValues,
  sheetColumns,
  spreadsheetRows,
} from './rosterSpreadsheetModel'
import type { FunctionArgs, FunctionReturnType } from 'convex/server'
import type { api } from '../../../convex/_generated/api'
import type {
  SheetColumn,
  SheetData,
  SheetField,
  SheetRow,
  SheetValues,
} from './rosterSpreadsheetModel'

type Draft = { row: SheetRow; before: SheetValues }
type SaveArgs = Omit<
  FunctionArgs<typeof api.rosterSpreadsheet.save>,
  'sessionToken'
>
type Receipt = FunctionReturnType<typeof api.rosterSpreadsheet.save>
const button =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-700 disabled:cursor-not-allowed disabled:opacity-40'
const groups = sheetColumns.reduce<
  Array<{ name: string; count: number; field: SheetField }>
>((result, column) => {
  const previous = result.at(-1)
  if (previous?.name === column.group) previous.count++
  else result.push({ name: column.group, count: 1, field: column.field })
  return result
}, [])

export function RosterSpreadsheet({
  data,
  revision,
  onSave,
}: {
  data: SheetData
  revision: number | undefined
  onSave: (args: SaveArgs) => Promise<Receipt>
}) {
  const savedRows = useMemo(() => spreadsheetRows(data), [data])
  const [drafts, setDrafts] = useState<Partial<Record<string, Draft>>>({})
  const [baseRevision, setBaseRevision] = useState<number>()
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<{ error: boolean; text: string }>()
  const scroll = useRef<HTMLDivElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const focusNew = useRef<string | null>(null)
  const draftList = Object.values(drafts).filter(
    (draft): draft is Draft => draft !== undefined,
  )
  const dirty = draftList.length > 0
  const rows = [
    ...draftList
      .filter((draft) => !draft.row.playerId)
      .map((draft) => draft.row),
    ...savedRows.map((row) => drafts[row.key]?.row ?? row),
  ]
  const query = search.trim().toLowerCase()
  const visible = rows.filter(
    (row) =>
      !query ||
      [row.values, drafts[row.key]?.before].some(
        (values) =>
          values &&
          [
            values.displayName,
            values.canonicalName,
            values.listedPosition,
            values.jerseyNumber,
          ].some((value) => value.toLowerCase().includes(query)),
      ),
  )
  const ready = revision !== undefined && !saving

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent('owner-spreadsheet-dirty', { detail: dirty }),
    )
    return () => {
      window.dispatchEvent(
        new CustomEvent('owner-spreadsheet-dirty', { detail: false }),
      )
    }
  }, [dirty])
  useEffect(() => {
    if (!focusNew.current) return
    scroll.current
      ?.querySelector<HTMLInputElement>(
        `input[data-row="${focusNew.current}"][data-column="displayName"]`,
      )
      ?.focus()
    focusNew.current = null
  }, [drafts])

  function edit(row: SheetRow, field: SheetField, value: string) {
    if (!ready) return
    if (!dirty) setBaseRevision(revision)
    setNotice(undefined)
    setDrafts((current) => {
      const before = current[row.key]?.before ?? row.values
      const values = { ...row.values, [field]: value }
      const next = { ...current }
      if (row.playerId && changedSheetFields(before, values).length === 0)
        delete next[row.key]
      else next[row.key] = { before, row: { ...row, values } }
      return next
    })
  }

  function add(recruit: boolean) {
    if (!ready) return
    const key = `new-${crypto.randomUUID()}`
    const values = emptySheetValues(data.season, recruit)
    if (!dirty) setBaseRevision(revision)
    focusNew.current = key
    setSearch('')
    setNotice(undefined)
    setDrafts((current) => ({
      ...current,
      [key]: { before: values, row: { key, values } },
    }))
    scroll.current?.scrollTo({ left: 0, top: 0 })
  }

  async function save() {
    if (!dirty || saving || baseRevision === undefined) return
    setSaving(true)
    setNotice(undefined)
    try {
      const result = await onSave({
        season: data.season,
        expectedRevision: baseRevision,
        rows: draftList.map(({ row, before }) => ({
          playerId: row.playerId,
          playerSeasonId: row.playerSeasonId,
          commitmentId: row.commitmentId,
          values: row.values,
          changedFields: row.playerId
            ? changedSheetFields(before, row.values)
            : [
                ...new Set<SheetField>([
                  'displayName',
                  'listedPosition',
                  ...changedSheetFields(before, row.values),
                ]),
              ],
        })),
      })
      setDrafts({})
      setBaseRevision(undefined)
      setNotice({
        error: false,
        text: `Saved ${result.updated + result.created} ${result.updated + result.created === 1 ? 'row' : 'rows'}${result.created ? `, including ${result.created} new` : ''}.`,
      })
    } catch (error) {
      setNotice({
        error: true,
        text:
          error instanceof ConvexError
            ? String(error.data)
            : error instanceof Error
              ? error.message
              : 'Could not save. Your edits are still here.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      ref={form}
      data-roster-spreadsheet
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 's'
        ) {
          event.preventDefault()
          form.current?.requestSubmit()
        }
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
          event.preventDefault()
          if (!event.target.dataset.column) return
          const controls = Array.from(
            scroll.current?.querySelectorAll<
              HTMLInputElement | HTMLSelectElement
            >(
              `[data-column="${event.target.dataset.column}"]:not(:disabled)`,
            ) ?? [],
          )
          const index = controls.indexOf(event.target)
          controls[index + (event.shiftKey ? -1 : 1)]?.focus()
        }
      }}
      className="min-w-0 text-zinc-900"
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative mr-auto min-w-56 flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-zinc-500" />
          <input
            aria-label="Search roster spreadsheet"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search player, #, position"
            className="h-9 w-full rounded-lg border border-zinc-300 bg-white pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-zinc-700"
          />
        </label>
        <button
          type="button"
          className={button}
          disabled={!ready}
          onClick={() => add(false)}
        >
          <Plus size={14} /> Add player
        </button>
        <button
          type="button"
          className={button}
          disabled={!ready}
          onClick={() => add(true)}
        >
          <Plus size={14} /> Add recruit
        </button>
        <button
          type="button"
          className={button}
          disabled={!dirty || saving}
          onClick={() => {
            setDrafts({})
            setBaseRevision(undefined)
            setNotice(undefined)
          }}
        >
          <Undo2 size={14} /> Discard
        </button>
        <button
          type="submit"
          className={`${button} !border-zinc-900 !bg-zinc-900 !text-white hover:!bg-zinc-700`}
          disabled={!dirty || !ready}
        >
          <Save size={14} />{' '}
          {saving
            ? 'Saving…'
            : dirty
              ? `Save ${draftList.length} ${draftList.length === 1 ? 'row' : 'rows'}`
              : 'Saved'}
        </button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-zinc-600">
        <span>
          {visible.length} of {rows.length} rows · {sheetColumns.length} columns
        </span>
        <span>Tab across · Enter down · Ctrl/⌘ S to save</span>
        {dirty && (
          <span className="font-semibold text-amber-800">
            {draftList.length} unsaved {draftList.length === 1 ? 'row' : 'rows'}
          </span>
        )}
      </div>
      {notice && (
        <div
          role={notice.error ? 'alert' : 'status'}
          className={`mb-3 rounded-lg border px-3 py-2 text-sm ${notice.error ? 'border-red-300 bg-red-50 text-red-900' : 'border-emerald-300 bg-emerald-50 text-emerald-900'}`}
        >
          {notice.text}
        </div>
      )}
      {dirty && baseRevision !== revision && (
        <p role="status" className="mb-3 text-xs text-amber-800">
          The saved roster changed while you were editing. Your draft is kept;
          discard it to load the latest values before reapplying your changes.
        </p>
      )}
      <nav
        aria-label="Spreadsheet columns"
        className="flex flex-wrap gap-1 rounded-t-lg border border-b-0 border-zinc-300 bg-zinc-100 p-1.5"
      >
        {groups
          .filter((group) => group.name !== 'Player')
          .map((group) => (
            <button
              key={group.name}
              type="button"
              className="rounded px-2 py-1 text-xs font-semibold text-zinc-600 hover:bg-white hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-zinc-700"
              onClick={() => {
                const header = scroll.current?.querySelector<HTMLElement>(
                  `[data-header="${group.field}"]`,
                )
                if (header && scroll.current)
                  scroll.current.scrollTo({
                    left: header.offsetLeft - 220,
                    behavior: 'smooth',
                  })
              }}
            >
              {group.name}
            </button>
          ))}
      </nav>
      <div
        ref={scroll}
        role="region"
        aria-label={`${data.season} editable roster, scroll for all columns`}
        tabIndex={0}
        className="relative max-h-[calc(100dvh-22rem)] min-h-80 overflow-auto border border-zinc-300 focus-visible:outline-2 focus-visible:outline-zinc-700"
      >
        <table className="w-max table-fixed border-separate border-spacing-0 text-xs">
          <caption className="sr-only">
            Michigan {data.season} roster. Editable cells save together. Player
            names and column headings stay visible while scrolling.
          </caption>
          <colgroup>
            {sheetColumns.map((column) => (
              <col key={column.field} style={{ width: column.width ?? 130 }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {groups.map((group, index) => (
                <th
                  key={group.name}
                  colSpan={group.count}
                  scope="colgroup"
                  className={`sticky top-0 z-20 h-7 border-b border-r border-zinc-300 bg-zinc-200 px-3 text-left text-[10px] font-bold uppercase tracking-wider ${index === 0 ? 'left-0 !z-40' : ''}`}
                >
                  {group.name}
                </th>
              ))}
            </tr>
            <tr>
              {sheetColumns.map((column, index) => (
                <th
                  key={column.field}
                  data-header={column.field}
                  scope="col"
                  title={column.help}
                  className={`sticky top-7 z-20 h-8 border-b border-r border-zinc-300 bg-zinc-100 px-2 text-left font-semibold ${index === 0 ? 'left-0 !z-40' : ''}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.key} className="group">
                {sheetColumns.map((column, index) => {
                  const draft = drafts[row.key]
                  const changed =
                    draft &&
                    (!row.playerId ||
                      draft.before[column.field] !== row.values[column.field])
                  const enabled = editableColumn(row, column)
                  const groupStart =
                    index > 0 && column.group !== sheetColumns[index - 1].group
                  return (
                    <td
                      key={column.field}
                      className={`h-9 border-b border-r border-zinc-200 p-0 ${groupStart ? 'border-l-2 border-l-zinc-300' : ''} ${index === 0 ? 'sticky left-0 z-10 shadow-[2px_0_4px_rgb(0_0_0/0.06)]' : ''} ${changed && enabled ? 'bg-amber-50' : enabled ? 'bg-white group-hover:bg-zinc-50' : 'bg-zinc-100'}`}
                    >
                      <div className="flex items-center">
                        <SheetCell
                          column={column}
                          row={row}
                          enabled={enabled && ready}
                          onChange={(value) => edit(row, column.field, value)}
                        />
                        {index === 0 &&
                          (row.playerId ? (
                            <a
                              href={`/admin/roster/players/${row.playerId}`}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${row.values.displayName} player record`}
                              title="Open player history in a new tab"
                              className="mr-2 shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-200 focus-visible:outline-2"
                            >
                              <ExternalLink size={13} />
                            </a>
                          ) : (
                            <button
                              type="button"
                              disabled={saving}
                              aria-label={`Remove new ${row.values.displayName || 'player'} row`}
                              className="mr-2 shrink-0 rounded p-1 text-zinc-500 hover:bg-zinc-200"
                              onClick={() =>
                                setDrafts((current) => {
                                  const next = { ...current }
                                  delete next[row.key]
                                  return next
                                })
                              }
                            >
                              <X size={13} />
                            </button>
                          ))}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && (
          <p className="sticky left-0 w-fit px-4 py-10 text-sm text-zinc-500">
            {query
              ? 'No matching players.'
              : 'No players yet. Add a player or recruit above.'}
          </p>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-zinc-500">
        Scroll sideways for all fields. Blank measurements and phase totals mean
        unknown. Recruits have no annual stats until enrolled. Open a player’s
        record for enrollment, departures, evaluations, and game history.
      </p>
    </form>
  )
}

function SheetCell({
  column,
  row,
  enabled,
  onChange,
}: {
  column: SheetColumn
  row: SheetRow
  enabled: boolean
  onChange: (value: string) => void
}) {
  const label = `${row.values.displayName || 'New player'} · ${column.group} · ${column.label}`
  const className =
    'h-9 w-full min-w-0 border-0 bg-transparent px-2 text-xs text-zinc-900 outline-none focus:bg-white focus:shadow-[inset_0_0_0_2px_#52525b] disabled:cursor-default disabled:text-zinc-500'
  if (column.options)
    return (
      <select
        aria-label={label}
        data-row={row.key}
        data-column={column.field}
        disabled={!enabled}
        value={row.values[column.field]}
        onChange={(event) => onChange(event.target.value)}
        className={className}
        title={column.help}
      >
        {column.options
          .filter(
            ([value]) =>
              row.playerId ||
              column.field !== 'personState' ||
              value !== 'alumni',
          )
          .map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
      </select>
    )
  return (
    <input
      aria-label={label}
      data-row={row.key}
      data-column={column.field}
      disabled={!enabled}
      value={row.values[column.field]}
      onChange={(event) => onChange(event.target.value)}
      type="text"
      inputMode={
        column.type === 'decimal'
          ? 'decimal'
          : column.type === 'number'
            ? 'numeric'
            : 'text'
      }
      autoComplete="off"
      spellCheck={false}
      className={className}
      title={
        column.help ??
        (enabled
          ? row.values[column.field]
          : 'Saved value. Manage lifecycle history on the player record.')
      }
    />
  )
}
