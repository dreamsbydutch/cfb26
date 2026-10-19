/// <reference types="vite/client" />
import { convexTest } from 'convex-test'
import { makeFunctionReference } from 'convex/server'
import { describe, expect, test } from 'vitest'
import schema from './schema'

const modules = import.meta.glob('./**/*.ts')
const preview = makeFunctionReference<'query'>(
  'officialFootballRosters:preview',
)
const apply = makeFunctionReference<'mutation'>('officialFootballRosters:apply')
const sessionToken = 'official-roster-test-not-a-real-session-token'
const row = {
  identityKey: 'historic-player-2005',
  name: 'Historic Player',
  firstObservedSeason: 2005,
  lastObservedSeason: 2006,
  listedPosition: 'OLB',
  listedClass: 'SR',
  jerseyNumber: 2,
  heightInches: 77,
  weightPounds: 245,
  hometown: 'Massillon, Ohio',
  highSchool: 'Washington',
  profileUrl: 'https://mgoblue.com/sports/football/roster/historic-player/123',
}
const input = {
  season: 2005,
  sourceSha256: 'a'.repeat(64),
  rows: [row],
  sessionToken,
}

async function setup() {
  const t = convexTest(schema, modules)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(sessionToken),
  )
  const tokenHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
  await t.run(async (ctx) => {
    await ctx.db.insert('programs', { key: 'michigan', name: 'Michigan' })
    await ctx.db.insert('ownerSessions', {
      tokenHash,
      createdAt: Date.now(),
      lastUsedAt: Date.now(),
      expiresAt: Date.now() + 600000,
      revokedAt: null,
    })
  })
  const backup = (revision: number) =>
    t.run((ctx) =>
      ctx.db.insert('backupManifests', {
        dataRevision: revision,
        completedAt: Date.now(),
        fingerprint: 'b'.repeat(64),
        reason: 'Before test roster import',
        schemaVersion: '3',
        counts: [{ dataset: 'players', count: 0 }],
      }),
    )
  return { t, backup }
}

