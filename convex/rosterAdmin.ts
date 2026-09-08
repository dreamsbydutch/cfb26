import { v } from 'convex/values'
import { env, mutation, query } from './_generated/server'
import { derivePositionRoom } from './playerDomain'
import type { Id } from './_generated/dataModel'
import type { MutationCtx, QueryCtx } from './_generated/server'

const SESSION_DURATION_MS = 12 * 60 * 60 * 1000
const MAX_BULK_ROWS = 100

const entryMethod = v.union(
  v.literal('high_school'),
  v.literal('transfer'),
  v.literal('walk_on'),
  v.literal('legacy'),
)
const personState = v.union(
  v.literal('prospect'),
  v.literal('enrolled'),
  v.literal('alumni'),
)
const dataQuality = v.union(
  v.literal('owner_verified'),
  v.literal('source_verified'),
  v.literal('needs_review'),
)
const sourceLink = v.object({ label: v.string(), url: v.string() })
const nullableNumber = v.union(v.number(), v.null())
const scholarshipStatus = v.union(
  v.literal('scholarship'),
  v.literal('walk_on'),
  v.literal('exempt'),
  v.literal('unknown'),
)
const depthStatus = v.union(
  v.literal('available'),
  v.literal('limited'),
  v.literal('out'),
  v.literal('unknown'),
)
const playerRole = v.union(
  v.literal('starter'),
  v.literal('rotation'),
  v.literal('reserve'),
  v.literal('unassigned'),
)
const rosterStatus = v.union(
  v.literal('active'),
  v.literal('inactive'),
  v.literal('departed'),
)
const evaluationKind = v.union(
  v.literal('recruiting'),
  v.literal('transfer'),
  v.literal('draft'),
  v.literal('owner'),
)
const evaluationDirection = v.union(
  v.literal('inbound'),
  v.literal('outbound'),
  v.literal('neutral'),
)

const eligibilityEvidence = v.object({
  ageBasedExceptionSeasons: v.number(),
  competitionSeasons: v.array(v.number()),
  enrollmentSeason: nullableNumber,
  legacyRedshirtSeason: nullableNumber,
  medicalHardshipSeasons: v.number(),
  otherExtensionSeasons: v.number(),
})

const playerSeasonInput = {
  availabilityNote: v.optional(v.string()),
  captain: v.boolean(),
  dataQuality,
  depthStatus,
  eligibleThroughSeasonOverride: nullableNumber,
  eligibilityEvidence,
  gamesPlayed: v.number(),
  heightInches: nullableNumber,
  honors: v.array(v.string()),
  jerseyNumber: nullableNumber,
  listedPosition: v.string(),
  roomOrder: nullableNumber,
  role: playerRole,
  rosterStatus,
  scholarshipStatus,
  season: v.number(),
  sourceLinks: v.array(sourceLink),
  starts: v.number(),
  weightPounds: nullableNumber,
}

const bulkPerson = v.object({
  canonicalName: v.string(),
  entryMethod,
  entrySeason: v.number(),
  highSchool: v.optional(v.string()),
  homeState: v.optional(v.string()),
  hometown: v.optional(v.string()),
  initialPosition: v.string(),
  state: personState,
})

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length)
  let difference = left.length ^ right.length
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }
  return difference === 0
}

function assertOwnerPassword(candidate: string) {
  const configured = env.CFB26_ADMIN_KEY
  if (
    !configured ||
    configured.length < 24 ||
    !constantTimeEqual(candidate, configured)
  ) {
    throw new Error('Owner access denied.')
  }
}

const toHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

async function hashToken(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  )
  return toHex(new Uint8Array(digest))
}

function createToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return toHex(bytes)
}

export async function requireOwnerSession(
  ctx: QueryCtx | MutationCtx,
  sessionToken: string,
) {
  if (sessionToken.length < 32) throw new Error('Owner session is invalid.')
  const tokenHash = await hashToken(sessionToken)
  const session = await ctx.db
    .query('ownerSessions')
    .withIndex('by_tokenHash', (q) => q.eq('tokenHash', tokenHash))
    .unique()
  if (
    !session ||
    session.revokedAt !== null ||
    session.expiresAt <= Date.now()
  ) {
    throw new Error('Owner session has expired.')
  }
  return session
}

export async function getMichiganDataRevision(ctx: QueryCtx | MutationCtx) {
  const state = await ctx.db
    .query('michiganDataRevisions')
    .withIndex('by_key', (q) => q.eq('key', 'michigan'))
    .unique()
  return state?.revision ?? 0
}

export async function advanceMichiganDataRevision(
  ctx: MutationCtx,
  args: {
    action: string
    backupManifestId?: Id<'backupManifests'>
    sessionId: Id<'ownerSessions'>
    target: string
    warnings?: Array<string>
  },
) {
  const startedAt = Date.now()
  await ctx.db.patch('ownerSessions', args.sessionId, {
    lastUsedAt: startedAt,
  })
  const state = await ctx.db
    .query('michiganDataRevisions')
    .withIndex('by_key', (q) => q.eq('key', 'michigan'))
    .unique()
  const revision = (state?.revision ?? 0) + 1
  if (state) {
    await ctx.db.patch('michiganDataRevisions', state._id, {
      revision,
      updatedAt: startedAt,
    })
  } else {
    await ctx.db.insert('michiganDataRevisions', {
      key: 'michigan',
      revision,
      updatedAt: startedAt,
    })
  }
  await ctx.db.insert('ownerAuditEvents', {
    action: args.action,
    actor: 'owner',
    backupManifestId: args.backupManifestId,
    completedAt: Date.now(),
    result: 'succeeded',
    sessionId: args.sessionId,
    startedAt,
    target: args.target,
    warnings: args.warnings ?? [],
  })
  return revision
}

export async function requireCurrentBackup(
  ctx: QueryCtx | MutationCtx,
  backupManifestId: Id<'backupManifests'>,
) {
  const [manifest, currentRevision] = await Promise.all([
    ctx.db.get('backupManifests', backupManifestId),
    getMichiganDataRevision(ctx),
  ])
  if (!manifest) throw new Error('A verified backup manifest is required.')
  if (manifest.dataRevision === undefined) {
    throw new Error(
      'This backup manifest predates data revisions. Export a new backup.',
    )
  }
  if (manifest.dataRevision !== currentRevision) {
    throw new Error(
      `Backup revision ${manifest.dataRevision} is stale; Michigan is at revision ${currentRevision}. Export a current backup.`,
    )
  }
  return manifest
}

