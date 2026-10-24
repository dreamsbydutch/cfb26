import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, test, vi } from 'vitest'
import { RosterSheet } from './RosterSheet'
import type { ComponentProps, ReactNode } from 'react'
import type * as TanStackRouter from '@tanstack/react-router'

vi.mock('~/features/roster/useMichiganRoster', () => ({
  useMichiganRoster: () => ({
    data: {
      commitments: [
        {
          commitment: {
            _id: 'commitment',
            playerId: 'recruit',
            status: 'committed',
            initialPosition: 'QB',
            season: 2027,
          },
          player: { _id: 'recruit', displayName: 'Incoming quarterback' },
          recruiting: null,
        },
      ],
      entries: [],
    },
    isLoading: false,
    isError: false,
  }),
}))

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof TanStackRouter>()),
  Link: ({
    children,
    className,
    params,
    search,
  }: {
    children: ReactNode
    className: string
    params: { playerId: string }
    search: { season: number }
  }) => (
    <a
      className={className}
      href={`/michigan/players/${params.playerId}?season=${search.season}`}
    >
      {children}
    </a>
  ),
}))

type Props = ComponentProps<typeof RosterSheet>
function entry(
  name: string,
  role: 'starter' | 'rotation' | 'reserve',
  enrollmentSeason: number,
  snaps: number | null,
): Props['entries'][number] {
  // This rendering fixture supplies the dashboard fields consumed by the sheet.
  return {
    player: { _id: name, displayName: name },
    season: {
      _id: name,
      playerId: name,
      listedPosition: 'QB',
      positionRoom: 'Quarterbacks',
      role,
      eligibilityEvidence: { enrollmentSeason },
      gamesPlayed: 0,
      heightInches: null,
      weightPounds: null,
      jerseyNumber: null,
      depthStatus: 'available',
      ...(snaps === null
        ? {}
        : {
            participationTotals: {
              offense: {
                snaps,
                gamesPlayed: snaps > 0 ? 1 : 0,
                throughTeamGames: 5,
              },
            },
          }),
    },
    eligibility: { eligibleThroughSeason: 2029 },
    recruiting: null,
  } as Props['entries'][number]
}

const entries = [
  entry('Bench leader', 'reserve', 2022, 900),
  entry('Young prospect', 'reserve', 2026, 1000),
  entry('Starter unknown', 'starter', 2025, null),
  entry('Rotation unknown', 'rotation', 2024, null),
  entry('Rotation measured', 'rotation', 2024, 200),
  entry('Starter zero', 'starter', 2025, 0),
]
const filters = {
  availability: 'all',
  eligibility: 'all',
  entryMethod: 'all',
  experience: 'all',
  quality: 'all',
  role: 'all',
  room: 'all',
  scholarship: 'all',
  search: '',
}

