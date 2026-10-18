import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { useMutation } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '../../../convex/_generated/api'
import { teamDefinitions } from '../../../convex/teamRosterFields'
import type { FunctionReturnType } from 'convex/server'
import type { Id } from '../../../convex/_generated/dataModel'
import type {
  TeamColumn,
  TeamSport,
  TeamValues,
} from '../../../convex/teamRosterFields'
import { EmptyState, ErrorState, LoadingState } from '~/components/AppShell'

type Data = FunctionReturnType<typeof api.teamRosters.list>
type Row = { key: string; id?: Id<'teamRosterEntries'>; values: TeamValues }

export function TeamRosterEditor({
  sport,
  season,
  token,
}: {
  sport: TeamSport
  season: number
  token: string
}) {
  const roster = useQuery(convexQuery(api.teamRosters.list, { sport, season }))
  const save = useMutation(api.teamRosters.save)
  if (roster.isPending) return <LoadingState />
  if (roster.isError)
    return (
      <ErrorState>Could not load the roster. Reload to try again.</ErrorState>
    )
  return (
    <TeamSpreadsheet
      key={`${sport}-${season}`}
      sport={sport}
      data={roster.data}
      onSave={(rows, revision) =>
        save({
          sport,
          season,
          sessionToken: token,
          expectedRevision: revision,
          rows,
        })
      }
    />
  )
}

export function TeamSpreadsheet({
  sport,
  data,
  onSave,
}: {
  sport: TeamSport
  data: Data
  onSave: (
    rows: Array<{ id?: Id<'teamRosterEntries'>; values: TeamValues }>,
    revision: number,
  ) => Promise<{ revision: number; saved: number }>
}) {
  const [draft, setDraft] = useState<{
    rows: Array<Row>
    revision: number
  } | null>(null)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const columns: Array<TeamColumn> = teamDefinitions[sport].columns
  const rows =
    draft?.rows ??
    data.entries.map((entry) => ({
      key: entry._id,
      id: entry._id,
      values: entry.values,
    }))
  const dirty = draft !== null
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
  const edit = (key: string, column: string, value: string) => {
    setDraft({
      revision: draft?.revision ?? data.revision,
      rows: rows.map((row) =>
        row.key === key
          ? { ...row, values: { ...row.values, [column]: value || null } }
          : row,
      ),
    })
    setNotice('')
  }
  const submit = async () => {
    if (!draft || saving) return
    setSaving(true)
    try {
      const result = await onSave(
        draft.rows.map(({ id, values }) => ({ ...(id ? { id } : {}), values })),
        draft.revision,
      )
      setDraft(null)
      setNotice(`Saved ${result.saved} players.`)
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Could not save. Your edits are retained.',
      )
    } finally {
      setSaving(false)
    }
  }
  return (
    <form
      data-roster-spreadsheet
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
      onKeyDown={(event) => {
        if (
          (event.ctrlKey || event.metaKey) &&
          event.key.toLowerCase() === 's'
        ) {
          event.preventDefault()
          void submit()
        }
        if (
          event.key === 'Enter' &&
          event.target instanceof HTMLElement &&
          event.target.dataset.column
        ) {
          event.preventDefault()
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              `[data-column="${event.target.dataset.column}"]`,
            ),
          )
          controls[
            controls.indexOf(event.target) + (event.shiftKey ? -1 : 1)
          ]?.focus()
        }
      }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          aria-label="Search editable roster"
          className="app-control px-3 py-2"
          placeholder="Find a player"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <button
          type="button"
          className="app-control px-3 py-2 font-bold"
          disabled={saving || rows.length >= 100}
          onClick={() => {
            setSearch('')
            setDraft({
              revision: draft?.revision ?? data.revision,
              rows: [
                ...rows,
                {
                  key: crypto.randomUUID(),
                  values: { name: '', status: 'Active' },
                },
              ],
            })
          }}
        >
          Add player
        </button>
        <button
          type="submit"
          disabled={!dirty || saving}
          className="app-control bg-[#27272a] px-4 py-2 font-bold text-[#ffffff] disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          className="app-control px-3 py-2 disabled:opacity-40"
          onClick={() => {
            if (window.confirm('Discard unsaved roster changes?')) {
              setDraft(null)
              setNotice('')
            }
          }}
        >
          Discard changes
        </button>
        <span className="text-xs">
          {rows.length} players · {dirty ? 'Unsaved changes' : 'Saved'}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Enter season totals. Leave unknown values blank.{' '}
        {sport === 'basketball'
          ? 'Shooting percentages: 0–100. Public averages are calculated per game.'
          : 'Goalie statistics apply only to position G; public points, SV% and GAA are calculated.'}{' '}
        Tab moves across; Enter moves down; Ctrl/Cmd-S saves.
      </p>
      {notice && (
        <p role="status" className="mb-3 rounded-lg border p-3 text-sm">
          {notice}
        </p>
      )}
      {dirty && data.revision !== draft.revision && (
        <p role="alert" className="mb-3 text-sm text-amber-800">
          Another session updated this roster. Your draft is retained; discard
          it to load the latest version.
        </p>
      )}
      {!rows.length ? (
        <EmptyState title="Empty roster">
          Add the first player to begin.
        </EmptyState>
      ) : (
        <div className="max-h-[65vh] overflow-auto rounded-xl border border-slate-300">
          <table className="border-collapse text-left text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100">
              <tr>
                {columns.map((column, i) => (
                  <th
                    key={column.key}
                    className={`whitespace-nowrap border-b px-3 py-3 ${i === 0 ? 'sticky left-0 z-30 bg-slate-100' : ''}`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((row) =>
                  String(row.values.name ?? '')
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((row) => (
                  <tr key={row.key}>
                    {columns.map((column, i) => {
                      const original = data.entries.find(
                        (entry) => entry._id === row.id,
                      )?.values[column.key]
                      const changed =
                        String(original ?? '') !==
                        String(row.values[column.key] ?? '')
                      const props = {
                        'aria-label': `${row.values.name || 'New player'} · ${column.label}`,
                        'data-column': column.key,
                        disabled: saving,
                        value: row.values[column.key] ?? '',
                        onChange: (
                          event: React.ChangeEvent<
                            HTMLInputElement | HTMLSelectElement
                          >,
                        ) => edit(row.key, column.key, event.target.value),
                        className: `w-full min-w-24 rounded-none border-0 px-3 py-2.5 outline-offset-[-2px] focus:outline-2 focus:outline-blue-600 ${changed ? 'bg-amber-50' : 'bg-white'}`,
                      }
                      return (
                        <td
                          key={column.key}
                          className={`border-b border-r border-slate-200 ${i === 0 ? 'sticky left-0 z-10 min-w-52 bg-white' : ''}`}
                        >
                          {column.options ? (
                            <select {...props}>
                              <option value="">—</option>
                              {column.options.map((option) => (
                                <option key={option}>{option}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              {...props}
                              inputMode={
                                column.type === 'number' ? 'decimal' : undefined
                              }
                            />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  )
}
