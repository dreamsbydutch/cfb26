import { ConvexError, v } from 'convex/values'
import { mutation } from './_generated/server'
import { derivePositionRoom } from './playerDomain'
import { rosterSpreadsheetValues } from './rosterSpreadsheetFields'
import {
  advanceMichiganDataRevision,
  createPersonRecord,
  getMichiganDataRevision,
  requireOwnerSession,
} from './rosterAdmin'
import { validateParticipationCounts } from './participationModel'
import { findRecruitingEvaluation } from './rosters'
import type { Infer } from 'convex/values'
import type { Doc } from './_generated/dataModel'

type Values = Infer<typeof rosterSpreadsheetValues>
type Field = keyof Values

const profileFields: Array<Field> = [
  'canonicalName',
  'displayName',
  'hometown',
  'homeState',
  'highSchool',
  'personSourceUrls',
]
const identityFields: Array<Field> = [
  'entryMethod',
  'entrySeason',
  'personState',
  'derivedEligibility',
  'eligibilityStart',
]
const offenseFields: Array<Field> = [
  'offenseGames',
  'offenseSnaps',
  'offenseThrough',
  'offensePass',
  'offensePassBlock',
  'offenseRun',
  'offenseRunBlock',
]
const defenseFields: Array<Field> = [
  'defenseGames',
  'defenseSnaps',
  'defenseThrough',
  'defenseRunDefense',
  'defensePassRush',
  'defenseCoverage',
]
const specialTeamsFields: Array<Field> = [
  'specialTeamsGames',
  'specialTeamsSnaps',
  'specialTeamsThrough',
]
const participationFields = [
  ...offenseFields,
  ...defenseFields,
  ...specialTeamsFields,
]
const evidenceFields: Array<Field> = [
  'enrollmentSeason',
  'legacyRedshirtSeason',
  'competitionSeasons',
  'medicalHardshipSeasons',
  'otherExtensionSeasons',
  'ageBasedExceptionSeasons',
]

function text(value: string, label: string, max: number, required = false) {
  const trimmed = value.trim()
  if ((required && !trimmed) || trimmed.length > max)
    throw new ConvexError(
      `${label}: ${required ? 'enter a value, ' : ''}maximum ${max} characters.`,
    )
  return trimmed
}

function number(
  value: string,
  label: string,
  min: number,
  max: number,
  nullable = false,
) {
  if (nullable && !value.trim()) return null
  const result = Number(value)
  if (
    !value.trim() ||
    !Number.isInteger(result) ||
    result < min ||
    result > max
  )
    throw new ConvexError(
      `${label}: enter a whole number from ${min} to ${max}.`,
    )
  return result
}

function requiredNumber(
  value: string,
  label: string,
  min: number,
  max: number,
) {
  const result = number(value, label, min, max)
  if (result === null) throw new ConvexError(`${label} is required.`)
  return result
}

function option<const T extends string>(
  value: string,
  options: ReadonlyArray<T>,
  label: string,
): T {
  const result = options.find((candidate) => candidate === value)
  if (result === undefined)
    throw new ConvexError(`${label}: choose a listed value.`)
  return result
}

function sources(
  value: string,
  previous: Array<{ label: string; url: string }>,
) {
  const urls = [
    ...new Set(
      value
        .split(';')
        .map((url) => url.trim())
        .filter(Boolean),
    ),
  ]
  if (urls.length > 20) throw new ConvexError('Use at most 20 source URLs.')
  return urls.map((url) => {
    if (url.length > 500) throw new ConvexError('Source URL is too long.')
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new ConvexError('Source URLs must be complete HTTP or HTTPS URLs.')
    }
    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      parsed.username ||
      parsed.password
    )
      throw new ConvexError(
        'Source URLs must use HTTP or HTTPS without credentials.',
      )
    return (
      previous.find((source) => source.url === url) ?? {
        label: 'Owner source',
        url,
      }
    )
  })
}

