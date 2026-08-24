import { v } from 'convex/values'
import { env, mutation } from './_generated/server'
import { publicRosterStint } from './eligibility'

const depthTier = v.union(
  v.literal('starters'),
  v.literal('rotation'),
  v.literal('depth'),
  v.literal('prospects'),
  v.literal('walk-ons'),
)

const injuryKind = v.union(
  v.literal('short_term'),
  v.literal('long_term'),
  v.literal('season_ending'),
)

const entrySource = v.union(
  v.literal('high_school'),
  v.literal('transfer'),
  v.literal('walk_on'),
)

const departureKind = v.union(
  v.literal('transfer_out'),
  v.literal('graduated'),
  v.literal('retired'),
  v.literal('dismissed'),
)

function constantTimeEqual(left: string, right: string) {
  const length = Math.max(left.length, right.length)
  let difference = left.length ^ right.length

  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0)
  }

  return difference === 0
}

function assertAdminKey(candidate: string) {
  const configured = env.CFB26_ADMIN_KEY
  if (
    !configured ||
    configured.length < 24 ||
    !constantTimeEqual(candidate, configured)
  ) {
    throw new Error('Admin access denied')
  }
}

function boundedText(value: string | undefined, label: string, limit: number) {
  const normalized = value?.trim()
  if (!normalized) return undefined
  if (normalized.length > limit) {
    throw new Error(`${label} must be ${limit} characters or fewer`)
  }
  return normalized
}

function requiredText(value: string, label: string, limit: number) {
  const normalized = boundedText(value, label, limit)
  if (!normalized) throw new Error(`${label} is required`)
  return normalized
}

function footballPosition(value: string, label = 'Position') {
  const position = value.trim().toUpperCase()
  if (!/^[A-Z][A-Z0-9/-]{0,15}$/.test(position)) {
    throw new Error(`${label} must be a short football position label`)
  }
  return position
}

function wholeNumber(
  value: number,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${label} must be a whole number from ${minimum} to ${maximum}`,
    )
  }
  return value
}

function optionalWholeNumber(
  value: number | undefined,
  label: string,
  minimum: number,
  maximum: number,
) {
  return value === undefined
    ? undefined
    : wholeNumber(value, label, minimum, maximum)
}

function optionalNumber(
  value: number | undefined,
  label: string,
  minimum: number,
  maximum: number,
) {
  if (value === undefined) return undefined
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be from ${minimum} to ${maximum}`)
  }
  return value
}

function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const updatePlayer = mutation({
  args: {
    adminKey: v.string(),
    depthTier: v.union(v.null(), depthTier),
    effectiveSeason: v.number(),
    extraEligibilitySeasons: v.number(),
    injury: v.union(
      v.null(),
      v.object({
        expectedReturn: v.optional(v.string()),
        kind: injuryKind,
        note: v.optional(v.string()),
      }),
    ),
    playerId: v.id('players'),
    position: v.string(),
    positionChangeNote: v.optional(v.string()),
    programKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminKey(args.adminKey)

    const position = footballPosition(args.position)
    if (
      !Number.isInteger(args.extraEligibilitySeasons) ||
      args.extraEligibilitySeasons < 0 ||
      args.extraEligibilitySeasons > 5
    ) {
      throw new Error('Extra eligibility must be a whole number from 0 to 5')
    }
    if (
      !Number.isInteger(args.effectiveSeason) ||
      args.effectiveSeason < 1900 ||
      args.effectiveSeason > 2100
    ) {
      throw new Error('Effective season is outside the supported range')
    }

    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (query) =>
        query.eq('key', args.programKey ?? 'michigan'),
      )
      .unique()
    if (!program) throw new Error('Program not found')

    const stints = await ctx.db
      .query('rosterStints')
      .withIndex('by_playerId_and_startSeason', (query) =>
        query.eq('playerId', args.playerId),
      )
      .take(20)
    const stint = stints.find(
      (candidate) => candidate.programId === program._id,
    )
    if (!stint) throw new Error('Roster stint not found')

    const now = Date.now()
    const positionChangeNote = boundedText(
      args.positionChangeNote,
      'Position-change note',
      160,
    )
    const positionChanges = [...(stint.positionChanges ?? [])]
    if (position !== stint.position) {
      positionChanges.push({
        effectiveSeason: args.effectiveSeason,
        fromPosition: stint.position,
        note: positionChangeNote,
        recordedAt: now,
        toPosition: position,
      })
    }

    const injury = args.injury
      ? {
          expectedReturn: boundedText(
            args.injury.expectedReturn,
            'Expected return',
            80,
          ),
          kind: args.injury.kind,
          note: boundedText(args.injury.note, 'Injury note', 160),
          updatedAt: now,
        }
      : undefined

    await ctx.db.patch('rosterStints', stint._id, {
      depthTierOverride: args.depthTier ?? undefined,
      extraEligibilitySeasons:
        args.extraEligibilitySeasons === 0
          ? undefined
          : args.extraEligibilitySeasons,
      injury,
      position,
      positionChanges:
        positionChanges.length === 0 ? undefined : positionChanges.slice(-20),
    })

    const updated = await ctx.db.get('rosterStints', stint._id)
    if (!updated) throw new Error('Roster stint was not available after update')

    return publicRosterStint(updated)
  },
})