function requiredText(value: string, label: string, maximum = 120) {
  const normalized = value.trim()
  if (!normalized) throw new Error(`${label} is required.`)
  if (normalized.length > maximum) {
    throw new Error(`${label} must be ${maximum} characters or fewer.`)
  }
  return normalized
}

function nullableText(value: string | undefined, maximum = 160) {
  const normalized = value?.trim()
  if (!normalized) return undefined
  if (normalized.length > maximum) throw new Error('Text value is too long.')
  return normalized
}

function wholeNumber(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be ${minimum}–${maximum}.`)
  }
  return value
}

function optionalWholeNumber(
  value: number | null,
  label: string,
  minimum: number,
  maximum: number,
) {
  return value === null ? null : wholeNumber(value, label, minimum, maximum)
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

async function getProgram(ctx: QueryCtx | MutationCtx, key: string) {
  const program = await ctx.db
    .query('programs')
    .withIndex('by_key', (q) => q.eq('key', key))
    .unique()
  if (!program) throw new Error(`Program ${key} was not found.`)
  return program
}

type NewPerson = {
  canonicalName: string
  entryMethod: 'high_school' | 'legacy' | 'transfer' | 'walk_on'
  entrySeason: number
  highSchool?: string
  homeState?: string
  hometown?: string
  initialPosition: string
  state: 'alumni' | 'enrolled' | 'prospect'
}

async function insertInitialSeason(
  ctx: MutationCtx,
  args: NewPerson,
  playerId: Id<'players'>,
  programId: Id<'programs'>,
) {
  const now = Date.now()
  if (args.state === 'prospect') {
    await ctx.db.insert('commitments', {
      dataQuality: 'owner_verified',
      initialPosition: requiredText(
        args.initialPosition,
        'Position',
        16,
      ).toUpperCase(),
      playerId,
      programId,
      season: args.entrySeason,
      sourceKey: `owner:${playerId}:commitment:${args.entrySeason}`,
      sourceLinks: [],
      status: 'committed',
    })
    return
  }
  const stintId = await ctx.db.insert('rosterStints', {
    dataQuality: 'owner_verified',
    eligibilityStartSeason: args.entrySeason,
    entryMethod: args.entryMethod,
    playerId,
    programId,
    sourceLinks: [],
    startSeason: args.entrySeason,
    endSeason: args.state === 'alumni' ? args.entrySeason : undefined,
    status: args.state === 'alumni' ? 'departed' : 'active',
  })
  await ctx.db.insert('playerSeasons', {
    captain: false,
    dataQuality: 'owner_verified',
    depthStatus: 'unknown',
    eligibleThroughSeasonOverride: null,
    eligibilityEvidence: {
      ageBasedExceptionSeasons: 0,
      competitionSeasons: [],
      enrollmentSeason: args.entrySeason,
      legacyRedshirtSeason: null,
      medicalHardshipSeasons: 0,
      otherExtensionSeasons: 0,
    },
    gamesPlayed: 0,
    heightInches: null,
    honors: [],
    jerseyNumber: null,
    listedPosition: requiredText(
      args.initialPosition,
      'Position',
      16,
    ).toUpperCase(),
    playerId,
    positionRoom: derivePositionRoom(args.initialPosition),
    programId,
    roomOrder: null,
    role: 'unassigned',
    rosterStatus: args.state === 'alumni' ? 'departed' : 'active',
    scholarshipStatus: args.entryMethod === 'walk_on' ? 'walk_on' : 'unknown',
    season: args.entrySeason,
    sourceLinks: [],
    starts: 0,
    stintId,
    weightPounds: null,
  })
  await ctx.db.insert('movementEvents', {
    kind:
      args.entryMethod === 'transfer'
        ? 'transfer_in'
        : args.entryMethod === 'walk_on'
          ? 'walk_on'
          : 'recruited',
    playerId,
    programId,
    season: args.entrySeason,
    sourceKey: `owner:${playerId}:arrival:${now}`,
  })
}

async function createPersonRecord(
  ctx: MutationCtx,
  args: NewPerson,
  programId: Id<'programs'>,
) {
  const canonicalName = requiredText(args.canonicalName, 'Canonical name', 100)
  const entrySeason = wholeNumber(args.entrySeason, 'Entry season', 2015, 2100)
  const slug = slugify(canonicalName)
  const duplicate = await ctx.db
    .query('players')
    .withIndex('by_slug', (q) => q.eq('slug', slug))
    .first()
  if (duplicate) throw new Error(`${canonicalName} already exists.`)
  const playerId = await ctx.db.insert('players', {
    canonicalName,
    dataQuality: 'owner_verified',
    displayName: canonicalName,
    entryMethod: args.entryMethod,
    entrySeason,
    highSchool: nullableText(args.highSchool, 120),
    homeState: nullableText(args.homeState, 24)?.toUpperCase(),
    hometown: nullableText(args.hometown, 80),
    slug,
    sourceLinks: [],
    sourceUpdatedAt: Date.now(),
    state: args.state,
  })
  await insertInitialSeason(ctx, { ...args, entrySeason }, playerId, programId)
  return playerId
}

export const login = mutation({
  args: { password: v.string() },
  handler: async (ctx, args) => {
    assertOwnerPassword(args.password)
    const token = createToken()
    const now = Date.now()
    await ctx.db.insert('ownerSessions', {
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
      lastUsedAt: now,
      revokedAt: null,
      tokenHash: await hashToken(token),
    })
    return { expiresAt: now + SESSION_DURATION_MS, token }
  },
})

export const sessionStatus = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    try {
      const session = await requireOwnerSession(ctx, args.sessionToken)
      return {
        authenticated: true,
        expiresAt: session.expiresAt,
        lastUsedAt: session.lastUsedAt,
      }
    } catch {
      return { authenticated: false, expiresAt: null, lastUsedAt: null }
    }
  },
})

export const logout = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await ctx.db.patch('ownerSessions', session._id, { revokedAt: Date.now() })
    return { revoked: true }
  },
})

export const revokeAllOwnerSessions = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const active = await ctx.db
      .query('ownerSessions')
      .withIndex('by_expiresAt', (q) => q.gt('expiresAt', Date.now()))
      .take(500)
    const revokedAt = Date.now()
    for (const session of active.filter((row) => row.revokedAt === null)) {
      await ctx.db.patch('ownerSessions', session._id, { revokedAt })
    }
    return { revoked: active.length }
  },
})

export const createPerson = mutation({
  args: {
    ...bulkPerson.fields,
    programKey: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'create_person',
      sessionId: session._id,
      target: args.canonicalName,
    })
    const program = await getProgram(ctx, args.programKey ?? 'michigan')
    return {
      playerId: await createPersonRecord(ctx, args, program._id),
    }
  },
})

export const setCommitmentStatus = mutation({
  args: {
    playerId: v.id('players'),
    season: v.number(),
    sessionToken: v.string(),
    status: v.union(v.literal('decommitted'), v.literal('enrolled')),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'set_commitment_status',
      sessionId: session._id,
      target: `${args.playerId}:${args.season}:${args.status}`,
    })
    const commitment = await ctx.db
      .query('commitments')
      .withIndex('by_playerId_and_season', (q) =>
        q.eq('playerId', args.playerId).eq('season', args.season),
      )
      .unique()
    if (!commitment) throw new Error('Commitment was not found.')
    if (commitment.status !== 'committed') {
      throw new Error('Only an active commitment can change status.')
    }
    const now = Date.now()
    await ctx.db.patch('commitments', commitment._id, {
      endedAt: now,
      status: args.status,
    })
    if (args.status === 'decommitted') {
      await ctx.db.insert('movementEvents', {
        kind: 'decommitted',
        playerId: args.playerId,
        programId: commitment.programId,
        season: args.season,
        sourceKey: `owner:${args.playerId}:decommitment:${now}`,
      })
      return { status: args.status }
    }
    const player = await ctx.db.get('players', args.playerId)
    if (!player) throw new Error('Person was not found.')
    await insertInitialSeason(
      ctx,
      {
        canonicalName: player.canonicalName,
        entryMethod: player.entryMethod,
        entrySeason: args.season,
        initialPosition: commitment.initialPosition,
        state: 'enrolled',
      },
      player._id,
      commitment.programId,
    )
    await ctx.db.patch('players', player._id, { state: 'enrolled' })
    return { status: args.status }
  },
})

export const upsertPlayerSeason = mutation({
  args: {
    ...playerSeasonInput,
    playerId: v.id('players'),
    programKey: v.optional(v.string()),
    sessionToken: v.string(),
    stintId: v.id('rosterStints'),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'upsert_player_season',
      sessionId: session._id,
      target: `${args.playerId}:${args.season}`,
    })
    const [player, stint, program] = await Promise.all([
      ctx.db.get('players', args.playerId),
      ctx.db.get('rosterStints', args.stintId),
      getProgram(ctx, args.programKey ?? 'michigan'),
    ])
    if (!player || !stint || stint.playerId !== args.playerId) {
      throw new Error('Player stint was not found.')
    }
    const season = wholeNumber(args.season, 'Season', 2015, 2100)
    const listedPosition = requiredText(
      args.listedPosition,
      'Position',
      16,
    ).toUpperCase()
    const gamesPlayed = wholeNumber(args.gamesPlayed, 'Games played', 0, 30)
    const starts = wholeNumber(args.starts, 'Starts', 0, gamesPlayed)
    const document = {
      availabilityNote: nullableText(args.availabilityNote, 240),
      captain: args.captain,
      dataQuality: args.dataQuality,
      depthStatus: args.depthStatus,
      eligibleThroughSeasonOverride: args.eligibleThroughSeasonOverride,
      eligibilityEvidence: args.eligibilityEvidence,
      gamesPlayed,
      heightInches: optionalWholeNumber(args.heightInches, 'Height', 48, 96),
      honors: args.honors.map((honor) => requiredText(honor, 'Honor', 100)),
      jerseyNumber: optionalWholeNumber(args.jerseyNumber, 'Jersey', 0, 99),
      listedPosition,
      playerId: args.playerId,
      positionRoom: derivePositionRoom(listedPosition),
      programId: program._id,
      roomOrder: optionalWholeNumber(args.roomOrder, 'Room order', 1, 200),
      role: args.role,
      rosterStatus: args.rosterStatus,
      scholarshipStatus: args.scholarshipStatus,
      season,
      sourceLinks: args.sourceLinks,
      starts,
      stintId: args.stintId,
      weightPounds: optionalWholeNumber(args.weightPounds, 'Weight', 100, 500),
    }
    const existing = await ctx.db
      .query('playerSeasons')
      .withIndex('by_playerId_and_season', (q) =>
        q.eq('playerId', args.playerId).eq('season', season),
      )
      .unique()
    if (existing) {
      await ctx.db.replace('playerSeasons', existing._id, document)
      return existing._id
    }
    return ctx.db.insert('playerSeasons', document)
  },
})

export const applySeasonGrid = mutation({
  args: {
    rows: v.array(
      v.object({
        depthStatus,
        gamesPlayed: v.number(),
        jerseyNumber: nullableNumber,
        listedPosition: v.string(),
        playerSeasonId: v.id('playerSeasons'),
        role: playerRole,
        roomOrder: nullableNumber,
        rosterStatus,
        scholarshipStatus,
        starts: v.number(),
      }),
    ),
    sessionToken: v.string(),
  },
  returns: v.object({ updated: v.number() }),
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'apply_season_grid',
      sessionId: session._id,
      target: `${args.rows.length} player seasons`,
    })
    if (args.rows.length === 0 || args.rows.length > 200) {
      throw new Error('Season grid requires between 1 and 200 changed rows.')
    }
    const program = await getProgram(ctx, 'michigan')
    const seen = new Set<string>()
    for (const row of args.rows) {
      if (seen.has(String(row.playerSeasonId))) {
        throw new Error('A Player Season appears more than once in the grid.')
      }
      seen.add(String(row.playerSeasonId))
      const stored = await ctx.db.get('playerSeasons', row.playerSeasonId)
      if (!stored || stored.programId !== program._id) {
        throw new Error('A Michigan Player Season was not found.')
      }
      const gamesPlayed = wholeNumber(row.gamesPlayed, 'Games played', 0, 30)
      const starts = wholeNumber(row.starts, 'Starts', 0, gamesPlayed)
      const listedPosition = requiredText(
        row.listedPosition,
        'Position',
        16,
      ).toUpperCase()
      await ctx.db.patch('playerSeasons', row.playerSeasonId, {
        depthStatus: row.depthStatus,
        gamesPlayed,
        jerseyNumber: optionalWholeNumber(row.jerseyNumber, 'Jersey', 0, 99),
        listedPosition,
        positionRoom: derivePositionRoom(listedPosition),
        role: row.role,
        roomOrder: optionalWholeNumber(row.roomOrder, 'Room order', 1, 200),
        rosterStatus: row.rosterStatus,
        scholarshipStatus: row.scholarshipStatus,
        starts,
      })
    }
    return { updated: args.rows.length }
  },
})

export const addEvaluation = mutation({
  args: {
    dataQuality,
    direction: evaluationDirection,
    evaluatedAt: v.number(),
    kind: evaluationKind,
    notes: v.optional(v.string()),
    playerId: v.id('players'),
    provider: v.string(),
    rank: nullableNumber,
    scale: v.string(),
    score: nullableNumber,
    sessionToken: v.string(),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'add_evaluation',
      sessionId: session._id,
      target: `${args.playerId}:${args.kind}`,
    })
    if (!(await ctx.db.get('players', args.playerId))) {
      throw new Error('Person was not found.')
    }
    return ctx.db.insert('evaluations', {
      dataQuality: args.dataQuality,
      direction: args.direction,
      evaluatedAt: args.evaluatedAt,
      kind: args.kind,
      notes: nullableText(args.notes, 500),
      playerId: args.playerId,
      provider: requiredText(args.provider, 'Provider', 80),
      rank: args.rank,
      scale: requiredText(args.scale, 'Scale', 40),
      score: args.score,
      sourceUrl: nullableText(args.sourceUrl, 500),
    })
  },
})

export const upsertDraftOutcome = mutation({
  args: {
    combine: v.optional(
      v.object({
        fortyYardSeconds: nullableNumber,
        heightInches: nullableNumber,
        weightPounds: nullableNumber,
      }),
    ),
    overallPick: nullableNumber,
    playerId: v.id('players'),
    round: nullableNumber,
    sessionToken: v.string(),
    status: v.union(
      v.literal('drafted'),
      v.literal('undrafted_free_agent'),
      v.literal('practice_squad'),
      v.literal('later_entry'),
    ),
    team: v.optional(v.string()),
    year: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'upsert_draft_outcome',
      sessionId: session._id,
      target: `${args.playerId}:${args.year}`,
    })
    if (!(await ctx.db.get('players', args.playerId))) {
      throw new Error('Person was not found.')
    }
    const year = wholeNumber(args.year, 'Draft year', 2015, 2100)
    if (
      args.status === 'drafted' &&
      (args.round === null || args.overallPick === null)
    ) {
      throw new Error('Drafted players require a round and overall pick.')
    }
    const document = {
      combine: args.combine,
      dataQuality: 'owner_verified' as const,
      overallPick: optionalWholeNumber(
        args.overallPick,
        'Overall pick',
        1,
        500,
      ),
      playerId: args.playerId,
      round: optionalWholeNumber(args.round, 'Round', 1, 20),
      sourceLinks: [],
      status: args.status,
      team: nullableText(args.team, 80),
      year,
    }
    const existing = await ctx.db
      .query('draftOutcomes')
      .withIndex('by_playerId_and_year', (q) =>
        q.eq('playerId', args.playerId).eq('year', year),
      )
      .unique()
    if (existing) {
      await ctx.db.replace('draftOutcomes', existing._id, document)
      return existing._id
    }
    return ctx.db.insert('draftOutcomes', document)
  },
})

export const upsertNflIdentity = mutation({
  args: {
    entryPath: v.union(
      v.literal('drafted'),
      v.literal('undrafted_free_agent'),
      v.literal('practice_squad'),
      v.literal('later_entry'),
    ),
    firstSeason: v.number(),
    playerId: v.id('players'),
    providerId: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'upsert_nfl_identity',
      sessionId: session._id,
      target: String(args.playerId),
    })
    if (!(await ctx.db.get('players', args.playerId)))
      throw new Error('Person was not found.')
    const providerId = requiredText(args.providerId, 'nflverse GSIS ID', 80)
    const existing = await ctx.db
      .query('nflIdentities')
      .withIndex('by_provider_and_providerId', (q) =>
        q.eq('provider', 'nflverse').eq('providerId', providerId),
      )
      .unique()
    const document = {
      dataQuality: 'owner_verified' as const,
      entryPath: args.entryPath,
      firstSeason: wholeNumber(
        args.firstSeason,
        'First NFL season',
        2015,
        2100,
      ),
      playerId: args.playerId,
      provider: 'nflverse',
      providerId,
      sourceLinks: [],
    }
    if (existing) {
      await ctx.db.replace('nflIdentities', existing._id, document)
      return existing._id
    }
    return ctx.db.insert('nflIdentities', document)
  },
})

export const upsertNflWeeklyRoster = mutation({
  args: {
    playerId: v.id('players'),
    season: v.number(),
    sessionToken: v.string(),
    status: v.union(
      v.literal('active'),
      v.literal('practice_squad'),
      v.literal('injured_reserve'),
      v.literal('reserve'),
      v.literal('inactive'),
    ),
    team: v.string(),
    week: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'upsert_nfl_weekly_roster',
      sessionId: session._id,
      target: `${args.playerId}:${args.season}:${args.week}`,
    })
    const identity = await ctx.db
      .query('nflIdentities')
      .withIndex('by_playerId', (q) => q.eq('playerId', args.playerId))
      .unique()
    if (!identity) throw new Error('NFL identity was not found.')
    const season = wholeNumber(args.season, 'NFL season', 2015, 2100)
    const week = wholeNumber(args.week, 'NFL week', 0, 30)
    const sourceKey = `owner:nfl-roster:${args.playerId}:${season}:${week}`
    const existing = await ctx.db
      .query('nflWeeklyRosters')
      .withIndex('by_sourceKey', (q) => q.eq('sourceKey', sourceKey))
      .unique()
    const document = {
      nflIdentityId: identity._id,
      playerId: args.playerId,
      season,
      sourceKey,
      sourceUpdatedAt: Date.now(),
      status: args.status,
      team: requiredText(args.team, 'NFL team', 12).toUpperCase(),
      week,
    }
    if (existing) {
      await ctx.db.replace('nflWeeklyRosters', existing._id, document)
      return existing._id
    }
    return ctx.db.insert('nflWeeklyRosters', document)
  },
})

export const recordDeparture = mutation({
  args: {
    destinationProgramId: v.optional(v.id('programs')),
    finalSeason: v.number(),
    kind: v.union(
      v.literal('transfer_out'),
      v.literal('graduated'),
      v.literal('retired'),
      v.literal('dismissed'),
    ),
    note: v.optional(v.string()),
    playerId: v.id('players'),
    sessionToken: v.string(),
    stintId: v.id('rosterStints'),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'record_departure',
      sessionId: session._id,
      target: `${args.playerId}:${args.finalSeason}:${args.kind}`,
    })
    const [player, stint] = await Promise.all([
      ctx.db.get('players', args.playerId),
      ctx.db.get('rosterStints', args.stintId),
    ])
    if (!player || !stint || stint.playerId !== player._id) {
      throw new Error('Player stint was not found.')
    }
    const finalSeason = wholeNumber(
      args.finalSeason,
      'Final season',
      stint.startSeason,
      2100,
    )
    if (args.kind === 'transfer_out' && !args.destinationProgramId) {
      throw new Error('Transfer destination is required.')
    }
    await ctx.db.patch('rosterStints', stint._id, {
      endSeason: finalSeason,
      status: 'departed',
      toProgramId: args.destinationProgramId,
    })
    const playerSeason = await ctx.db
      .query('playerSeasons')
      .withIndex('by_playerId_and_season', (q) =>
        q.eq('playerId', player._id).eq('season', finalSeason),
      )
      .unique()
    if (playerSeason) {
      await ctx.db.patch('playerSeasons', playerSeason._id, {
        rosterStatus: 'departed',
      })
    }
    await ctx.db.patch('players', player._id, { state: 'alumni' })
    await ctx.db.insert('movementEvents', {
      kind: args.kind,
      note: nullableText(args.note, 300),
      playerId: player._id,
      programId: stint.programId,
      season: finalSeason + 1,
      sourceKey: `owner:${player._id}:departure:${Date.now()}`,
      toProgramId: args.destinationProgramId,
    })
    return { departed: true }
  },
})

export const previewRosterImport = query({
  args: { rows: v.array(bulkPerson), sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    if (args.rows.length > MAX_BULK_ROWS) {
      throw new Error(`A bulk operation is limited to ${MAX_BULK_ROWS} rows.`)
    }
    return Promise.all(
      args.rows.map(async (row, index) => {
        const slug = slugify(row.canonicalName)
        const existing = slug
          ? await ctx.db
              .query('players')
              .withIndex('by_slug', (q) => q.eq('slug', slug))
              .first()
          : null
        return {
          action: existing ? ('match' as const) : ('create' as const),
          errors: [
            ...(!slug ? ['Canonical name is invalid.'] : []),
            ...(row.entrySeason < 2015 ? ['Entry season predates scope.'] : []),
          ],
          existingPlayerId: existing?._id ?? null,
          index,
          normalizedName: requiredText(
            row.canonicalName,
            'Canonical name',
            100,
          ),
        }
      }),
    )
  },
})

export const applyRosterImport = mutation({
  args: {
    backupManifestId: v.id('backupManifests'),
    programKey: v.optional(v.string()),
    rows: v.array(bulkPerson),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    if (args.rows.length > MAX_BULK_ROWS) {
      throw new Error(`A bulk operation is limited to ${MAX_BULK_ROWS} rows.`)
    }
    await requireCurrentBackup(ctx, args.backupManifestId)
    await advanceMichiganDataRevision(ctx, {
      action: 'apply_roster_import',
      backupManifestId: args.backupManifestId,
      sessionId: session._id,
      target: `${args.rows.length} roster rows`,
    })
    const operationId = await ctx.db.insert('operationRuns', {
      backupManifestId: args.backupManifestId,
      completedAt: null,
      errors: [],
      fingerprint: `bulk:${Date.now()}:${args.rows.length}`,
      kind: 'bulk_import',
      startedAt: Date.now(),
      status: 'running',
      warnings: [],
    })
    const program = await getProgram(ctx, args.programKey ?? 'michigan')
    const created: Array<Id<'players'>> = []
    const matched: Array<Id<'players'>> = []
    for (const row of args.rows) {
      const existing = await ctx.db
        .query('players')
        .withIndex('by_slug', (q) => q.eq('slug', slugify(row.canonicalName)))
        .first()
      if (existing) {
        matched.push(existing._id)
        continue
      }
      created.push(await createPersonRecord(ctx, row, program._id))
    }
    await ctx.db.patch('operationRuns', operationId, {
      completedAt: Date.now(),
      status: 'succeeded',
    })
    return { created, matched }
  },
})

export const startStint = mutation({
  args: {
    entryMethod,
    fromProgramId: v.optional(v.id('programs')),
    initialPosition: v.string(),
    playerId: v.id('players'),
    programKey: v.optional(v.string()),
    season: v.number(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'start_stint',
      sessionId: session._id,
      target: `${args.playerId}:${args.season}`,
    })
    const [player, program] = await Promise.all([
      ctx.db.get('players', args.playerId),
      getProgram(ctx, args.programKey ?? 'michigan'),
    ])
    if (!player) throw new Error('Person was not found.')
    const season = wholeNumber(args.season, 'Season', 2015, 2100)
    const duplicate = await ctx.db
      .query('rosterStints')
      .withIndex('by_playerId_and_startSeason', (q) =>
        q.eq('playerId', player._id).eq('startSeason', season),
      )
      .unique()
    if (duplicate) throw new Error('A stint already starts in that season.')
    const stintId = await ctx.db.insert('rosterStints', {
      dataQuality: 'owner_verified',
      eligibilityStartSeason: season,
      entryMethod: args.entryMethod,
      fromProgramId: args.fromProgramId,
      playerId: player._id,
      programId: program._id,
      sourceLinks: [],
      startSeason: season,
      status: 'active',
    })
    const listedPosition = requiredText(
      args.initialPosition,
      'Position',
      16,
    ).toUpperCase()
    await ctx.db.insert('playerSeasons', {
      captain: false,
      dataQuality: 'owner_verified',
      depthStatus: 'unknown',
      eligibleThroughSeasonOverride: null,
      eligibilityEvidence: {
        ageBasedExceptionSeasons: 0,
        competitionSeasons: [],
        enrollmentSeason: season,
        legacyRedshirtSeason: null,
        medicalHardshipSeasons: 0,
        otherExtensionSeasons: 0,
      },
      gamesPlayed: 0,
      heightInches: null,
      honors: [],
      jerseyNumber: null,
      listedPosition,
      playerId: player._id,
      positionRoom: derivePositionRoom(listedPosition),
      programId: program._id,
      roomOrder: null,
      role: 'unassigned',
      rosterStatus: 'active',
      scholarshipStatus: args.entryMethod === 'walk_on' ? 'walk_on' : 'unknown',
      season,
      sourceLinks: [],
      starts: 0,
      stintId,
      weightPounds: null,
    })
    await ctx.db.insert('movementEvents', {
      fromProgramId: args.fromProgramId,
      kind: args.entryMethod === 'transfer' ? 'transfer_in' : 'returned',
      playerId: player._id,
      programId: program._id,
      season,
      sourceKey: `owner:${player._id}:stint:${season}:${Date.now()}`,
    })
    await ctx.db.patch('players', player._id, { state: 'enrolled' })
    return { stintId }
  },
})

export const previewRollover = query({
  args: {
    fromSeason: v.number(),
    programKey: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const program = await getProgram(ctx, args.programKey ?? 'michigan')
    const current = await ctx.db
      .query('playerSeasons')
      .withIndex('by_programId_and_season_and_room', (q) =>
        q.eq('programId', program._id).eq('season', args.fromSeason),
      )
      .take(500)
    const next = await ctx.db
      .query('playerSeasons')
      .withIndex('by_programId_and_season_and_room', (q) =>
        q.eq('programId', program._id).eq('season', args.fromSeason + 1),
      )
      .take(500)
    const existing = new Set(next.map((row) => row.playerId))
    return {
      carry: current.filter(
        (row) => row.rosterStatus === 'active' && !existing.has(row.playerId),
      ),
      existing: next.length,
      fromSeason: args.fromSeason,
      toSeason: args.fromSeason + 1,
      warnings: current
        .filter((row) => row.scholarshipStatus === 'unknown')
        .map((row) => `${row.playerId} has unknown scholarship status.`),
    }
  },
})

export const applyRollover = mutation({
  args: {
    backupManifestId: v.id('backupManifests'),
    fromSeason: v.number(),
    programKey: v.optional(v.string()),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await requireCurrentBackup(ctx, args.backupManifestId)
    await advanceMichiganDataRevision(ctx, {
      action: 'apply_rollover',
      backupManifestId: args.backupManifestId,
      sessionId: session._id,
      target: `${args.fromSeason}:${args.fromSeason + 1}`,
    })
    const operationId = await ctx.db.insert('operationRuns', {
      backupManifestId: args.backupManifestId,
      completedAt: null,
      errors: [],
      fingerprint: `rollover:${args.fromSeason}:${Date.now()}`,
      kind: 'rollover',
      startedAt: Date.now(),
      status: 'running',
      warnings: [],
    })
    const program = await getProgram(ctx, args.programKey ?? 'michigan')
    const current = await ctx.db
      .query('playerSeasons')
      .withIndex('by_programId_and_season_and_room', (q) =>
        q.eq('programId', program._id).eq('season', args.fromSeason),
      )
      .take(500)
    let created = 0
    for (const row of current.filter(
      (season) => season.rosterStatus === 'active',
    )) {
      const existing = await ctx.db
        .query('playerSeasons')
        .withIndex('by_playerId_and_season', (q) =>
          q.eq('playerId', row.playerId).eq('season', args.fromSeason + 1),
        )
        .unique()
      if (existing) continue
      const {
        _creationTime: _ignoredCreation,
        _id: _ignoredId,
        ...values
      } = row
      await ctx.db.insert('playerSeasons', {
        ...values,
        captain: false,
        gamesPlayed: 0,
        honors: [],
        season: args.fromSeason + 1,
        starts: 0,
      })
      created += 1
    }
    await ctx.db.patch('operationRuns', operationId, {
      completedAt: Date.now(),
      status: 'succeeded',
    })
    return { created, season: args.fromSeason + 1 }
  },
})

export const createBackupManifest = mutation({
  args: {
    counts: v.array(v.object({ count: v.number(), dataset: v.string() })),
    dataRevision: v.number(),
    fingerprint: v.string(),
    reason: v.string(),
    schemaVersion: v.string(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    if (!args.counts.length) throw new Error('Backup counts are required.')
    const dataRevision = await getMichiganDataRevision(ctx)
    if (args.dataRevision !== dataRevision) {
      throw new Error(
        `Michigan changed during export: expected revision ${args.dataRevision}, now ${dataRevision}. Export again.`,
      )
    }
    const startedAt = Date.now()
    const manifestId = await ctx.db.insert('backupManifests', {
      completedAt: Date.now(),
      counts: args.counts,
      dataRevision,
      fingerprint: requiredText(args.fingerprint, 'Fingerprint', 128),
      reason: requiredText(args.reason, 'Reason', 240),
      schemaVersion: requiredText(args.schemaVersion, 'Schema version', 40),
    })
    await ctx.db.insert('ownerAuditEvents', {
      action: 'create_backup_manifest',
      actor: 'owner',
      backupManifestId: manifestId,
      completedAt: Date.now(),
      result: 'succeeded',
      sessionId: session._id,
      startedAt,
      target: `Michigan revision ${dataRevision}`,
      warnings: [],
    })
    return manifestId
  },
})

const exportDataset = v.union(
  v.literal('players'),
  v.literal('commitments'),
  v.literal('rosterStints'),
  v.literal('playerSeasons'),
  v.literal('evaluations'),
  v.literal('movementEvents'),
  v.literal('draftOutcomes'),
  v.literal('playerGames'),
  v.literal('nflIdentities'),
  v.literal('nflWeeklyRosters'),
  v.literal('nflPlayerGames'),
  v.literal('nflSeasonSummaries'),
  v.literal('providerIdentities'),
  v.literal('seasonRules'),
  v.literal('unresolvedMatches'),
)

export const exportMichiganPage = query({
  args: {
    cursor: v.union(v.string(), v.null()),
    dataset: exportDataset,
    numItems: v.number(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const paginationOpts = {
      cursor: args.cursor,
      numItems: wholeNumber(args.numItems, 'Page size', 1, 100),
    }
    switch (args.dataset) {
      case 'players':
        return ctx.db.query('players').paginate(paginationOpts)
      case 'commitments':
        return ctx.db.query('commitments').paginate(paginationOpts)
      case 'rosterStints':
        return ctx.db.query('rosterStints').paginate(paginationOpts)
      case 'playerSeasons':
        return ctx.db.query('playerSeasons').paginate(paginationOpts)
      case 'evaluations':
        return ctx.db.query('evaluations').paginate(paginationOpts)
      case 'movementEvents':
        return ctx.db.query('movementEvents').paginate(paginationOpts)
      case 'draftOutcomes':
        return ctx.db.query('draftOutcomes').paginate(paginationOpts)
      case 'playerGames':
        return ctx.db.query('playerGames').paginate(paginationOpts)
      case 'nflIdentities':
        return ctx.db.query('nflIdentities').paginate(paginationOpts)
      case 'nflWeeklyRosters':
        return ctx.db.query('nflWeeklyRosters').paginate(paginationOpts)
      case 'nflPlayerGames':
        return ctx.db.query('nflPlayerGames').paginate(paginationOpts)
      case 'nflSeasonSummaries':
        return ctx.db.query('nflSeasonSummaries').paginate(paginationOpts)
      case 'providerIdentities':
        return ctx.db.query('providerIdentities').paginate(paginationOpts)
      case 'seasonRules':
        return ctx.db.query('seasonRules').paginate(paginationOpts)
      case 'unresolvedMatches':
        return ctx.db.query('unresolvedMatches').paginate(paginationOpts)
    }
  },
})

async function dependentRows(
  ctx: QueryCtx | MutationCtx,
  sourcePlayerId: Id<'players'>,
) {
  const [
    commitments,
    stints,
    seasons,
    evaluations,
    identities,
    movements,
    drafts,
    games,
    nflIdentities,
    nflWeeks,
    nflGames,
    nflSeasons,
  ] = await Promise.all([
    ctx.db
      .query('commitments')
      .withIndex('by_playerId_and_season', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(100),
    ctx.db
      .query('rosterStints')
      .withIndex('by_playerId_and_startSeason', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(50),
    ctx.db
      .query('playerSeasons')
      .withIndex('by_playerId_and_season', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(100),
    ctx.db
      .query('evaluations')
      .withIndex('by_playerId_and_evaluatedAt', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(100),
    ctx.db
      .query('providerIdentities')
      .withIndex('by_playerId_and_provider', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(100),
    ctx.db
      .query('movementEvents')
      .withIndex('by_playerId_and_season', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(100),
    ctx.db
      .query('draftOutcomes')
      .withIndex('by_playerId_and_year', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(50),
    ctx.db
      .query('playerGames')
      .withIndex('by_playerId_and_season', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(500),
    ctx.db
      .query('nflIdentities')
      .withIndex('by_playerId', (q) => q.eq('playerId', sourcePlayerId))
      .take(20),
    ctx.db
      .query('nflWeeklyRosters')
      .withIndex('by_playerId_and_season_and_week', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(500),
    ctx.db
      .query('nflPlayerGames')
      .withIndex('by_playerId_and_gameId', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(500),
    ctx.db
      .query('nflSeasonSummaries')
      .withIndex('by_playerId_and_season', (q) =>
        q.eq('playerId', sourcePlayerId),
      )
      .take(100),
  ])
  return {
    commitments,
    drafts,
    evaluations,
    games,
    identities,
    movements,
    nflGames,
    nflIdentities,
    nflSeasons,
    nflWeeks,
    seasons,
    stints,
  }
}

export const previewIdentityRepair = query({
  args: {
    playerId: v.id('players'),
    sessionToken: v.string(),
  },
  returns: v.object({
    counts: v.object({
      commitments: v.number(),
      drafts: v.number(),
      evaluations: v.number(),
      games: v.number(),
      identities: v.number(),
      movements: v.number(),
      nflGames: v.number(),
      nflIdentities: v.number(),
      nflSeasons: v.number(),
      nflWeeks: v.number(),
      seasons: v.number(),
      stints: v.number(),
    }),
    name: v.union(v.string(), v.null()),
    playerId: v.id('players'),
  }),
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const [player, rows] = await Promise.all([
      ctx.db.get('players', args.playerId),
      dependentRows(ctx, args.playerId),
    ])
    return {
      counts: {
        commitments: rows.commitments.length,
        drafts: rows.drafts.length,
        evaluations: rows.evaluations.length,
        games: rows.games.length,
        identities: rows.identities.length,
        movements: rows.movements.length,
        nflGames: rows.nflGames.length,
        nflIdentities: rows.nflIdentities.length,
        nflSeasons: rows.nflSeasons.length,
        nflWeeks: rows.nflWeeks.length,
        seasons: rows.seasons.length,
        stints: rows.stints.length,
      },
      name: player?.displayName ?? null,
      playerId: args.playerId,
    }
  },
})

export const mergePlayers = mutation({
  args: {
    backupManifestId: v.id('backupManifests'),
    sessionToken: v.string(),
    sourcePlayerId: v.id('players'),
    targetPlayerId: v.id('players'),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    if (args.sourcePlayerId === args.targetPlayerId)
      throw new Error('Choose two people.')
    await requireCurrentBackup(ctx, args.backupManifestId)
    await advanceMichiganDataRevision(ctx, {
      action: 'merge_players',
      backupManifestId: args.backupManifestId,
      sessionId: session._id,
      target: `${args.sourcePlayerId}->${args.targetPlayerId}`,
    })
    const [source, target, rows] = await Promise.all([
      ctx.db.get('players', args.sourcePlayerId),
      ctx.db.get('players', args.targetPlayerId),
      dependentRows(ctx, args.sourcePlayerId),
    ])
    if (!source || !target) throw new Error('Person was not found.')
    const operationId = await ctx.db.insert('operationRuns', {
      backupManifestId: args.backupManifestId,
      completedAt: null,
      errors: [],
      fingerprint: `merge:${source._id}:${target._id}:${Date.now()}`,
      kind: 'merge',
      startedAt: Date.now(),
      status: 'running',
      warnings: [],
    })
    const targetGames = await ctx.db
      .query('playerGames')
      .withIndex('by_playerId_and_season', (q) => q.eq('playerId', target._id))
      .take(500)
    if (
      rows.games.some((row) =>
        targetGames.some((targetRow) => targetRow.gameId === row.gameId),
      )
    ) {
      throw new Error('Merge has a duplicate Player Game; resolve it first.')
    }
    for (const row of rows.commitments)
      await ctx.db.patch('commitments', row._id, { playerId: target._id })
    for (const row of rows.stints)
      await ctx.db.patch('rosterStints', row._id, { playerId: target._id })
    for (const row of rows.seasons)
      await ctx.db.patch('playerSeasons', row._id, { playerId: target._id })
    for (const row of rows.evaluations)
      await ctx.db.patch('evaluations', row._id, { playerId: target._id })
    for (const row of rows.identities)
      await ctx.db.patch('providerIdentities', row._id, {
        playerId: target._id,
      })
    for (const row of rows.movements)
      await ctx.db.patch('movementEvents', row._id, { playerId: target._id })
    for (const row of rows.drafts)
      await ctx.db.patch('draftOutcomes', row._id, { playerId: target._id })
    for (const row of rows.games)
      await ctx.db.patch('playerGames', row._id, { playerId: target._id })
    for (const row of rows.nflIdentities)
      await ctx.db.patch('nflIdentities', row._id, { playerId: target._id })
    for (const row of rows.nflWeeks)
      await ctx.db.patch('nflWeeklyRosters', row._id, { playerId: target._id })
    for (const row of rows.nflGames)
      await ctx.db.patch('nflPlayerGames', row._id, { playerId: target._id })
    for (const row of rows.nflSeasons)
      await ctx.db.patch('nflSeasonSummaries', row._id, {
        playerId: target._id,
      })
    await ctx.db.delete('players', source._id)
    await ctx.db.patch('operationRuns', operationId, {
      completedAt: Date.now(),
      status: 'succeeded',
    })
    return { mergedInto: target._id }
  },
})

export const deleteErroneousPerson = mutation({
  args: {
    backupManifestId: v.id('backupManifests'),
    playerId: v.id('players'),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await requireCurrentBackup(ctx, args.backupManifestId)
    await advanceMichiganDataRevision(ctx, {
      action: 'delete_erroneous_person',
      backupManifestId: args.backupManifestId,
      sessionId: session._id,
      target: String(args.playerId),
    })
    const person = await ctx.db.get('players', args.playerId)
    if (!person) throw new Error('Person was not found.')
    const rows = await dependentRows(ctx, args.playerId)
    const operationId = await ctx.db.insert('operationRuns', {
      backupManifestId: args.backupManifestId,
      completedAt: null,
      errors: [],
      fingerprint: `delete:${person._id}:${Date.now()}`,
      kind: 'delete',
      startedAt: Date.now(),
      status: 'running',
      warnings: [],
    })
    for (const row of rows.commitments)
      await ctx.db.delete('commitments', row._id)
    for (const row of rows.stints) await ctx.db.delete('rosterStints', row._id)
    for (const row of rows.seasons)
      await ctx.db.delete('playerSeasons', row._id)
    for (const row of rows.evaluations)
      await ctx.db.delete('evaluations', row._id)
    for (const row of rows.identities)
      await ctx.db.delete('providerIdentities', row._id)
    for (const row of rows.movements)
      await ctx.db.delete('movementEvents', row._id)
    for (const row of rows.drafts) await ctx.db.delete('draftOutcomes', row._id)
    for (const row of rows.games) await ctx.db.delete('playerGames', row._id)
    for (const row of rows.nflIdentities)
      await ctx.db.delete('nflIdentities', row._id)
    for (const row of rows.nflWeeks)
      await ctx.db.delete('nflWeeklyRosters', row._id)
    for (const row of rows.nflGames)
      await ctx.db.delete('nflPlayerGames', row._id)
    for (const row of rows.nflSeasons)
      await ctx.db.delete('nflSeasonSummaries', row._id)
    await ctx.db.delete('players', person._id)
    await ctx.db.patch('operationRuns', operationId, {
      completedAt: Date.now(),
      status: 'succeeded',
    })
    return { deleted: true }
  },
})

export const upsertSeasonRules = mutation({
  args: {
    baseEligibilitySeasons: v.number(),
    clockSeasons: v.number(),
    legacyRedshirtExtendsClock: v.boolean(),
    playoffByeCount: v.number(),
    playoffChampionBidCount: v.number(),
    playoffFieldSize: v.number(),
    rosterLimit: nullableNumber,
    season: v.number(),
    sessionToken: v.string(),
    version: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'upsert_season_rules',
      sessionId: session._id,
      target: String(args.season),
    })
    const { sessionToken: _sessionToken, ...document } = args
    const existing = await ctx.db
      .query('seasonRules')
      .withIndex('by_season', (q) => q.eq('season', args.season))
      .unique()
    if (existing) {
      await ctx.db.replace('seasonRules', existing._id, document)
      return existing._id
    }
    return ctx.db.insert('seasonRules', document)
  },
})

export const setConferenceChampion = mutation({
  args: {
    conference: v.string(),
    programId: v.id('programs'),
    season: v.number(),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'set_conference_champion',
      sessionId: session._id,
      target: `${args.season}:${args.conference}:${args.programId}`,
    })
    if (!(await ctx.db.get('programs', args.programId))) {
      throw new Error('Program was not found.')
    }
    const season = wholeNumber(args.season, 'Season', 2015, 2100)
    const conference = requiredText(args.conference, 'Conference', 80)
    const existing = await ctx.db
      .query('conferenceChampions')
      .withIndex('by_season_and_conference', (q) =>
        q.eq('season', season).eq('conference', conference),
      )
      .unique()
    const document = {
      conference,
      programId: args.programId,
      season,
      sourceLinks: [],
    }
    if (existing) {
      await ctx.db.replace('conferenceChampions', existing._id, document)
      return existing._id
    }
    return ctx.db.insert('conferenceChampions', document)
  },
})

export const resolveProviderIdentity = mutation({
  args: {
    matchId: v.id('unresolvedMatches'),
    playerId: v.id('players'),
    sessionToken: v.string(),
  },
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    await advanceMichiganDataRevision(ctx, {
      action: 'resolve_provider_identity',
      sessionId: session._id,
      target: `${args.matchId}:${args.playerId}`,
    })
    const [match, player] = await Promise.all([
      ctx.db.get('unresolvedMatches', args.matchId),
      ctx.db.get('players', args.playerId),
    ])
    if (!match || !player) throw new Error('Match or person was not found.')
    const existing = await ctx.db
      .query('providerIdentities')
      .withIndex('by_provider_and_providerId', (q) =>
        q.eq('provider', match.provider).eq('providerId', match.sourceKey),
      )
      .unique()
    if (!existing) {
      await ctx.db.insert('providerIdentities', {
        confirmed: true,
        playerId: player._id,
        provider: match.provider,
        providerId: match.sourceKey,
        sourceUpdatedAt: Date.now(),
      })
    }
    await ctx.db.patch('unresolvedMatches', match._id, {
      resolvedPlayerId: player._id,
      status: 'resolved',
    })
    return { resolved: true }
  },
})

export const getDataHealth = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args) => {
    await requireOwnerSession(ctx, args.sessionToken)
    const [unresolved, sync, operations, backups, audit, revision] =
      await Promise.all([
        ctx.db
          .query('unresolvedMatches')
          .withIndex('by_status_and_lastSeenAt', (q) => q.eq('status', 'open'))
          .order('desc')
          .take(100),
        ctx.db.query('teamDataSyncState').take(20),
        ctx.db
          .query('operationRuns')
          .withIndex('by_kind_and_startedAt')
          .order('desc')
          .take(50),
        ctx.db
          .query('backupManifests')
          .withIndex('by_completedAt')
          .order('desc')
          .take(10),
        ctx.db
          .query('ownerAuditEvents')
          .withIndex('by_startedAt')
          .order('desc')
          .take(100),
        getMichiganDataRevision(ctx),
      ])
    return { audit, backups, operations, revision, sync, unresolved }
  },
})
