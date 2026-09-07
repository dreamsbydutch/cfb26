export type LegacyPerson = {
  displayName: string
  highSchool: string
  homeState: string
  hometown: string
  legacyKey: string
  slug: string
  sourceUpdatedAt: number
}

export type LegacyStint = {
  eligibilityEndSeason: number
  eligibilityLeaveSeason: number
  eligibilityStartSeason: number
  endSeason?: number
  legacyKey: string
  playerId: string
  position: string
  programId: string
  startSeason: number
  status: string
}

export type LegacyDraftOutcome = {
  legacyKey: string
  overallPick?: number
  playerId: string
  round?: number
  status: string
  team: string
  year: number
}

export type LegacySeasonalPffRow = {
  playerId: string | null
  season: number
}

type ExportedDocument = { _creationTime?: number; _id?: string }

type LegacyRecruitingProfile = ExportedDocument & {
  compositeOverallRank?: number
  compositeRating?: number
  legacyKey: string
  playerId: string
  position?: string
  recruitingSeason: number
  service247OverallRank?: number
  service247Rating?: number
  source: 'high_school' | 'transfer' | 'walk_on'
}

type LegacyMovement = ExportedDocument & {
  cohortRank?: number
  fromProgramId?: string
  kind: string
  playerId: string
  programId: string
  season: number
  sourceKey: string
  toProgramId?: string
}

const positionRoom = (position: string) => {
  const normalized = position.toUpperCase()
  if (['QB'].includes(normalized)) return 'Quarterback'
  if (['RB', 'HB', 'FB'].includes(normalized)) return 'Backfield'
  if (['WR', 'SLOT', 'TE'].includes(normalized)) return 'Receivers'
  if (['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C', 'OL'].includes(normalized))
    return 'Offensive line'
  if (['DT', 'NT', 'DE', 'EDGE', 'DL'].includes(normalized))
    return 'Defensive line'
  if (['LB', 'ILB', 'OLB'].includes(normalized)) return 'Linebacker'
  if (['CB', 'S', 'FS', 'SS', 'DB', 'NICKEL'].includes(normalized))
    return 'Secondary'
  if (['K', 'P', 'LS'].includes(normalized)) return 'Specialists'
  return 'Athletes'
}

const entryMethodFor = (
  profile: LegacyRecruitingProfile | undefined,
): 'high_school' | 'legacy' | 'transfer' | 'walk_on' =>
  profile?.source ?? 'legacy'

const lifecycleState = (stint: LegacyStint | undefined) =>
  stint?.status === 'committed'
    ? ('prospect' as const)
    : stint?.status === 'departed'
      ? ('alumni' as const)
      : ('enrolled' as const)

/**
 * Builds importable v2 Michigan documents without modifying a deployment.
 * Existing document IDs are retained where later rows reference them; newly
 * introduced Player Seasons intentionally omit IDs so Convex assigns them.
 */