export const addPlayer = mutation({
  args: {
    adminKey: v.string(),
    displayName: v.string(),
    eligibilityStartSeason: v.number(),
    entrySource,
    extraEligibilitySeasons: v.number(),
    highSchool: v.string(),
    homeState: v.string(),
    hometown: v.string(),
    jerseyNumber: v.optional(v.number()),
    medicalExtensionSeasons: v.number(),
    position: v.string(),
    previousProgramId: v.optional(v.id('programs')),
    programKey: v.optional(v.string()),
    recruiting: v.object({
      compositeOverallRank: v.optional(v.number()),
      compositePositionRank: v.optional(v.number()),
      compositeRating: v.optional(v.number()),
      compositeStateRank: v.optional(v.number()),
      heightInches: v.optional(v.number()),
      position: v.string(),
      service247OverallRank: v.optional(v.number()),
      service247PositionRank: v.optional(v.number()),
      service247Rating: v.optional(v.number()),
      service247StateRank: v.optional(v.number()),
      weightPounds: v.optional(v.number()),
    }),
    recruitingSeason: v.number(),
    rosterHeightInches: v.optional(v.number()),
    rosterWeightPounds: v.optional(v.number()),
    startSeason: v.number(),
  },
  handler: async (ctx, args) => {
    assertAdminKey(args.adminKey)

    const displayName = requiredText(args.displayName, 'Player name', 100)
    const highSchool = requiredText(args.highSchool, 'High school', 120)
    const homeState = requiredText(
      args.homeState,
      'Home state',
      24,
    ).toUpperCase()
    const hometown = requiredText(args.hometown, 'Hometown', 80)
    const position = footballPosition(args.position)
    const recruitingPosition = footballPosition(
      args.recruiting.position,
      'Recruiting position',
    )
    const recruitingSeason = wholeNumber(
      args.recruitingSeason,
      'Original recruiting season',
      1900,
      2100,
    )
    const startSeason = wholeNumber(
      args.startSeason,
      'Michigan arrival season',
      1900,
      2100,
    )
    const eligibilityStartSeason = wholeNumber(
      args.eligibilityStartSeason,
      'Eligibility start season',
      1900,
      2100,
    )
    const medicalExtensionSeasons = wholeNumber(
      args.medicalExtensionSeasons,
      'Medical extensions',
      0,
      5,
    )
    const extraEligibilitySeasons = wholeNumber(
      args.extraEligibilitySeasons,
      'Extra eligibility',
      0,
      5,
    )
    const jerseyNumber = optionalWholeNumber(
      args.jerseyNumber,
      'Jersey number',
      0,
      99,
    )
    const rosterHeightInches = optionalWholeNumber(
      args.rosterHeightInches,
      'Roster height',
      48,
      96,
    )
    const rosterWeightPounds = optionalWholeNumber(
      args.rosterWeightPounds,
      'Roster weight',
      100,
      500,
    )
    const recruitingHeightInches = optionalWholeNumber(
      args.recruiting.heightInches,
      'Recruiting height',
      48,
      96,
    )
    const recruitingWeightPounds = optionalWholeNumber(
      args.recruiting.weightPounds,
      'Recruiting weight',
      100,
      500,
    )
    const compositeRating = optionalNumber(
      args.recruiting.compositeRating,
      'Composite rating',
      0,
      1,
    )
    const service247Rating = optionalNumber(
      args.recruiting.service247Rating,
      '247 rating',
      0,
      100,
    )
    const compositeOverallRank = optionalWholeNumber(
      args.recruiting.compositeOverallRank,
      'Composite overall rank',
      1,
      10000,
    )
    const compositePositionRank = optionalWholeNumber(
      args.recruiting.compositePositionRank,
      'Composite position rank',
      1,
      10000,
    )
    const compositeStateRank = optionalWholeNumber(
      args.recruiting.compositeStateRank,
      'Composite state rank',
      1,
      10000,
    )
    const service247OverallRank = optionalWholeNumber(
      args.recruiting.service247OverallRank,
      '247 overall rank',
      1,
      10000,
    )
    const service247PositionRank = optionalWholeNumber(
      args.recruiting.service247PositionRank,
      '247 position rank',
      1,
      10000,
    )
    const service247StateRank = optionalWholeNumber(
      args.recruiting.service247StateRank,
      '247 state rank',
      1,
      10000,
    )

    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (query) =>
        query.eq('key', args.programKey ?? 'michigan'),
      )
      .unique()
    if (!program) throw new Error('Program not found')

    if (args.entrySource === 'transfer' && !args.previousProgramId) {
      throw new Error('A previous school is required for a transfer')
    }
    if (args.previousProgramId) {
      if (args.previousProgramId === program._id) {
        throw new Error('A previous school must be outside Michigan')
      }
      const previousProgram = await ctx.db.get(
        'programs',
        args.previousProgramId,
      )
      if (!previousProgram) throw new Error('Previous school not found')
    }
    if (args.entrySource === 'high_school' && args.previousProgramId) {
      throw new Error('Previous school applies only to transfers and walk-ons')
    }

    const baseSlug = slugify(displayName)
    if (!baseSlug)
      throw new Error('Player name needs at least one letter or number')
    const legacyKey = `manual:${baseSlug}:${recruitingSeason}:${slugify(highSchool)}`
    const [sameSlug, duplicate] = await Promise.all([
      ctx.db
        .query('players')
        .withIndex('by_slug', (query) => query.eq('slug', baseSlug))
        .take(20),
      ctx.db
        .query('players')
        .withIndex('by_legacyKey', (query) => query.eq('legacyKey', legacyKey))
        .first(),
    ])
    if (
      duplicate ||
      sameSlug.some(
        (player) =>
          player.displayName.trim().toLowerCase() === displayName.toLowerCase(),
      )
    ) {
      throw new Error('This player already exists in the roster ledger')
    }

    const movementKind =
      args.entrySource === 'high_school'
        ? 'recruited'
        : args.entrySource === 'transfer'
          ? 'transfer_in'
          : 'walk_on'
    const legacyCode =
      args.entrySource === 'high_school'
        ? 'R'
        : args.entrySource === 'transfer'
          ? 'T'
          : 'W'
    const cohort = await ctx.db
      .query('movementEvents')
      .withIndex('by_programId_and_season_and_kind', (query) =>
        query
          .eq('programId', program._id)
          .eq('season', startSeason)
          .eq('kind', movementKind),
      )
      .take(200)
    const classRank =
      cohort.reduce(
        (highest, event) => Math.max(highest, event.cohortRank ?? 0),
        0,
      ) + 1
    const now = Date.now()
    const playerId = await ctx.db.insert('players', {
      displayName,
      highSchool,
      homeState,
      hometown,
      legacyKey,
      slug: baseSlug,
      sourceUpdatedAt: now,
    })

    await ctx.db.insert('recruitingProfiles', {
      classRank,
      compositeOverallRank,
      compositePositionRank,
      compositeRating,
      compositeStateRank,
      heightInches: recruitingHeightInches,
      legacyKey,
      playerId,
      position: recruitingPosition,
      recruitingSeason,
      service247OverallRank,
      service247PositionRank,
      service247Rating,
      service247StateRank,
      source: args.entrySource,
      weightPounds: recruitingWeightPounds,
    })
    const stintId = await ctx.db.insert('rosterStints', {
      eligibilityEndSeason:
        eligibilityStartSeason +
        4 +
        medicalExtensionSeasons +
        extraEligibilitySeasons,
      eligibilityLeaveSeason: recruitingSeason + 2,
      eligibilityStartSeason,
      extraEligibilitySeasons:
        extraEligibilitySeasons === 0 ? undefined : extraEligibilitySeasons,
      heightInches: rosterHeightInches,
      jerseyNumber,
      legacyKey,
      medicalExtensionSeasons:
        medicalExtensionSeasons === 0 ? undefined : medicalExtensionSeasons,
      playerId,
      position,
      programId: program._id,
      startSeason,
      status: 'active',
      weightPounds: rosterWeightPounds,
    })
    await ctx.db.insert('programCareerSummaries', {
      gamesPlayed: 0,
      legacyKey,
      playerId,
      programId: program._id,
      recentRating: 0,
      snaps: 0,
    })
    await ctx.db.insert('movementEvents', {
      cohortRank: classRank,
      fromProgramId: args.previousProgramId,
      kind: movementKind,
      legacyCode,
      playerId,
      programId: program._id,
      season: startSeason,
      sourceKey: `${legacyKey}:arrival`,
    })

    const stint = await ctx.db.get('rosterStints', stintId)
    if (!stint) throw new Error('Roster stint was not available after addition')

    return { playerId, stint: publicRosterStint(stint) }
  },
})