describe('Official football roster import', () => {
  test('requires owner auth, a current backup, current revision, and the reviewed input', async () => {
    const { t, backup } = await setup()
    await expect(
      t.query(preview, { ...input, sessionToken: 'invalid' }),
    ).rejects.toThrow('session')
    const plan = await t.query(preview, input)
    const backupManifestId = await backup(0)
    const args = {
      ...input,
      backupManifestId,
      expectedRevision: 0,
      expectedFingerprint: plan.fingerprint,
    }
    await expect(
      t.mutation(apply, { ...args, sessionToken: 'invalid' }),
    ).rejects.toThrow('session')
    await expect(
      t.mutation(apply, { ...args, expectedRevision: 1 }),
    ).rejects.toThrow('preview')
    await expect(
      t.mutation(apply, { ...args, backupManifestId: await backup(1) }),
    ).rejects.toThrow('stale')
    await expect(
      t.mutation(apply, { ...args, rows: [{ ...row, weightPounds: 246 }] }),
    ).rejects.toThrow('reviewed preview')
    expect(await t.run((ctx) => ctx.db.query('players').take(10))).toEqual([])
  })

  test('imports historical observations without inventing eligibility, transfers, stats, or recruiting; repeat imports match', async () => {
    const { t, backup } = await setup()
    const plan = await t.query(preview, input)
    expect(plan.rows[0].action).toBe('create_person')
    const result = await t.mutation(apply, {
      ...input,
      backupManifestId: await backup(0),
      expectedRevision: 0,
      expectedFingerprint: plan.fingerprint,
    })
    expect(result).toEqual({
      dataRevision: 1,
      createdPeople: 1,
      createdSeasons: 1,
      updatedSeasons: 0,
    })
    const annual = await t.run((ctx) => ctx.db.query('playerSeasons').first())
    expect(annual).toMatchObject({
      season: 2005,
      listedClass: 'SR',
      rosterOnly: true,
      jerseyNumber: 2,
      heightInches: 77,
      eligibilityEvidence: { enrollmentSeason: null },
      scholarshipStatus: 'unknown',
    })
    const person = await t.run((ctx) => ctx.db.query('players').first())
    expect(person).toMatchObject({
      entryMethod: 'legacy',
      dataQuality: 'needs_review',
      state: 'alumni',
    })
    expect(
      await t.run((ctx) => ctx.db.query('movementEvents').take(10)),
    ).toEqual([])
    expect(await t.run((ctx) => ctx.db.query('evaluations').take(10))).toEqual(
      [],
    )
    const nextPlan = await t.query(preview, input)
    expect(nextPlan.rows[0].action).toBe('update_season')
    await t.mutation(apply, {
      ...input,
      backupManifestId: await backup(1),
      expectedRevision: 1,
      expectedFingerprint: nextPlan.fingerprint,
    })
    expect(
      (await t.run((ctx) => ctx.db.query('players').take(10))).length,
    ).toBe(1)
    expect(
      (await t.run((ctx) => ctx.db.query('playerSeasons').take(10))).length,
    ).toBe(1)
    expect(
      (await t.run((ctx) => ctx.db.query('ownerAuditEvents').take(10))).length,
    ).toBe(2)
  })

  test('preserves owner corrections, identities, eligibility, participation and other seasons', async () => {
    const { t, backup } = await setup()
    const plan = await t.query(preview, input)
    await t.mutation(apply, {
      ...input,
      backupManifestId: await backup(0),
      expectedRevision: 0,
      expectedFingerprint: plan.fingerprint,
    })
    const playerId = await t.run(async (ctx) => {
      const annual = await ctx.db.query('playerSeasons').first()
      if (!annual) throw new Error('Missing test annual')
      await ctx.db.patch('playerSeasons', annual._id, {
        dataQuality: 'owner_verified',
        jerseyNumber: 7,
        weightPounds: 240,
        heightInches: null,
        gamesPlayed: 10,
        starts: 5,
        rosterOnly: false,
        listedClass: '5TH',
        participationTotals: {
          defense: {
            gamesPlayed: 5,
            snaps: 300,
            throughTeamGames: 6,
            sourceLabel: 'Owner screenshot',
            importedAt: 1,
          },
        },
        eligibilityEvidence: {
          ...annual.eligibilityEvidence,
          enrollmentSeason: 2001,
        },
      })
      return annual.playerId
    })
    const before = await t.run((ctx) => ctx.db.get('players', playerId))
    const nextInput = {
      ...input,
      rows: [
        {
          ...row,
          playerId,
          name: 'Source Alias',
          jerseyNumber: 9,
          weightPounds: 260,
        },
      ],
    }
    const next = await t.query(preview, nextInput)
    await t.mutation(apply, {
      ...nextInput,
      backupManifestId: await backup(1),
      expectedRevision: 1,
      expectedFingerprint: next.fingerprint,
    })
    const annual = await t.run((ctx) => ctx.db.query('playerSeasons').first())
    expect(annual).toMatchObject({
      jerseyNumber: 7,
      weightPounds: 240,
      heightInches: 77,
      gamesPlayed: 10,
      starts: 5,
      listedClass: '5TH',
      eligibilityEvidence: { enrollmentSeason: 2001 },
      participationTotals: { defense: { snaps: 300 } },
    })
    expect(await t.run((ctx) => ctx.db.get('players', playerId))).toEqual(
      before,
    )
  })

  test('rejects malformed/duplicate rows and does not merge same-named people from different eras', async () => {
    const { t, backup } = await setup()
    await expect(t.query(preview, { ...input, season: 2004 })).rejects.toThrow(
      'Season',
    )
    await expect(
      t.query(preview, { ...input, rows: [row, row] }),
    ).rejects.toThrow('unique')
    await expect(
      t.query(preview, {
        ...input,
        rows: [{ ...row, profileUrl: 'https://example.com/player' }],
      }),
    ).rejects.toThrow('official')
    await expect(
      t.query(preview, { ...input, rows: [{ ...row, jerseyNumber: 100 }] }),
    ).rejects.toThrow('Jersey')
    for (const season of [2005, 2022]) {
      const args = {
        ...input,
        season,
        rows: [
          {
            ...row,
            name: 'Will Johnson',
            identityKey: `willjohnson-${season}`,
            firstObservedSeason: season,
            lastObservedSeason: season,
          },
        ],
      }
      const planned = await t.query(preview, args)
      await t.mutation(apply, {
        ...args,
        backupManifestId: await backup(planned.dataRevision),
        expectedRevision: planned.dataRevision,
        expectedFingerprint: planned.fingerprint,
      })
    }
    const people = await t.run((ctx) => ctx.db.query('players').take(10))
    expect(people.length).toBe(2)
    expect(new Set(people.map((p) => p.slug)).size).toBe(2)
    // An invalid later row aborts the complete batch before writes.
    const bad = {
      ...input,
      rows: [row, { ...row, identityKey: 'invalid-player', weightPounds: -1 }],
    }
    const result = await t.query(preview, input)
    await expect(
      t.mutation(apply, {
        ...bad,
        expectedRevision: result.dataRevision,
        expectedFingerprint: result.fingerprint,
        backupManifestId: await backup(result.dataRevision),
      }),
    ).rejects.toThrow()
    expect(
      (await t.run((ctx) => ctx.db.query('players').take(10))).length,
    ).toBe(2)
  })
})
