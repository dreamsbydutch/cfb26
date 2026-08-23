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

    const position = args.position.trim().toUpperCase()
    if (!/^[A-Z][A-Z0-9/-]{0,15}$/.test(position)) {
      throw new Error('Position must be a short football position label')
    }
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