export const removePlayer = mutation({
  args: {
    adminKey: v.string(),
    departureKind,
    destinationProgramId: v.optional(v.id('programs')),
    finalSeason: v.number(),
    playerId: v.id('players'),
    programKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminKey(args.adminKey)
    const finalSeason = wholeNumber(
      args.finalSeason,
      'Final Michigan season',
      1900,
      2100,
    )

    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (query) =>
        query.eq('key', args.programKey ?? 'michigan'),
      )
      .unique()
    if (!program) throw new Error('Program not found')

    const player = await ctx.db.get('players', args.playerId)
    if (!player) throw new Error('Player not found')
    const stints = await ctx.db
      .query('rosterStints')
      .withIndex('by_playerId_and_startSeason', (query) =>
        query.eq('playerId', args.playerId),
      )
      .take(20)
    const stint = stints.find(
      (candidate) => candidate.programId === program._id,
    )
    if (!stint) throw new Error('Roster stint not found')
    if (stint.status !== 'active') {
      throw new Error('Only an active player can be removed from the roster')
    }
    if (finalSeason < stint.startSeason) {
      throw new Error('Final season cannot precede the Michigan arrival season')
    }

    if (args.departureKind === 'transfer_out') {
      if (!args.destinationProgramId) {
        throw new Error('A destination school is required for a transfer')
      }
      if (args.destinationProgramId === program._id) {
        throw new Error('A transfer destination must be outside Michigan')
      }
      const destination = await ctx.db.get(
        'programs',
        args.destinationProgramId,
      )
      if (!destination) throw new Error('Destination school not found')
    } else if (args.destinationProgramId) {
      throw new Error('Destination school applies only to transfer departures')
    }

    const movements = await ctx.db
      .query('movementEvents')
      .withIndex('by_playerId_and_season', (query) =>
        query.eq('playerId', args.playerId),
      )
      .take(20)
    if (movements.some((event) => event.sourceKey.endsWith(':departure'))) {
      throw new Error('This player already has a recorded departure')
    }

    await ctx.db.patch('rosterStints', stint._id, {
      departureClass:
        args.departureKind === 'transfer_out'
          ? 'T'
          : args.departureKind === 'graduated'
            ? 'G'
            : undefined,
      departureRank: undefined,
      depthChartOrder: undefined,
      depthTierOverride: undefined,
      endSeason: finalSeason,
      injury: undefined,
      status: 'departed',
    })
    await ctx.db.insert('movementEvents', {
      kind: args.departureKind,
      legacyCode:
        args.departureKind === 'transfer_out'
          ? 'T'
          : args.departureKind === 'graduated'
            ? 'G'
            : args.departureKind === 'retired'
              ? 'R'
              : 'D',
      playerId: args.playerId,
      programId: program._id,
      season: finalSeason + 1,
      sourceKey: `${stint.legacyKey}:departure`,
      toProgramId:
        args.departureKind === 'transfer_out'
          ? args.destinationProgramId
          : undefined,
    })

    const updated = await ctx.db.get('rosterStints', stint._id)
    if (!updated)
      throw new Error('Roster stint was not available after removal')

    return { player, stint: publicRosterStint(updated) }
  },
})