describe('canonical football position tables', () => {
  test('contributors toggle hides Bench, Prospects, and Recruits and restores them when disabled', () => {
    const render = (contributorsOnly: boolean) =>
      renderToStaticMarkup(
        <RosterSheet
          entries={entries}
          filters={{ ...filters, contributorsOnly }}
          rosterPlayerIds={[]}
          season={2026}
        />,
      )
    const compact = render(true)
    expect(
      [...compact.matchAll(/<tbody[^>]*aria-label="([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ).toEqual(['QB Starters', 'QB Rotation'])
    for (const name of [
      'Bench leader',
      'Young prospect',
      'Incoming quarterback',
    ])
      expect(compact).not.toContain(name)
    const full = render(false)
    for (const name of [
      'Bench leader',
      'Young prospect',
      'Incoming quarterback',
    ])
      expect(full).toContain(name)
    const empty = renderToStaticMarkup(
      <RosterSheet
        entries={[]}
        filters={{ ...filters, contributorsOnly: true }}
        rosterPlayerIds={[]}
        season={2026}
      />,
    )
    expect(empty).toContain('No players match')
    expect(empty).not.toContain('Incoming quarterback')
  })

  test('keeps six unit rows with three desktop columns with optional positions and missing groups', () => {
    const positions = [
      'QB',
      'RB',
      'FB',
      'WR',
      'TE',
      'SLOT',
      'RHINO',
      'OT',
      'OG',
      'OC',
      'DE',
      'DL',
      'LB',
      'CB',
      'S',
      'NICKEL',
      'K',
      'P',
      'LS',
      'CUSTOM',
    ]
    const html = renderToStaticMarkup(
      <RosterSheet
        entries={positions.map((position) => {
          const player = entry(position, 'reserve', 2026, null)
          return {
            ...player,
            season: { ...player.season, listedPosition: position },
          }
        })}
        filters={{ ...filters, role: 'prospect' }}
        rosterPlayerIds={[]}
        season={2026}
      />,
    )
    const rows = html.split(/aria-label="[^"]+ roster row"/).slice(1)
    expect(rows).toHaveLength(6)
    for (const row of rows) expect(row).toContain('lg:grid-cols-3')
    expect(
      rows.map((row) =>
        [...row.matchAll(/aria-label="([^"]+) position group"/g)].map(
          (match) => match[1],
        ),
      ),
    ).toEqual([
      ['QB', 'HB', 'FB'],
      ['WR', 'TE', 'SLOT', 'RHINO', 'CUSTOM'],
      ['OT', 'OG', 'OC'],
      ['DE', 'DL', 'LB'],
      ['CB', 'S', 'NICKEL'],
      ['K', 'P', 'LS'],
    ])
    const sparse = renderToStaticMarkup(
      <RosterSheet
        entries={[
          {
            ...entries[0],
            season: { ...entries[0].season, listedPosition: 'LS' },
          },
        ]}
        filters={{ ...filters, role: 'bench' }}
        rosterPlayerIds={[]}
        season={2026}
      />,
    )
    expect(sparse.split(/aria-label="[^"]+ roster row"/).slice(1)).toHaveLength(
      6,
    )
    expect(sparse.split('aria-label="Specialists roster row"')[1]).toContain(
      'LS position group',
    )
  })

  test('renders counted tier sections ahead of snap order and sorts snaps within each tier', () => {
    const html = renderToStaticMarkup(
      <RosterSheet
        entries={entries}
        filters={filters}
        rosterPlayerIds={[]}
        season={2026}
      />,
    )
    const groups = [
      ...html.matchAll(
        /<tbody[^>]*aria-label="([^"]+)"[^>]*>([\s\S]*?)<\/tbody>/g,
      ),
    ]
    expect(groups.map((group) => group[1])).toEqual([
      'QB Starters',
      'QB Rotation',
      'QB Bench',
      'QB Prospects',
      'QB Recruits',
    ])
    for (const group of groups) expect(group[2]).toContain('scope="rowgroup"')
    expect(groups[0][2]).toContain('Starters · 2')
    expect(groups[0][2].indexOf('Starter zero')).toBeLessThan(
      groups[0][2].indexOf('Starter unknown'),
    )
    expect(groups[1][2].indexOf('Rotation measured')).toBeLessThan(
      groups[1][2].indexOf('Rotation unknown'),
    )
    expect(groups[2][2]).toContain('Bench leader')
    expect(groups[3][2]).toContain('Young prospect')
    expect(groups[4][2]).toContain('Incoming quarterback')
    expect(html.match(/<table /g)).toHaveLength(1)
  })

  test('omits empty tiers and keeps incoming recruits in their own section when filtering', () => {
    const html = renderToStaticMarkup(
      <RosterSheet
        entries={[]}
        filters={{ ...filters, role: 'recruit' }}
        rosterPlayerIds={[]}
        season={2026}
      />,
    )
    expect(
      [...html.matchAll(/<tbody[^>]*aria-label="([^"]+)"/g)].map(
        (group) => group[1],
      ),
    ).toEqual(['QB Recruits'])
    expect(html).toContain('Recruits · 1')
    expect(html).not.toContain('QB Starters')
  })
})