function list(value: string, label: string, maxLength: number) {
  const result = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  if (result.length > 100 || result.some((item) => item.length > maxLength))
    throw new ConvexError(`${label}: too many or overly long values.`)
  return result
}

function phaseSnapshot(
  values: Values,
  phase: 'offense' | 'defense' | 'specialTeams',
) {
  const fields =
    phase === 'offense'
      ? offenseFields
      : phase === 'defense'
        ? defenseFields
        : specialTeamsFields
  if (fields.every((field) => !(values[field] ?? '').trim())) return undefined
  const phaseName = phase === 'specialTeams' ? 'Special teams' : phase
  const gamesPlayed = requiredNumber(
    values[`${phase}Games`],
    `${phaseName} GP`,
    0,
    30,
  )
  const snaps = requiredNumber(
    values[`${phase}Snaps`],
    `${phaseName} snaps`,
    0,
    6000,
  )
  const throughTeamGames = requiredNumber(
    values[`${phase}Through`],
    `${phaseName} team games`,
    1,
    30,
  )
  const breakdown = [
    values.offensePass,
    values.offensePassBlock,
    values.offenseRun,
    values.offenseRunBlock,
  ]
  const offenseBreakdown =
    phase === 'offense' && breakdown.some((value) => value.trim())
      ? {
          pass: requiredNumber(values.offensePass, 'Pass snaps', 0, snaps),
          passBlock: requiredNumber(
            values.offensePassBlock,
            'Pass-block snaps',
            0,
            snaps,
          ),
          run: requiredNumber(values.offenseRun, 'Run snaps', 0, snaps),
          runBlock: requiredNumber(
            values.offenseRunBlock,
            'Run-block snaps',
            0,
            snaps,
          ),
        }
      : undefined
  const defenseBreakdown =
    phase === 'defense' &&
    [
      values.defenseRunDefense,
      values.defensePassRush,
      values.defenseCoverage,
    ].some((value) => value.trim())
      ? {
          runDefense: requiredNumber(
            values.defenseRunDefense,
            'Run-defense snaps',
            0,
            snaps,
          ),
          passRush: requiredNumber(
            values.defensePassRush,
            'Pass-rush snaps',
            0,
            snaps,
          ),
          coverage: requiredNumber(
            values.defenseCoverage,
            'Coverage snaps',
            0,
            snaps,
          ),
        }
      : undefined
  validateParticipationCounts(
    { gamesPlayed, snaps, offenseBreakdown, defenseBreakdown },
    phase,
    throughTeamGames,
  )
  return {
    gamesPlayed,
    snaps,
    throughTeamGames,
    sourceLabel: 'Owner spreadsheet entry',
    importedAt: Date.now(),
    ...(offenseBreakdown ? { offenseBreakdown } : {}),
    ...(defenseBreakdown ? { defenseBreakdown } : {}),
  }
}

