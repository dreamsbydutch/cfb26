/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import {
  emptySheetValues,
  spreadsheetRows,
} from '../src/features/roster/rosterSpreadsheetModel'
import schema from './schema'
import { api } from './_generated/api'
import type { SheetValues } from '../src/features/roster/rosterSpreadsheetModel'

const modules = import.meta.glob('./**/*.ts')
const token = 'spreadsheet-test-session-not-a-real-credential'

async function setup() {
  const t = convexTest(schema, modules)
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  const tokenHash = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  const sessionId = await t.run(async (ctx) => {
    await ctx.db.insert('programs', { key: 'michigan', name: 'Michigan' })
    return ctx.db.insert('ownerSessions', {
      tokenHash,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      expiresAt: Date.now() + 600_000,
      revokedAt: null,
    })
  })
  await t.mutation(api.rosterAdmin.createPerson, {
    sessionToken: token,
    canonicalName: 'Sheet Player',
    entryMethod: 'high_school',
    entrySeason: 2026,
    initialPosition: 'WR',
    state: 'enrolled',
  })
  const data = await t.query(api.rosters.getSeasonDashboard, { season: 2026 })
  if (!data) throw new Error('Missing test dashboard')
  const row = spreadsheetRows(data)[0]
  const edit = (values: Partial<SheetValues>) => ({
    playerId: row.playerId,
    playerSeasonId: row.playerSeasonId,
    values: { ...row.values, ...values },
    changedFields: Object.keys(values),
  })
  const args = { sessionToken: token, season: 2026, expectedRevision: 1 }
  return { t, sessionId, row, edit, args }
}

