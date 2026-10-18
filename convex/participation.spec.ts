/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { describe, expect, test } from 'vitest'
import schema from './schema'
import { api } from './_generated/api'

const modules = import.meta.glob('./**/*.ts')
const token = 'participation-test-session-not-a-real-credential'
const snapshot = {
  gamesPlayed: 2,
  snaps: 8,
  throughTeamGames: 5,
  sourceLabel: 'Test special teams source',
  sourceImageSha256: 'b'.repeat(64),
  importedAt: 1,
}
const input = {
  season: 2026,
  phase: 'offense' as const,
  throughTeamGames: 5,
  sourceLabel: 'Test screenshot',
  sourceImageSha256: 'a'.repeat(64),
  rows: [
    {
      name: 'Test Player',
      jerseyNumber: 10,
      gamesPlayed: 3,
      snaps: 30,
      offenseBreakdown: { pass: 10, passBlock: 5, run: 5, runBlock: 10 },
    },
  ],
}

async function setup() {
  const t = convexTest(schema, modules)
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  const tokenHash = [...new Uint8Array(hash)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
  const ids = await t.run(async (ctx) => {
    const programId = await ctx.db.insert('programs', {
      key: 'michigan',
      name: 'Michigan',
    })
    const playerId = await ctx.db.insert('players', {
      canonicalName: 'Test Player',
      displayName: 'Test Player',
      slug: 'test-player',
      dataQuality: 'owner_verified',
      entryMethod: 'high_school',
      entrySeason: 2025,
      sourceLinks: [],
      sourceUpdatedAt: 1,
      state: 'enrolled',
    })
    const stintId = await ctx.db.insert('rosterStints', {
      playerId,
      programId,
      dataQuality: 'owner_verified',
      eligibilityStartSeason: 2025,
      entryMethod: 'high_school',
      sourceLinks: [],
      startSeason: 2025,
      status: 'active',
    })
    const seasonId = await ctx.db.insert('playerSeasons', {
      playerId,
      programId,
      stintId,
      season: 2026,
      captain: false,
      dataQuality: 'owner_verified',
      depthStatus: 'available',
      eligibleThroughSeasonOverride: null,
      eligibilityEvidence: {
        ageBasedExceptionSeasons: 0,
        competitionSeasons: [],
        enrollmentSeason: 2025,
        legacyRedshirtSeason: null,
        medicalHardshipSeasons: 0,
        otherExtensionSeasons: 0,
      },
      gamesPlayed: 5,
      heightInches: null,
      honors: [],
      jerseyNumber: 10,
      listedPosition: 'WR',
      positionRoom: 'Receivers',
      roomOrder: null,
      role: 'rotation',
      rosterStatus: 'active',
      scholarshipStatus: 'scholarship',
      sourceLinks: [],
      starts: 1,
      weightPounds: null,
      participationTotals: { specialTeams: snapshot },
    })
    const sessionId = await ctx.db.insert('ownerSessions', {
      tokenHash,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      expiresAt: Date.now() + 600_000,
      revokedAt: null,
    })
    const backupManifestId = await ctx.db.insert('backupManifests', {
      completedAt: 1,
      counts: [{ dataset: 'playerSeasons', count: 1 }],
      dataRevision: 0,
      fingerprint: 'test-backup',
      reason: 'Test',
      schemaVersion: '3',
    })
    return {
      programId,
      playerId,
      stintId,
      seasonId,
      sessionId,
      backupManifestId,
    }
  })
  return { t, ...ids }
}

describe('season participation import', () => {
  test('dashboard recruiting summary keeps composite rank and rating from one evaluation', async () => {
    const { t, playerId } = await setup()
    const recruitingIds = await t.run(async (ctx) => {
      const base = {
        playerId,
        dataQuality: 'source_verified' as const,
        direction: 'inbound' as const,
        provider: '247Sports Composite',
        scale: '0-1',
      }
      await ctx.db.insert('evaluations', {
        ...base,
        kind: 'transfer',
        evaluatedAt: 3,
        rank: 5,
        score: 0.98,
      })
      await ctx.db.insert('evaluations', {
        ...base,
        kind: 'recruiting',
        provider: '247Sports',
        scale: '0-100',
        evaluatedAt: 4,
        rank: 2,
        score: 99,
      })
      return Promise.all([
        ctx.db.insert('evaluations', {
          ...base,
          kind: 'recruiting',
          evaluatedAt: 1,
          rank: 40,
          score: 0.97,
        }),
        ctx.db.insert('evaluations', {
          ...base,
          kind: 'recruiting',
          evaluatedAt: 2,
          rank: 38,
          score: 0.9745,
        }),
      ])
    })
    const dashboard = () =>
      t.query(api.rosters.getSeasonDashboard, { season: 2026 })
    expect((await dashboard())?.entries[0].recruiting).toEqual({
      rank: 38,
      rating: 0.9745,
      kind: 'recruiting',
      provider: '247Sports Composite',
    })
    await t.run(async (ctx) => {
      for (const id of recruitingIds) await ctx.db.delete('evaluations', id)
    })
    expect((await dashboard())?.entries[0].recruiting).toEqual({
      rank: 5,
      rating: 0.98,
      kind: 'transfer',
      provider: '247Sports Composite',
    })
  })
  test('persists defensive breakdowns and preserves the other phases', async () => {
    const { t, backupManifestId, seasonId } = await setup()
    const defenseBreakdown = { runDefense: 10, passRush: 5, coverage: 15 }
    await t.mutation(api.rosterAdmin.applyParticipationImport, {
      ...input,
      phase: 'defense',
      throughTeamGames: 6,
      rows: [
        {
          name: 'Test Player',
          jerseyNumber: 10,
          gamesPlayed: 3,
          snaps: 30,
          defenseBreakdown,
        },
      ],
      sessionToken: token,
      backupManifestId,
      expectedRevision: 0,
    })
    const stored = await t.run((ctx) => ctx.db.get('playerSeasons', seasonId))
    expect(stored?.participationTotals?.defense?.defenseBreakdown).toEqual(
      defenseBreakdown,
    )
    expect(stored?.participationTotals?.defense?.throughTeamGames).toBe(6)
    expect(stored?.participationTotals?.specialTeams).toEqual(snapshot)
    expect(stored?.gamesPlayed).toBe(5)
  })
  test('requires a valid owner session for both preview and writes', async () => {
    const { t, backupManifestId, sessionId } = await setup()
    for (const sessionToken of [
      '',
      'wrong-session-token-with-at-least-32-characters',
    ]) {
      await expect(
        t.query(api.rosterAdmin.previewParticipationImport, {
          ...input,
          sessionToken,
        }),
      ).rejects.toThrow(/session/)
      await expect(
        t.mutation(api.rosterAdmin.applyParticipationImport, {
          ...input,
          sessionToken,
          backupManifestId,
          expectedRevision: 0,
        }),
      ).rejects.toThrow(/session/)
    }
    await t.run((ctx) =>
      ctx.db.patch('ownerSessions', sessionId, { revokedAt: Date.now() }),
    )
    await expect(
      t.query(api.rosterAdmin.previewParticipationImport, {
        ...input,
        sessionToken: token,
      }),
    ).rejects.toThrow(/expired/)
  })

  test('saves one phase atomically, preserves overall games and other phases, and replays without adding snaps', async () => {
    const { t, backupManifestId, seasonId } = await setup()
    const preview = await t.query(api.rosterAdmin.previewParticipationImport, {
      ...input,
      sessionToken: token,
    })
    expect(preview.errors).toEqual([])
    expect(preview.rows[0].before).toBeNull()
    const result = await t.mutation(api.rosterAdmin.applyParticipationImport, {
      ...input,
      sessionToken: token,
      backupManifestId,
      expectedRevision: preview.dataRevision,
    })
    expect(result).toEqual({ updated: 1, dataRevision: 1 })
    const stored = await t.run((ctx) => ctx.db.get('playerSeasons', seasonId))
    expect(stored?.gamesPlayed).toBe(5)
    expect(stored?.starts).toBe(1)
    expect(stored?.participationTotals?.offense?.snaps).toBe(30)
    expect(stored?.participationTotals?.specialTeams).toEqual(snapshot)
    await t.run((ctx) =>
      ctx.db.patch('backupManifests', backupManifestId, { dataRevision: 1 }),
    )
    expect(
      await t.mutation(api.rosterAdmin.applyParticipationImport, {
        ...input,
        sessionToken: token,
        backupManifestId,
        expectedRevision: 1,
      }),
    ).toEqual({ updated: 0, dataRevision: 1 })
    const audits = await t.run((ctx) =>
      ctx.db.query('ownerAuditEvents').take(10),
    )
    expect(audits).toHaveLength(1)
    expect(audits[0].action).toBe('import_season_participation')
  })

  test('an unmatched row blocks every row and a stale preview or backup blocks writes', async () => {
    const { t, backupManifestId, seasonId } = await setup()
    await expect(
      t.mutation(api.rosterAdmin.applyParticipationImport, {
        ...input,
        rows: [
          ...input.rows,
          { ...input.rows[0], name: 'Missing Player', jerseyNumber: 22 },
        ],
        sessionToken: token,
        backupManifestId,
        expectedRevision: 0,
      }),
    ).rejects.toThrow(/expected one roster match/)
    expect(
      (await t.run((ctx) => ctx.db.get('playerSeasons', seasonId)))
        ?.participationTotals?.offense,
    ).toBeUndefined()
    await expect(
      t.mutation(api.rosterAdmin.applyParticipationImport, {
        ...input,
        sessionToken: token,
        backupManifestId,
        expectedRevision: 1,
      }),
    ).rejects.toThrow(/changed after preview/)
    await t.run((ctx) =>
      ctx.db.patch('backupManifests', backupManifestId, { dataRevision: 1 }),
    )
    await expect(
      t.mutation(api.rosterAdmin.applyParticipationImport, {
        ...input,
        sessionToken: token,
        backupManifestId,
        expectedRevision: 0,
      }),
    ).rejects.toThrow(/stale/)
  })

  test('annual edits preserve imported totals and rollover clears them', async () => {
    const { t, seasonId, backupManifestId, playerId, stintId } = await setup()
    const stored = await t.run((ctx) => ctx.db.get('playerSeasons', seasonId))
    if (!stored) throw new Error('Missing fixture')
    const {
      _id: _ignoredId,
      _creationTime: _ignoredTime,
      programId: _ignoredProgram,
      positionRoom: _ignoredRoom,
      participationTotals,
      ...annual
    } = stored
    await t.mutation(api.rosterAdmin.upsertPlayerSeason, {
      ...annual,
      playerId,
      stintId,
      sessionToken: token,
      gamesPlayed: 6,
    })
    expect(
      (await t.run((ctx) => ctx.db.get('playerSeasons', seasonId)))
        ?.participationTotals,
    ).toEqual(participationTotals)
    await t.run((ctx) =>
      ctx.db.patch('backupManifests', backupManifestId, { dataRevision: 1 }),
    )
    await t.mutation(api.rosterAdmin.applyRollover, {
      fromSeason: 2026,
      sessionToken: token,
      backupManifestId,
    })
    const next = await t.run((ctx) =>
      ctx.db
        .query('playerSeasons')
        .withIndex('by_playerId_and_season', (q) =>
          q.eq('playerId', playerId).eq('season', 2027),
        )
        .unique(),
    )
    expect(next?.gamesPlayed).toBe(0)
    expect(next?.participationTotals).toBeUndefined()
  })
})