export const save = mutation({
  args: {
    sessionToken: v.string(),
    season: v.number(),
    expectedRevision: v.number(),
    rows: v.array(
      v.object({
        playerId: v.optional(v.id('players')),
        playerSeasonId: v.optional(v.id('playerSeasons')),
        commitmentId: v.optional(v.id('commitments')),
        changedFields: v.array(v.string()),
        values: rosterSpreadsheetValues,
      }),
    ),
  },
  returns: v.object({
    updated: v.number(),
    created: v.number(),
    dataRevision: v.number(),
  }),
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    const season = requiredNumber(String(args.season), 'Season', 2005, 2100)
    if (args.rows.length < 1 || args.rows.length > 200)
      throw new ConvexError('Save between 1 and 200 changed rows at a time.')
    if ((await getMichiganDataRevision(ctx)) !== args.expectedRevision)
      throw new ConvexError(
        'Roster changed since you started editing. Keep your edits and reload the latest roster before saving again.',
      )
    const program = await ctx.db
      .query('programs')
      .withIndex('by_key', (q) => q.eq('key', 'michigan'))
      .unique()
    if (!program) throw new ConvexError('Michigan was not found.')
    const seen = new Set<string>()
    let created = 0
    for (const row of args.rows) {
      const values = row.values
      const changed = new Set(row.changedFields)
      if (
        !changed.size ||
        changed.size !== row.changedFields.length ||
        [...changed].some(
          (key) => !Object.hasOwn(rosterSpreadsheetValues.fields, key),
        )
      )
        throw new ConvexError(
          'A row contains missing, duplicate, or unknown edited fields.',
        )
      const has = (key: Field) => changed.has(key)
      const isNew = !row.playerId
      if (isNew && (row.playerSeasonId || row.commitmentId))
        throw new ConvexError('New rows cannot refer to existing records.')
      if (!isNew && identityFields.some(has))
        throw new ConvexError(
          'Entry and lifecycle history are managed on the player record; saved eligibility is calculated.',
        )
      let playerId = row.playerId
      if (!playerId) {
        if (
          requiredNumber(
            values.entrySeason,
            'Michigan entry season',
            2005,
            2100,
          ) !== season
        )
          throw new ConvexError(
            'Add a player in their Michigan entry season, then use rollover or their player record for later seasons.',
          )
        playerId = await createPersonRecord(
          ctx,
          {
            canonicalName:
              values.canonicalName.trim() || values.displayName.trim(),
            entryMethod: option(
              values.entryMethod,
              ['high_school', 'transfer', 'walk_on', 'legacy'],
              'Entry method',
            ),
            entrySeason: season,
            initialPosition: text(values.listedPosition, 'Position', 16, true),
            state: option(
              values.personState,
              ['enrolled', 'prospect'],
              'New player state',
            ),
          },
          program._id,
        )
        created++
      }
      if (seen.has(playerId))
        throw new ConvexError('A player appears more than once in this save.')
      seen.add(playerId)
      const player = await ctx.db.get('players', playerId)
      if (!player) throw new ConvexError('Player was not found.')
      let annual = row.playerSeasonId
        ? await ctx.db.get('playerSeasons', row.playerSeasonId)
        : null
      let commitment = row.commitmentId
        ? await ctx.db.get('commitments', row.commitmentId)
        : null
      if (
        (row.playerSeasonId && !annual) ||
        (row.commitmentId && !commitment) ||
        (row.playerSeasonId && row.commitmentId)
      )
        throw new ConvexError(
          'Choose one existing roster or commitment record.',
        )
      if (isNew) {
        annual = await ctx.db
          .query('playerSeasons')
          .withIndex('by_playerId_and_season', (q) =>
            q.eq('playerId', playerId).eq('season', season),
          )
          .unique()
        commitment = await ctx.db
          .query('commitments')
          .withIndex('by_playerId_and_season', (q) =>
            q.eq('playerId', playerId).eq('season', season),
          )
          .unique()
      }
      if (
        (annual &&
          (annual.playerId !== playerId ||
            annual.programId !== program._id ||
            annual.season !== season)) ||
        (commitment &&
          (commitment.playerId !== playerId ||
            commitment.programId !== program._id ||
            commitment.season !== season ||
            commitment.status !== 'committed')) ||
        (!annual && !commitment)
      )
        throw new ConvexError(
          'A matching Michigan roster or commitment record was not found for this season.',
        )
      if (
        !annual &&
        [...changed].some(
          (key) =>
            ![
              ...profileFields,
              ...identityFields,
              'listedPosition',
              'dataQuality',
              'recruitingRank',
              'recruitingRating',
            ].includes(key),
        )
      )
        throw new ConvexError(
          'Recruits can edit identity and position; enroll the player before adding annual or participation data.',
        )

      if (has('recruitingRank') || has('recruitingRating')) {
        const previous = await findRecruitingEvaluation(ctx, playerId)
        const rank = has('recruitingRank')
          ? number(
              values.recruitingRank ?? '',
              'Recruiting overall rank',
              1,
              100000,
              true,
            )
          : (previous?.rank ?? null)
        let score = previous?.scale === '0-1' ? previous.score : null
        if (has('recruitingRating')) {
          const input = (values.recruitingRating ?? '').trim()
          score = input ? Number(input) : null
          if (
            score !== null &&
            (!Number.isFinite(score) || score < 0 || score > 1)
          )
            throw new ConvexError(
              'Recruiting rating: enter a decimal from 0 to 1, or leave blank.',
            )
        }
        await ctx.db.insert('evaluations', {
          playerId,
          provider: '247Sports Composite',
          kind: previous?.kind ?? 'recruiting',
          direction: previous?.direction ?? 'inbound',
          scale: '0-1',
          rank,
          score,
          evaluatedAt: Math.max(Date.now(), (previous?.evaluatedAt ?? 0) + 1),
          dataQuality: 'owner_verified',
          notes: 'Owner correction from roster spreadsheet.',
        })
      }
      const profile: Partial<Doc<'players'>> = {}
      if (has('canonicalName')) {
        const canonicalName = text(
          values.canonicalName,
          'Canonical name',
          100,
          true,
        )
        const slug = canonicalName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '')
        if (!slug)
          throw new ConvexError('Canonical name needs letters or numbers.')
        const duplicate = await ctx.db
          .query('players')
          .withIndex('by_slug', (q) => q.eq('slug', slug))
          .first()
        if (duplicate && duplicate._id !== playerId)
          throw new ConvexError(`${canonicalName} already exists.`)
        profile.canonicalName = canonicalName
        profile.slug = slug
      }
      if (has('displayName') || isNew)
        profile.displayName = text(
          values.displayName || player.canonicalName,
          'Display name',
          100,
          true,
        )
      if (has('hometown'))
        profile.hometown = text(values.hometown, 'Hometown', 80) || undefined
      if (has('homeState'))
        profile.homeState =
          text(values.homeState, 'Home state', 24).toUpperCase() || undefined
      if (has('highSchool'))
        profile.highSchool =
          text(values.highSchool, 'High school', 120) || undefined
      if (has('personSourceUrls'))
        profile.sourceLinks = sources(
          values.personSourceUrls,
          player.sourceLinks,
        )
      if (has('dataQuality'))
        profile.dataQuality = option(
          values.dataQuality,
          ['owner_verified', 'source_verified', 'needs_review'],
          'Data quality',
        )
      if (Object.keys(profile).length)
        await ctx.db.patch('players', playerId, {
          ...profile,
          sourceUpdatedAt: Date.now(),
        })
      if (!annual) {
        if (!commitment) throw new ConvexError('Commitment was not found.')
        if (has('listedPosition'))
          await ctx.db.patch('commitments', commitment._id, {
            initialPosition: text(
              values.listedPosition,
              'Position',
              16,
              true,
            ).toUpperCase(),
          })
        if (has('dataQuality'))
          await ctx.db.patch('commitments', commitment._id, {
            dataQuality: option(
              values.dataQuality,
              ['owner_verified', 'source_verified', 'needs_review'],
              'Data quality',
            ),
          })
        continue
      }
      const patch: Partial<Doc<'playerSeasons'>> = {}
      if (has('listedPosition')) {
        patch.listedPosition = text(
          values.listedPosition,
          'Position',
          16,
          true,
        ).toUpperCase()
        patch.positionRoom = derivePositionRoom(patch.listedPosition)
      }
      if (has('jerseyNumber'))
        patch.jerseyNumber = number(values.jerseyNumber, 'Jersey', 0, 99, true)
      if (has('heightInches'))
        patch.heightInches = number(values.heightInches, 'Height', 48, 96, true)
      if (has('weightPounds'))
        patch.weightPounds = number(
          values.weightPounds,
          'Weight',
          100,
          500,
          true,
        )
      if (has('roomOrder'))
        patch.roomOrder = number(values.roomOrder, 'Room order', 1, 200, true)
      if (has('gamesPlayed'))
        patch.gamesPlayed = requiredNumber(
          values.gamesPlayed,
          'Overall GP',
          0,
          30,
        )
      if (has('starts'))
        patch.starts = requiredNumber(values.starts, 'Starts', 0, 30)
      if (has('gamesPlayed') || has('starts')) patch.rosterOnly = false
      if (
        (patch.starts ?? annual.starts) >
        (patch.gamesPlayed ?? annual.gamesPlayed)
      )
        throw new ConvexError('Starts cannot exceed overall games played.')
      if (has('role'))
        patch.role = option(
          values.role,
          ['starter', 'rotation', 'reserve', 'unassigned'],
          'Role',
        )
      if (has('rosterStatus'))
        patch.rosterStatus = option(
          values.rosterStatus,
          ['active', 'inactive', 'departed'],
          'Roster status',
        )
      if (has('depthStatus'))
        patch.depthStatus = option(
          values.depthStatus,
          ['available', 'limited', 'out', 'unknown'],
          'Availability',
        )
      if (has('scholarshipStatus'))
        patch.scholarshipStatus = option(
          values.scholarshipStatus,
          ['scholarship', 'walk_on', 'exempt', 'unknown'],
          'Scholarship',
        )
      if (has('availabilityNote'))
        patch.availabilityNote =
          text(values.availabilityNote, 'Availability note', 240) || undefined
      if (has('captain'))
        patch.captain =
          option(values.captain, ['true', 'false'], 'Captain') === 'true'
      if (has('eligibleThrough'))
        patch.eligibleThroughSeasonOverride = number(
          values.eligibleThrough,
          'Eligibility override',
          1900,
          2100,
          true,
        )
      if (has('honors')) patch.honors = list(values.honors, 'Honors', 100)
      if (has('dataQuality'))
        patch.dataQuality = option(
          values.dataQuality,
          ['owner_verified', 'source_verified', 'needs_review'],
          'Data quality',
        )
      if (has('seasonSourceUrls'))
        patch.sourceLinks = sources(values.seasonSourceUrls, annual.sourceLinks)
      if (evidenceFields.some(has)) {
        const competitionSeasons = list(
          values.competitionSeasons,
          'Competition seasons',
          4,
        ).map((value) =>
          requiredNumber(value, 'Competition season', 1900, season),
        )
        if (new Set(competitionSeasons).size !== competitionSeasons.length)
          throw new ConvexError('Competition seasons cannot repeat.')
        patch.eligibilityEvidence = {
          enrollmentSeason: number(
            values.enrollmentSeason,
            'First college enrollment',
            1900,
            season,
            true,
          ),
          legacyRedshirtSeason: number(
            values.legacyRedshirtSeason,
            'Redshirt season',
            1900,
            season,
            true,
          ),
          competitionSeasons,
          medicalHardshipSeasons: requiredNumber(
            values.medicalHardshipSeasons,
            'Medical extension',
            0,
            10,
          ),
          otherExtensionSeasons: requiredNumber(
            values.otherExtensionSeasons,
            'Other extension',
            0,
            10,
          ),
          ageBasedExceptionSeasons: requiredNumber(
            values.ageBasedExceptionSeasons,
            'Age exception',
            0,
            10,
          ),
        }
      }
      if (participationFields.some(has)) {
        patch.participationTotals = { ...annual.participationTotals }
        for (const [phase, fields] of [
          ['offense', offenseFields],
          ['defense', defenseFields],
          ['specialTeams', specialTeamsFields],
        ] as const) {
          if (fields.some(has)) {
            const snapshot = phaseSnapshot(values, phase)
            if (snapshot) patch.participationTotals[phase] = snapshot
            else delete patch.participationTotals[phase]
          }
        }
      }
      if (Object.keys(patch).length)
        await ctx.db.patch('playerSeasons', annual._id, patch)
    }
    const dataRevision = await advanceMichiganDataRevision(ctx, {
      action: 'save_roster_spreadsheet',
      sessionId: session._id,
      target: `${season}:${args.rows.length} rows:${created} new`,
    })
    return { updated: args.rows.length - created, created, dataRevision }
  },
})