describe('owner roster spreadsheet', () => {
  test('edits recruiting values, preserves history and the untouched value, and supports clearing', async () => {
    const { t, row, edit, args } = await setup()
    if (!row.playerId) throw new Error('Missing player')
    const playerId = row.playerId
    await t.run((ctx) =>
      ctx.db.insert('evaluations', {
        playerId,
        provider: '247Sports Composite',
        kind: 'transfer',
        direction: 'inbound',
        rank: 38,
        score: 0.9745,
        scale: '0-1',
        evaluatedAt: 1,
        dataQuality: 'source_verified',
      }),
    )
    const getRows = async () => {
      const data = await t.query(api.rosters.getSeasonDashboard, {
        season: 2026,
      })
      if (!data) throw new Error('Missing roster')
      return spreadsheetRows(data)
    }
    expect((await getRows())[0].values.recruitingRating).toBe('0.9745')
    await t.mutation(api.rosterSpreadsheet.save, {
      ...args,
      rows: [edit({ recruitingRank: '37' })],
    })
    expect((await getRows())[0].values).toMatchObject({
      recruitingRank: '37',
      recruitingRating: '0.9745',
    })
    const history = await t.run((ctx) =>
      ctx.db
        .query('evaluations')
        .withIndex('by_playerId_and_evaluatedAt', (q) =>
          q.eq('playerId', playerId),
        )
        .take(10),
    )
    expect(history).toHaveLength(2)
    expect(history[0].rank).toBe(38)
    expect(history[1].kind).toBe('transfer')
    for (const recruitingRating of ['97.45', '-0.1', 'NaN']) {
      await expect(
        t.mutation(api.rosterSpreadsheet.save, {
          ...args,
          expectedRevision: 2,
          rows: [edit({ recruitingRating })],
        }),
      ).rejects.toThrow(/rating/)
    }
    await t.mutation(api.rosterSpreadsheet.save, {
      ...args,
      expectedRevision: 2,
      rows: [edit({ recruitingRating: '' })],
    })
    expect((await getRows())[0].values).toMatchObject({
      recruitingRank: '37',
      recruitingRating: '',
    })
  })

  test('adds recruiting evaluations for incoming recruits', async () => {
    const { t, args } = await setup()
    const values = {
      ...emptySheetValues(2026, true),
      displayName: 'New Recruit',
      canonicalName: 'New Recruit',
      listedPosition: 'QB',
      recruitingRank: '1',
      recruitingRating: '1.000',
    }
    await t.mutation(api.rosterSpreadsheet.save, {
      ...args,
      rows: [
        {
          values,
          changedFields: [
            'displayName',
            'listedPosition',
            'recruitingRank',
            'recruitingRating',
          ],
        },
      ],
    })
    const data = await t.query(api.rosters.getSeasonDashboard, { season: 2026 })
    if (!data) throw new Error('Missing roster')
    const recruit = spreadsheetRows(data).find(
      (r) => r.values.displayName === 'New Recruit',
    )
    expect(recruit?.commitmentId).toBeDefined()
    expect(recruit?.values).toMatchObject({
      recruitingRank: '1',
      recruitingRating: '1',
    })
  })
  test('requires a valid, unrevoked, unexpired owner session', async () => {
    const { t, sessionId, edit, args } = await setup()
    for (const sessionToken of [
      '',
      'unknown-session-token-with-32-characters',
    ]) {
      await expect(
        t.mutation(api.rosterSpreadsheet.save, {
          ...args,
          sessionToken,
          rows: [edit({ jerseyNumber: '19' })],
        }),
      ).rejects.toThrow(/session/)
    }
    await t.run((ctx) =>
      ctx.db.patch('ownerSessions', sessionId, { expiresAt: Date.now() - 1 }),
    )
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [edit({ jerseyNumber: '19' })],
      }),
    ).rejects.toThrow(/expired/)
    await t.run((ctx) =>
      ctx.db.patch('ownerSessions', sessionId, {
        expiresAt: Date.now() + 60_000,
        revokedAt: Date.now(),
      }),
    )
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [edit({ jerseyNumber: '19' })],
      }),
    ).rejects.toThrow(/expired/)
  })

  test('patches edited cells, clears nullable cells, preserves unrelated facts, and writes one audit receipt', async () => {
    const { t, row, edit, args } = await setup()
    await t.run(async (ctx) => {
      if (!row.playerSeasonId || !row.playerId)
        throw new Error('Missing test IDs')
      await ctx.db.patch('playerSeasons', row.playerSeasonId, {
        jerseyNumber: 19,
        heightInches: 74,
        availabilityNote: 'Keep me',
        sourceLinks: [
          { label: 'Official roster', url: 'https://example.org/roster' },
        ],
      })
    })
    const result = await t.mutation(api.rosterSpreadsheet.save, {
      ...args,
      rows: [
        edit({
          jerseyNumber: '',
          weightPounds: '205',
          hometown: 'Ann Arbor',
          captain: 'true',
        }),
      ],
    })
    expect(result).toEqual({ created: 0, updated: 1, dataRevision: 2 })
    await t.run(async (ctx) => {
      const annual = await ctx.db.get('playerSeasons', row.playerSeasonId!)
      expect(annual).toMatchObject({
        jerseyNumber: null,
        heightInches: 74,
        weightPounds: 205,
        availabilityNote: 'Keep me',
        captain: true,
        sourceLinks: [
          { label: 'Official roster', url: 'https://example.org/roster' },
        ],
      })
      expect(await ctx.db.get('players', row.playerId!)).toMatchObject({
        hometown: 'Ann Arbor',
      })
      const events = await ctx.db.query('ownerAuditEvents').take(10)
      expect(
        events.filter((event) => event.action === 'save_roster_spreadsheet'),
      ).toHaveLength(1)
    })
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [edit({ jerseyNumber: '20' })],
      }),
    ).rejects.toThrow(/changed since/)
  })

  test('rejects wrong program, season, identity, history fields, and duplicate rows', async () => {
    const { t, row, edit, args } = await setup()
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        season: 2025,
        rows: [edit({ jerseyNumber: '19' })],
      }),
    ).rejects.toThrow(/matching Michigan/)
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [edit({ entrySeason: '2024' })],
      }),
    ).rejects.toThrow(/history/)
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [edit({ derivedEligibility: '2030' })],
      }),
    ).rejects.toThrow(/calculated/)
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [edit({ jerseyNumber: '19' }), edit({ jerseyNumber: '20' })],
      }),
    ).rejects.toThrow(/more than once/)
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [
          { ...edit({ jerseyNumber: '19' }), changedFields: ['toString'] },
        ],
      }),
    ).rejects.toThrow(/unknown/)
    await t.run(async (ctx) => {
      const other = await ctx.db.insert('programs', {
        key: 'other',
        name: 'Other',
      })
      await ctx.db.patch('playerSeasons', row.playerSeasonId!, {
        programId: other,
      })
    })
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [edit({ displayName: 'Do not change' })],
      }),
    ).rejects.toThrow(/matching Michigan/)
    expect(
      await t.run((ctx) => ctx.db.get('players', row.playerId!)),
    ).toMatchObject({ displayName: 'Sheet Player' })
  })

  test('creates a full player row and a recruit commitment, and rolls back the whole batch on error', async () => {
    const { t, row, edit, args } = await setup()
    const recruit = {
      ...emptySheetValues(2026, true),
      displayName: 'New Recruit',
      listedPosition: 'QB',
    }
    const newRow = {
      values: recruit,
      changedFields: ['displayName', 'listedPosition'],
    }
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [newRow, edit({ weightPounds: '-10' })],
      }),
    ).rejects.toThrow(/Weight/)
    let data = await t.query(api.rosters.getSeasonDashboard, { season: 2026 })
    expect(data?.commitments).toHaveLength(0)
    const player = {
      ...emptySheetValues(2026),
      displayName: 'New Transfer',
      listedPosition: 'LB',
      entryMethod: 'transfer',
      enrollmentSeason: '2024',
      heightInches: '75',
    }
    await t.mutation(api.rosterSpreadsheet.save, {
      ...args,
      rows: [
        newRow,
        {
          values: player,
          changedFields: [
            'displayName',
            'listedPosition',
            'entryMethod',
            'enrollmentSeason',
            'heightInches',
          ],
        },
      ],
    })
    data = await t.query(api.rosters.getSeasonDashboard, { season: 2026 })
    expect(data?.entries).toHaveLength(2)
    expect(data?.commitments).toHaveLength(1)
    const transfer = data?.entries.find(
      (entry) => entry.player?.displayName === 'New Transfer',
    )
    expect(transfer?.player).toMatchObject({
      entryMethod: 'transfer',
      state: 'enrolled',
    })
    expect(transfer?.season).toMatchObject({
      heightInches: 75,
      eligibilityEvidence: { enrollmentSeason: 2024 },
      positionRoom: 'Linebackers',
    })
    const commitment = data!.commitments[0].commitment
    const recruitRow = spreadsheetRows(data!).find(
      (item) => item.commitmentId === commitment._id,
    )!
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        expectedRevision: 2,
        rows: [
          {
            playerId: commitment.playerId,
            commitmentId: commitment._id,
            values: { ...recruitRow.values, offenseGames: '1' },
            changedFields: ['offenseGames'],
          },
        ],
      }),
    ).rejects.toThrow(/Recruits/)
    expect(
      await t.run((ctx) => ctx.db.get('players', row.playerId!)),
    ).toMatchObject({ displayName: 'Sheet Player' })
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        expectedRevision: 2,
        rows: [newRow],
      }),
    ).rejects.toThrow(/already exists/)
  })

  test('validates phase counts and replaces only the edited phase with honest manual provenance', async () => {
    const { t, row, edit, args } = await setup()
    const previous = {
      gamesPlayed: 3,
      snaps: 30,
      throughTeamGames: 5,
      sourceLabel: 'Original image',
      sourceImageSha256: 'b'.repeat(64),
      importedAt: 1,
    }
    await t.run((ctx) =>
      ctx.db.patch('playerSeasons', row.playerSeasonId!, {
        participationTotals: { offense: previous, specialTeams: previous },
      }),
    )
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [
          edit({ offenseGames: '2', offenseSnaps: '0', offenseThrough: '5' }),
        ],
      }),
    ).rejects.toThrow(/disagree/)
    await expect(
      t.mutation(api.rosterSpreadsheet.save, {
        ...args,
        rows: [
          edit({
            offenseGames: '2',
            offenseSnaps: '20',
            offenseThrough: '5',
            offensePass: '1',
            offensePassBlock: '1',
            offenseRun: '1',
            offenseRunBlock: '1',
          }),
        ],
      }),
    ).rejects.toThrow(/sum/)
    await t.mutation(api.rosterSpreadsheet.save, {
      ...args,
      rows: [
        edit({ offenseGames: '2', offenseSnaps: '20', offenseThrough: '5' }),
      ],
    })
    const annual = await t.run((ctx) =>
      ctx.db.get('playerSeasons', row.playerSeasonId!),
    )
    expect(annual?.participationTotals?.specialTeams).toEqual(previous)
    expect(annual?.participationTotals?.offense).toMatchObject({
      gamesPlayed: 2,
      snaps: 20,
      sourceLabel: 'Owner spreadsheet entry',
    })
    expect(
      annual?.participationTotals?.offense?.sourceImageSha256,
    ).toBeUndefined()
    expect(annual?.gamesPlayed).toBe(0)
    await t.mutation(api.rosterSpreadsheet.save, {
      ...args,
      expectedRevision: 2,
      rows: [
        edit({
          offenseGames: '',
          offenseSnaps: '',
          offenseThrough: '',
          defenseGames: '2',
          defenseSnaps: '20',
          defenseThrough: '5',
          defenseRunDefense: '8',
          defensePassRush: '10',
          defenseCoverage: '2',
        }),
      ],
    })
    const corrected = await t.run((ctx) =>
      ctx.db.get('playerSeasons', row.playerSeasonId!),
    )
    expect(corrected?.participationTotals?.offense).toBeUndefined()
    expect(corrected?.participationTotals?.specialTeams).toEqual(previous)
    expect(corrected?.participationTotals?.defense?.defenseBreakdown).toEqual({
      runDefense: 8,
      passRush: 10,
      coverage: 2,
    })
  })

  test('rejects invalid eligibility, starts, URLs and unrecognized values without losing valid edits', async () => {
    const { t, row, edit, args } = await setup()
    for (const values of [
      { starts: '2', gamesPlayed: '1' },
      { role: 'garbage' },
      { competitionSeasons: '2025, 2025' },
      { personSourceUrls: 'javascript:alert(1)' },
      { personSourceUrls: 'https://user:password@example.org' },
    ]) {
      await expect(
        t.mutation(api.rosterSpreadsheet.save, {
          ...args,
          rows: [edit({ displayName: 'Uncommitted change', ...values })],
        }),
      ).rejects.toThrow()
    }
    expect(
      await t.run((ctx) => ctx.db.get('players', row.playerId!)),
    ).toMatchObject({ displayName: 'Sheet Player' })
  })
})