export function prepareMichiganMigration(
  input: {
    draftOutcomes: Array<LegacyDraftOutcome & ExportedDocument>
    movementEvents?: Array<LegacyMovement>
    players: Array<LegacyPerson & ExportedDocument>
    recruitingProfiles?: Array<LegacyRecruitingProfile>
    rosterStints: Array<
      LegacyStint & ExportedDocument & Record<string, unknown>
    >
    seasonalPlayerStats: Array<LegacySeasonalPffRow>
  },
  currentSeason: number,
) {
  const profiles = input.recruitingProfiles ?? []
  const movements = input.movementEvents ?? []
  const firstStint = new Map<string, (typeof input.rosterStints)[number]>()
  for (const stint of [...input.rosterStints].sort(
    (a, b) => a.startSeason - b.startSeason,
  )) {
    if (!firstStint.has(stint.playerId)) firstStint.set(stint.playerId, stint)
  }
  const profileByPlayer = new Map(profiles.map((row) => [row.playerId, row]))
  const playerIds = new Set(
    input.players.flatMap((row) => (row._id ? [row._id] : [])),
  )
  const unresolved: Array<{ reason: string; sourceKey: string }> = []

  const players = input.players.map((person) => {
    const stint = person._id ? firstStint.get(person._id) : undefined
    const profile = person._id ? profileByPlayer.get(person._id) : undefined
    return {
      ...(person._id ? { _id: person._id } : {}),
      ...(person._creationTime ? { _creationTime: person._creationTime } : {}),
      canonicalName: person.displayName,
      dataQuality: 'source_verified' as const,
      displayName: person.displayName,
      entryMethod: entryMethodFor(profile),
      entrySeason: stint?.startSeason ?? profile?.recruitingSeason ?? 2015,
      ...(person.highSchool ? { highSchool: person.highSchool } : {}),
      ...(person.homeState ? { homeState: person.homeState } : {}),
      ...(person.hometown ? { hometown: person.hometown } : {}),
      legacyKey: person.legacyKey,
      slug: person.slug,
      sourceLinks: [],
      sourceUpdatedAt: person.sourceUpdatedAt,
      state: lifecycleState(stint),
    }
  })

  const commitments = input.rosterStints.flatMap((stint) => {
    if (stint.status !== 'committed') return []
    return [
      {
        dataQuality: 'source_verified' as const,
        initialPosition: stint.position,
        playerId: stint.playerId,
        programId: stint.programId,
        season: stint.startSeason,
        sourceKey: `migration:commitment:${stint.legacyKey}:${stint.startSeason}`,
        sourceLinks: [],
        status: 'committed' as const,
      },
    ]
  })

  const rosterStints = input.rosterStints.flatMap((stint) => {
    if (!playerIds.has(stint.playerId)) {
      unresolved.push({
        reason: 'missing_canonical_person',
        sourceKey: `legacy-stint:${stint.legacyKey}`,
      })
      return []
    }
    if (stint.status === 'committed') return []
    const profile = profileByPlayer.get(stint.playerId)
    return [
      {
        ...(stint._id ? { _id: stint._id } : {}),
        ...(stint._creationTime ? { _creationTime: stint._creationTime } : {}),
        dataQuality: 'source_verified' as const,
        eligibilityStartSeason: stint.eligibilityStartSeason,
        ...(stint.endSeason === undefined
          ? {}
          : { endSeason: stint.endSeason }),
        entryMethod: entryMethodFor(profile),
        legacyKey: stint.legacyKey,
        playerId: stint.playerId,
        programId: stint.programId,
        sourceLinks: [],
        startSeason: stint.startSeason,
        status:
          stint.status === 'departed'
            ? ('departed' as const)
            : ('active' as const),
      },
    ]
  })

  const playerSeasons = input.rosterStints.flatMap((stint) => {
    if (
      stint.status === 'committed' ||
      !playerIds.has(stint.playerId) ||
      !stint._id
    )
      return []
    const finalSeason = Math.min(
      stint.endSeason ?? currentSeason,
      currentSeason,
    )
    return Array.from(
      { length: Math.max(0, finalSeason - stint.startSeason + 1) },
      (_, offset) => {
        const season = stint.startSeason + offset
        const injury = stint.injury as { note?: string } | undefined
        const role =
          stint.depthTierOverride === 'starters'
            ? 'starter'
            : stint.depthTierOverride === 'rotation'
              ? 'rotation'
              : stint.depthTierOverride === 'depth'
                ? 'reserve'
                : 'unassigned'
        return {
          ...(injury?.note ? { availabilityNote: injury.note } : {}),
          captain: false,
          dataQuality: 'needs_review' as const,
          depthStatus: injury ? ('limited' as const) : ('unknown' as const),
          eligibleThroughSeasonOverride: stint.eligibilityEndSeason,
          eligibilityEvidence: {
            ageBasedExceptionSeasons: 0,
            competitionSeasons: [],
            enrollmentSeason: stint.eligibilityStartSeason,
            legacyRedshirtSeason: null,
            medicalHardshipSeasons: Number(stint.medicalExtensionSeasons ?? 0),
            otherExtensionSeasons: Number(stint.extraEligibilitySeasons ?? 0),
          },
          gamesPlayed: 0,
          heightInches:
            typeof stint.heightInches === 'number' ? stint.heightInches : null,
          honors: [],
          jerseyNumber:
            typeof stint.jerseyNumber === 'number' ? stint.jerseyNumber : null,
          listedPosition: stint.position,
          playerId: stint.playerId,
          positionRoom: positionRoom(stint.position),
          programId: stint.programId,
          roomOrder:
            typeof stint.depthChartOrder === 'number'
              ? stint.depthChartOrder
              : null,
          role,
          rosterStatus:
            stint.status === 'departed' && season === finalSeason
              ? ('departed' as const)
              : ('active' as const),
          scholarshipStatus:
            profileByPlayer.get(stint.playerId)?.source === 'walk_on'
              ? ('walk_on' as const)
              : ('unknown' as const),
          season,
          sourceLinks: [],
          starts: 0,
          stintId: stint._id,
          weightPounds:
            typeof stint.weightPounds === 'number' ? stint.weightPounds : null,
        }
      },
    )
  })

  const evaluations = profiles.flatMap((profile) => {
    const base = {
      dataQuality: 'source_verified' as const,
      direction: 'inbound' as const,
      evaluatedAt: Date.UTC(profile.recruitingSeason, 0, 1),
      kind:
        profile.source === 'transfer'
          ? ('transfer' as const)
          : ('recruiting' as const),
      playerId: profile.playerId,
    }
    return [
      ...(profile.compositeRating === undefined
        ? []
        : [
            {
              ...base,
              provider: '247Sports Composite',
              rank: profile.compositeOverallRank ?? null,
              scale: '0-1',
              score: profile.compositeRating,
            },
          ]),
      ...(profile.service247Rating === undefined
        ? []
        : [
            {
              ...base,
              provider: '247Sports',
              rank: profile.service247OverallRank ?? null,
              scale: '0-100',
              score: profile.service247Rating,
            },
          ]),
    ]
  })

  const draftOutcomes = input.draftOutcomes.flatMap((outcome) => {
    if (!playerIds.has(outcome.playerId)) {
      unresolved.push({
        reason: 'missing_canonical_person',
        sourceKey: `legacy-draft:${outcome.legacyKey}`,
      })
      return []
    }
    return [
      {
        ...(outcome._id ? { _id: outcome._id } : {}),
        ...(outcome._creationTime
          ? { _creationTime: outcome._creationTime }
          : {}),
        dataQuality: 'source_verified' as const,
        overallPick: outcome.overallPick ?? null,
        playerId: outcome.playerId,
        round: outcome.round ?? null,
        sourceLinks: [],
        status:
          outcome.status === 'drafted'
            ? ('drafted' as const)
            : ('undrafted_free_agent' as const),
        team: outcome.team || undefined,
        year: outcome.year,
      },
    ]
  })

  const movementEvents = movements.flatMap((event) =>
    playerIds.has(event.playerId)
      ? [
          {
            ...(event._id ? { _id: event._id } : {}),
            ...(event._creationTime
              ? { _creationTime: event._creationTime }
              : {}),
            ...(event.cohortRank === undefined
              ? {}
              : { cohortRank: event.cohortRank }),
            ...(event.fromProgramId
              ? { fromProgramId: event.fromProgramId }
              : {}),
            kind: event.kind,
            playerId: event.playerId,
            programId: event.programId,
            season: event.season,
            sourceKey: event.sourceKey,
            ...(event.toProgramId ? { toProgramId: event.toProgramId } : {}),
          },
        ]
      : [],
  )

  return {
    audit: {
      commitments: commitments.length,
      deletedPffRows: input.seasonalPlayerStats.length,
      draftOutcomes: draftOutcomes.length,
      evaluations: evaluations.length,
      people: players.length,
      playerSeasons: playerSeasons.length,
      rosterStints: rosterStints.length,
    },
    datasets: {
      commitments,
      draftOutcomes,
      evaluations,
      movementEvents,
      playerSeasons,
      players,
      rosterStints,
    },
    unresolved,
  }
}

export function planMichiganMigration(input: {
  draftOutcomes: Array<LegacyDraftOutcome>
  players: Array<LegacyPerson>
  rosterStints: Array<LegacyStint>
  seasonalPlayerStats: Array<LegacySeasonalPffRow>
}) {
  const personIds = new Set(input.players.map((player) => player.legacyKey))
  const playerById = new Map(
    input.players.map((player) => [player.legacyKey, player] as const),
  )
  const unresolved = input.seasonalPlayerStats.flatMap((row, index) =>
    row.playerId === null
      ? [
          {
            reason: 'missing_canonical_person' as const,
            sourceKey: `legacy-pff:${row.season}:${index}`,
          },
        ]
      : [],
  )

  const people = input.players.map((player) => {
    const stint = input.rosterStints.find(
      (candidate) => candidate.legacyKey === player.legacyKey,
    )
    return {
      canonicalName: player.displayName,
      entryMethod: 'legacy' as const,
      entrySeason: stint?.startSeason ?? null,
      highSchool: player.highSchool || null,
      homeState: player.homeState || null,
      hometown: player.hometown || null,
      legacyKey: player.legacyKey,
      slug: player.slug,
      state:
        stint?.status === 'committed'
          ? ('prospect' as const)
          : ('enrolled' as const),
    }
  })

  const playerSeasons = input.rosterStints.flatMap((stint) => {
    const person = playerById.get(stint.legacyKey)
    if (!person) {
      unresolved.push({
        reason: 'missing_canonical_person',
        sourceKey: `legacy-stint:${stint.legacyKey}`,
      })
      return []
    }
    const endSeason = stint.endSeason ?? stint.startSeason
    return Array.from(
      { length: Math.max(0, endSeason - stint.startSeason + 1) },
      (_, offset) => ({
        eligibleThroughSeason: stint.eligibilityEndSeason,
        listedPosition: stint.position,
        playerLegacyKey: person.legacyKey,
        programId: stint.programId,
        season: stint.startSeason + offset,
      }),
    )
  })

  return {
    audit: {
      deletedPffRows: input.seasonalPlayerStats.length,
      draftOutcomes: input.draftOutcomes.length,
      people: people.length,
      playerSeasons: playerSeasons.length,
    },
    draftOutcomes: input.draftOutcomes.filter((outcome) =>
      personIds.has(outcome.legacyKey),
    ),
    people,
    playerSeasons,
    unresolved,
  }
}
