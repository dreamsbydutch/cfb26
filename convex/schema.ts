import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { programSnapshotFields, rankingEditionFields } from './ratingFields'
import { gameEvidenceValidator } from './evidenceFields'

const stintStatus = v.union(
  v.literal('active'),
  v.literal('departed'),
  v.literal('prospect'),
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

const scholarshipStatus = v.union(
  v.literal('scholarship'),
  v.literal('walk_on'),
  v.literal('exempt'),
  v.literal('unknown'),
)

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

const nullableNumber = v.union(v.number(), v.null())

const sourceLink = v.object({
  label: v.string(),
  url: v.string(),
})

const phasePerformance = v.object({
  grade: nullableNumber,
  snaps: nullableNumber,
})

const movementKind = v.union(
  v.literal('recruited'),
  v.literal('walk_on'),
  v.literal('transfer_in'),
  v.literal('transfer_out'),
  v.literal('graduated'),
  v.literal('retired'),
  v.literal('dismissed'),
  v.literal('decommitted'),
  v.literal('enrolled'),
  v.literal('returned'),
)

const teamDataSource = v.union(
  v.literal('recruiting'),
  v.literal('standings'),
  v.literal('draft'),
  v.literal('games'),
  v.literal('game_stats'),
  v.literal('ratings'),
  v.literal('rating_inputs'),
  v.literal('programs'),
  v.literal('venues'),
  v.literal('affiliations'),
  v.literal('player_stats'),
  v.literal('nflverse'),
  v.literal('polls'),
)

const seasonType = v.union(v.literal('regular'), v.literal('postseason'))

const homeAway = v.union(v.literal('home'), v.literal('away'))

const ratingClassification = v.union(
  v.literal('fbs'),
  v.literal('fcs'),
  v.literal('transitioning'),
)

const ratingEditionType = v.union(
  v.literal('nightly'),
  v.literal('official'),
  v.literal('amendment'),
  v.literal('research'),
)

const ratingDimensions = v.object({
  continuity: v.number(),
  defense: v.number(),
  form: v.number(),
  offense: v.number(),
  passingDefense: v.number(),
  passingOffense: v.number(),
  power: v.number(),
  resume: v.number(),
  rushingDefense: v.number(),
  rushingOffense: v.number(),
  situationalDefense: v.number(),
  situationalOffense: v.number(),
  specialTeams: v.number(),
  talent: v.number(),
  tempo: v.number(),
  volatility: v.number(),
})

const perGameUnit = v.object({
  firstDownsByPass: v.number(),
  firstDownsByPenalty: v.number(),
  firstDownsByRush: v.number(),
  firstDownsTotal: v.number(),
  interceptions: v.number(),
  passAttempts: v.number(),
  passCompletionPercentage: v.number(),
  passCompletions: v.number(),
  passingTouchdowns: v.number(),
  passingYards: v.number(),
  penalties: v.number(),
  penaltyYards: v.number(),
  plays: v.number(),
  points: v.number(),
  rushAttempts: v.number(),
  rushingTouchdowns: v.number(),
  rushingYards: v.number(),
  rushingYardsPerAttempt: v.number(),
  totalYards: v.number(),
  turnovers: v.number(),
  turnoversByFumble: v.number(),
  yardsPerPlay: v.number(),
})

export default defineSchema({
  players: defineTable({
    canonicalName: v.string(),
    dataQuality,
    displayName: v.string(),
    entryMethod,
    entrySeason: v.number(),
    highSchool: v.optional(v.string()),
    homeState: v.optional(v.string()),
    hometown: v.optional(v.string()),
    legacyKey: v.optional(v.string()),
    slug: v.string(),
    sourceLinks: v.array(sourceLink),
    sourceUpdatedAt: v.number(),
    state: personState,
  })
    .index('by_legacyKey', ['legacyKey'])
    .index('by_slug', ['slug'])
    .index('by_entrySeason_and_state', ['entrySeason', 'state'])
    .searchIndex('search_displayName', {
      searchField: 'displayName',
      filterFields: ['homeState'],
    }),

  commitments: defineTable({
    committedAt: v.optional(v.number()),
    dataQuality,
    endedAt: v.optional(v.number()),
    initialPosition: v.string(),
    playerId: v.id('players'),
    programId: v.id('programs'),
    season: v.number(),
    sourceKey: v.string(),
    sourceLinks: v.array(sourceLink),
    status: v.union(
      v.literal('committed'),
      v.literal('decommitted'),
      v.literal('enrolled'),
    ),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_playerId_and_season', ['playerId', 'season'])
    .index('by_programId_and_season_and_status', [
      'programId',
      'season',
      'status',
    ]),

  rosterStints: defineTable({
    dataQuality,
    eligibilityStartSeason: v.number(),
    endSeason: v.optional(v.number()),
    entryMethod,
    fromProgramId: v.optional(v.id('programs')),
    legacyKey: v.optional(v.string()),
    playerId: v.id('players'),
    programId: v.id('programs'),
    sourceLinks: v.array(sourceLink),
    startSeason: v.number(),
    status: stintStatus,
    toProgramId: v.optional(v.id('programs')),
  })
    .index('by_legacyKey', ['legacyKey'])
    .index('by_playerId_and_startSeason', ['playerId', 'startSeason'])
    .index('by_programId_and_startSeason', ['programId', 'startSeason'])
    .index('by_programId_and_status', ['programId', 'status']),

  playerSeasons: defineTable({
    availabilityNote: v.optional(v.string()),
    captain: v.boolean(),
    dataQuality,
    depthStatus,
    eligibleThroughSeasonOverride: v.union(v.number(), v.null()),
    eligibilityEvidence: v.object({
      ageBasedExceptionSeasons: v.number(),
      competitionSeasons: v.array(v.number()),
      enrollmentSeason: nullableNumber,
      legacyRedshirtSeason: nullableNumber,
      medicalHardshipSeasons: v.number(),
      otherExtensionSeasons: v.number(),
    }),
    gamesPlayed: v.number(),
    heightInches: nullableNumber,
    honors: v.array(v.string()),
    jerseyNumber: nullableNumber,
    listedPosition: v.string(),
    playerId: v.id('players'),
    positionRoom: v.string(),
    programId: v.id('programs'),
    roomOrder: nullableNumber,
    role: playerRole,
    rosterStatus: v.union(
      v.literal('active'),
      v.literal('inactive'),
      v.literal('departed'),
    ),
    scholarshipStatus,
    season: v.number(),
    sourceLinks: v.array(sourceLink),
    starts: v.number(),
    stintId: v.id('rosterStints'),
    weightPounds: nullableNumber,
  })
    .index('by_playerId_and_season', ['playerId', 'season'])
    .index('by_stintId_and_season', ['stintId', 'season'])
    .index('by_programId_and_season_and_room', [
      'programId',
      'season',
      'positionRoom',
    ]),

  evaluations: defineTable({
    dataQuality,
    direction: v.union(
      v.literal('inbound'),
      v.literal('outbound'),
      v.literal('neutral'),
    ),
    evaluatedAt: v.number(),
    kind: v.union(
      v.literal('recruiting'),
      v.literal('transfer'),
      v.literal('draft'),
      v.literal('owner'),
    ),
    notes: v.optional(v.string()),
    playerId: v.id('players'),
    provider: v.string(),
    rank: nullableNumber,
    scale: v.string(),
    score: nullableNumber,
    sourceUrl: v.optional(v.string()),
  })
    .index('by_playerId_and_evaluatedAt', ['playerId', 'evaluatedAt'])
    .index('by_provider_and_evaluatedAt', ['provider', 'evaluatedAt']),

  providerIdentities: defineTable({
    confirmed: v.boolean(),
    playerId: v.id('players'),
    provider: v.string(),
    providerId: v.string(),
    sourceUpdatedAt: v.number(),
  })
    .index('by_provider_and_providerId', ['provider', 'providerId'])
    .index('by_playerId_and_provider', ['playerId', 'provider']),

  unresolvedMatches: defineTable({
    candidatePlayerIds: v.array(v.id('players')),
    firstSeenAt: v.number(),
    label: v.string(),
    lastSeenAt: v.number(),
    provider: v.string(),
    reason: v.string(),
    resolvedPlayerId: v.optional(v.id('players')),
    sourceKey: v.string(),
    status: v.union(
      v.literal('open'),
      v.literal('resolved'),
      v.literal('ignored'),
    ),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_status_and_lastSeenAt', ['status', 'lastSeenAt']),

  movementEvents: defineTable({
    cohortRank: v.optional(v.number()),
    fromProgramId: v.optional(v.id('programs')),
    kind: movementKind,
    note: v.optional(v.string()),
    playerId: v.id('players'),
    programId: v.id('programs'),
    season: v.number(),
    sourceKey: v.string(),
    toProgramId: v.optional(v.id('programs')),
  })
    .index('by_playerId_and_season', ['playerId', 'season'])
    .index('by_programId_and_season_and_kind', ['programId', 'season', 'kind'])
    .index('by_sourceKey', ['sourceKey']),

  draftOutcomes: defineTable({
    combine: v.optional(
      v.object({
        fortyYardSeconds: nullableNumber,
        heightInches: nullableNumber,
        weightPounds: nullableNumber,
      }),
    ),
    dataQuality,
    overallPick: nullableNumber,
    playerId: v.id('players'),
    round: nullableNumber,
    sourceLinks: v.array(sourceLink),
    status: v.union(
      v.literal('drafted'),
      v.literal('undrafted_free_agent'),
      v.literal('practice_squad'),
      v.literal('later_entry'),
    ),
    team: v.optional(v.string()),
    year: v.number(),
  })
    .index('by_playerId_and_year', ['playerId', 'year'])
    .index('by_year_and_status', ['year', 'status']),

  programs: defineTable({
    abbreviation: v.optional(v.string()),
    classification: v.optional(ratingClassification),
    color: v.optional(v.string()),
    conference: v.optional(v.string()),
    cfbdId: v.optional(v.number()),
    key: v.string(),
    logos: v.optional(v.array(v.string())),
    mascot: v.optional(v.string()),
    name: v.string(),
    sourceUpdatedAt: v.optional(v.number()),
  })
    .index('by_key', ['key'])
    .index('by_cfbdId', ['cfbdId']),

  programAliases: defineTable({
    programId: v.id('programs'),
    source: teamDataSource,
    sourceKey: v.string(),
    sourceName: v.string(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_programId_and_source', ['programId', 'source']),

  programAffiliations: defineTable({
    classification: v.optional(ratingClassification),
    directorySize: v.optional(v.number()),
    sourceUpdatedAt: v.optional(v.number()),
    conference: v.string(),
    division: v.optional(v.string()),
    endSeason: v.optional(v.number()),
    programId: v.id('programs'),
    sourceKey: v.string(),
    startSeason: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_programId_and_startSeason', ['programId', 'startSeason'])
    .index('by_startSeason_and_conference', ['startSeason', 'conference']),

  venues: defineTable({
    capacity: v.optional(v.number()),
    city: v.optional(v.string()),
    country: v.optional(v.string()),
    elevationFeet: v.optional(v.number()),
    grass: v.optional(v.boolean()),
    name: v.string(),
    sourceVenueId: v.number(),
    state: v.optional(v.string()),
    timezone: v.optional(v.string()),
    yearConstructed: v.optional(v.number()),
  }).index('by_sourceVenueId', ['sourceVenueId']),

  programVenues: defineTable({
    endSeason: v.optional(v.number()),
    programId: v.id('programs'),
    startSeason: v.number(),
    venueId: v.id('venues'),
  })
    .index('by_programId_and_startSeason', ['programId', 'startSeason'])
    .index('by_venueId', ['venueId']),

  seasonRules: defineTable({
    baseEligibilitySeasons: v.number(),
    clockSeasons: v.number(),
    legacyRedshirtExtendsClock: v.boolean(),
    playoffByeCount: v.number(),
    playoffChampionBidCount: v.number(),
    playoffFieldSize: v.number(),
    rosterLimit: nullableNumber,
    season: v.number(),
    version: v.string(),
  }).index('by_season', ['season']),

  conferenceChampions: defineTable({
    conference: v.string(),
    programId: v.id('programs'),
    season: v.number(),
    sourceLinks: v.array(sourceLink),
  })
    .index('by_season_and_conference', ['season', 'conference'])
    .index('by_programId_and_season', ['programId', 'season']),

  teamRecruitingClasses: defineTable({
    averageRating: v.number(),
    commits: v.number(),
    fiveStars: v.number(),
    fourStars: v.number(),
    points: v.number(),
    programId: v.id('programs'),
    rank: v.number(),
    season: v.number(),
    sourceId: v.string(),
    sourceKey: v.string(),
    sourceProgramName: v.string(),
    sourceUpdatedAt: v.number(),
    threeStars: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_season_and_rank', ['season', 'rank'])
    .index('by_programId_and_season', ['programId', 'season']),

  teamSeasonStandings: defineTable({
    apCurrentRank: v.optional(v.number()),
    apHighRank: v.optional(v.number()),
    apPreseasonRank: v.optional(v.number()),
    conference: v.string(),
    conferenceChampion: v.boolean(),
    conferenceLosses: v.optional(v.number()),
    conferenceWinPercentage: v.optional(v.number()),
    conferenceWins: v.optional(v.number()),
    defense: perGameUnit,
    division: v.optional(v.string()),
    fourTeamPlayoff: v.boolean(),
    games: v.number(),
    losses: v.number(),
    nationalChampion: v.boolean(),
    offense: perGameUnit,
    programId: v.id('programs'),
    season: v.number(),
    simpleRatingSystem: v.number(),
    sourceId: v.string(),
    sourceKey: v.string(),
    sourceProgramName: v.string(),
    sourceUpdatedAt: v.number(),
    strengthOfSchedule: v.number(),
    twelveTeamPlayoff: v.boolean(),
    winPercentage: v.number(),
    wins: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_season_and_wins', ['season', 'wins'])
    .index('by_programId_and_season', ['programId', 'season']),

  teamSeasonProfiles: defineTable({
    passingUsage: v.optional(v.number()),
    receivingUsage: v.optional(v.number()),
    averageRecruitRating: nullableNumber,
    conference: v.optional(v.string()),
    programId: v.id('programs'),
    recruitingPoints: nullableNumber,
    recruitingRank: nullableNumber,
    returningPpa: nullableNumber,
    returningUsage: nullableNumber,
    season: v.number(),
    sourceUpdatedAt: v.number(),
    talent: nullableNumber,
  })
    .index('by_programId_and_season', ['programId', 'season'])
    .index('by_season_and_recruitingRank', ['season', 'recruitingRank']),

  teamDraftSelections: defineTable({
    age: v.optional(v.number()),
    allProFirstTeamSelections: v.number(),
    approximateValue: v.optional(v.number()),
    careerDefensiveInterceptions: v.optional(v.number()),
    careerGames: v.optional(v.number()),
    careerPassAttempts: v.optional(v.number()),
    careerPassCompletions: v.optional(v.number()),
    careerPassingInterceptions: v.optional(v.number()),
    careerPassingTouchdowns: v.optional(v.number()),
    careerPassingYards: v.optional(v.number()),
    careerReceptions: v.optional(v.number()),
    careerReceivingTouchdowns: v.optional(v.number()),
    careerReceivingYards: v.optional(v.number()),
    careerRushAttempts: v.optional(v.number()),
    careerRushingTouchdowns: v.optional(v.number()),
    careerRushingYards: v.optional(v.number()),
    careerSacks: v.optional(v.number()),
    careerSoloTackles: v.optional(v.number()),
    draftingTeam: v.string(),
    draftingTeamApproximateValue: v.optional(v.number()),
    finalSeason: v.optional(v.number()),
    pick: v.number(),
    pickValue: v.number(),
    playerName: v.string(),
    position: v.string(),
    proBowlSelections: v.number(),
    programId: v.id('programs'),
    round: v.number(),
    seasonsAsPrimaryStarter: v.number(),
    sourceId: v.string(),
    sourceKey: v.string(),
    sourceProgramName: v.string(),
    sourceUpdatedAt: v.number(),
    year: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_year_and_pick', ['year', 'pick'])
    .index('by_programId_and_year', ['programId', 'year']),

  collegeGames: defineTable({
    ratingEvidence: v.optional(gameEvidenceValidator),
    canceled: v.optional(v.boolean()),
    cancellationSource: v.optional(v.string()),
    attendance: v.optional(v.number()),
    awayClassification: v.optional(v.string()),
    awayConference: v.optional(v.string()),
    awayLineScores: v.optional(v.array(v.number())),
    awayPoints: v.optional(v.number()),
    awayPostgameElo: v.optional(v.number()),
    awayPregameElo: v.optional(v.number()),
    awayProgramId: v.id('programs'),
    awaySourceId: v.number(),
    awaySourceName: v.string(),
    completed: v.boolean(),
    conferenceGame: v.boolean(),
    excitementIndex: v.optional(v.number()),
    homeClassification: v.optional(v.string()),
    homeConference: v.optional(v.string()),
    homeLineScores: v.optional(v.array(v.number())),
    homePoints: v.optional(v.number()),
    homePostgameElo: v.optional(v.number()),
    homePregameElo: v.optional(v.number()),
    homeProgramId: v.id('programs'),
    homeSourceId: v.number(),
    homeSourceName: v.string(),
    matchupKey: v.string(),
    neutralSite: v.boolean(),
    notes: v.optional(v.string()),
    season: v.number(),
    seasonType,
    sourceGameId: v.number(),
    sourceKey: v.string(),
    sourceUpdatedAt: v.number(),
    startTime: v.number(),
    startTimeTbd: v.boolean(),
    tvOutlets: v.optional(v.array(v.string())),
    venue: v.optional(v.string()),
    venueId: v.optional(v.number()),
    venueRef: v.optional(v.id('venues')),
    week: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_season_and_week_and_startTime', ['season', 'week', 'startTime'])
    .index('by_season_and_startTime', ['season', 'startTime'])
    .index('by_homeProgramId_and_season', ['homeProgramId', 'season'])
    .index('by_awayProgramId_and_season', ['awayProgramId', 'season'])
    .index('by_matchupKey_and_startTime', ['matchupKey', 'startTime']),

  teamGameStats: defineTable({
    conference: v.optional(v.string()),
    gameId: v.id('collegeGames'),
    homeAway,
    opponentProgramId: v.id('programs'),
    points: v.optional(v.number()),
    programId: v.id('programs'),
    season: v.number(),
    sourceGameId: v.number(),
    sourceKey: v.string(),
    sourceProgramName: v.string(),
    sourceTeamId: v.number(),
    sourceUpdatedAt: v.number(),
    stats: v.array(v.object({ category: v.string(), value: v.string() })),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_gameId', ['gameId'])
    .index('by_programId_and_season', ['programId', 'season'])
    .index('by_season', ['season']),

  teamSeasonRatings: defineTable({
    conference: v.optional(v.string()),
    programId: v.id('programs'),
    rating: v.number(),
    season: v.number(),
    sourceKey: v.string(),
    sourceProgramName: v.string(),
    sourceUpdatedAt: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_season_and_rating', ['season', 'rating'])
    .index('by_programId_and_season', ['programId', 'season']),

  teamSeasonRatingInputs: defineTable({
    conference: v.optional(v.string()),
    programId: v.id('programs'),
    season: v.number(),
    signals: v.array(v.object({ key: v.string(), value: v.number() })),
    sourceProgramName: v.string(),
    sourceUpdatedAt: v.number(),
    sources: v.array(v.string()),
  })
    .index('by_programId_and_season', ['programId', 'season'])
    .index('by_season', ['season']),

  teamCompositeRatings: defineTable({
    confidence: v.number(),
    conference: v.optional(v.string()),
    dataSources: v.array(v.string()),
    dimensions: ratingDimensions,
    generatedAt: v.number(),
    modelVersion: v.string(),
    overall: v.number(),
    programId: v.id('programs'),
    programKey: v.string(),
    rank: v.number(),
    season: v.number(),
    signalCount: v.number(),
    sourceProgramName: v.string(),
  })
    .index('by_programId_and_season', ['programId', 'season'])
    .index('by_season_and_overall', ['season', 'overall']),

  ratingEditions: defineTable({
    ...rankingEditionFields,
    calibrationFitCount: v.optional(v.number()),
    calibrationIntercept: v.optional(v.number()),
    calibrationMaximumProbability: v.optional(v.number()),
    calibrationMinimumProbability: v.optional(v.number()),
    calibrationSlope: v.optional(v.number()),
    calibrationTrainingSeasons: v.optional(v.array(v.number())),
    calibrationVersion: v.string(),
    cutoffAt: v.number(),
    editionType: ratingEditionType,
    generatedAt: v.number(),
    leagueAveragePoints: v.number(),
    modelVersion: v.string(),
    resumeModelVersion: v.string(),
    resumeReferencePower: v.optional(v.number()),
    resumeVisible: v.boolean(),
    revision: v.number(),
    season: v.number(),
    sourceDataFingerprint: v.string(),
    sourceDataUpdatedAt: v.number(),
    sourceKey: v.string(),
    supersedesEditionId: v.optional(v.id('ratingEditions')),
    week: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_season_and_cutoffAt', ['season', 'cutoffAt'])
    .index('by_season_stage_cutoff', ['season', 'rankingStage', 'cutoffAt'])
    .index('by_season_week_type_revision', [
      'season',
      'week',
      'editionType',
      'revision',
    ]),

  teamRatingSnapshots: defineTable({
    ...programSnapshotFields,
    actualWins: v.optional(v.number()),
    classification: ratingClassification,
    conference: v.optional(v.string()),
    dataSources: v.array(v.string()),
    defense: v.number(),
    disagreementReasons: v.array(v.string()),
    dominanceComponent: v.optional(v.number()),
    editionId: v.id('ratingEditions'),
    expectedWins: v.optional(v.number()),
    gamesPlayed: v.number(),
    homeFieldAdvantage: v.number(),
    limitedSample: v.boolean(),
    offense: v.number(),
    power: v.number(),
    powerRank: v.optional(v.number()),
    priorWeight: v.number(),
    programId: v.id('programs'),
    programKey: v.string(),
    published: v.boolean(),
    rankDifference: v.optional(v.number()),
    resume: v.optional(v.number()),
    resumeRank: v.optional(v.number()),
    scheduleComponent: v.optional(v.number()),
    sourceProgramName: v.string(),
    specialTeams: v.number(),
    specialTeamsAvailable: v.boolean(),
  })
    .index('by_edition_and_power', ['editionId', 'power'])
    .index('by_edition_and_resume', ['editionId', 'resume'])
    .index('by_programId_and_edition', ['programId', 'editionId']),

  frozenForecasts: defineTable({
    awayProgramId: v.id('programs'),
    calibrationVersion: v.string(),
    cutoffAt: v.number(),
    editionId: v.id('ratingEditions'),
    expectedMargin: v.number(),
    frozenAt: v.number(),
    gameId: v.id('collegeGames'),
    homeFieldEffect: v.number(),
    homeProgramId: v.id('programs'),
    modelVersion: v.string(),
    sourceKey: v.string(),
    uncertainty: v.number(),
    winProbability: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_gameId_and_frozenAt', ['gameId', 'frozenAt'])
    .index('by_editionId', ['editionId']),

  playoffProjections: defineTable({
    editionId: v.id('ratingEditions'),
    field: v.array(
      v.object({
        bid: v.union(v.literal('automatic'), v.literal('at_large')),
        bye: v.boolean(),
        explanation: v.string(),
        programId: v.id('programs'),
        seed: v.number(),
      }),
    ),
    firstTeamOutProgramId: v.union(v.id('programs'), v.null()),
    generatedAt: v.number(),
    rulesVersion: v.string(),
    season: v.number(),
    sourceKey: v.string(),
    week: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_editionId', ['editionId'])
    .index('by_season_and_week', ['season', 'week']),

  rankingBallots: defineTable({
    editionId: v.id('ratingEditions'),
    entries: v.array(
      v.object({
        programId: v.id('programs'),
        rank: v.number(),
        seedRank: v.number(),
      }),
    ),
    season: v.number(),
    status: v.union(v.literal('draft'), v.literal('submitted')),
    submittedAt: v.union(v.number(), v.null()),
    updatedAt: v.number(),
    week: v.number(),
  }).index('by_season_and_week', ['season', 'week']),

  externalPollRanks: defineTable({
    poll: v.string(),
    programId: v.id('programs'),
    rank: v.number(),
    season: v.number(),
    sourceKey: v.string(),
    sourceUpdatedAt: v.number(),
    week: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_season_and_week_and_poll', ['season', 'week', 'poll'])
    .index('by_programId_and_season_and_week', ['programId', 'season', 'week']),

  playerGames: defineTable({
    dataQuality,
    defense: phasePerformance,
    gameId: v.id('collegeGames'),
    offense: phasePerformance,
    playerId: v.id('players'),
    programId: v.id('programs'),
    season: v.number(),
    sourceLinks: v.array(sourceLink),
    specialTeams: phasePerformance,
    statistics: v.array(
      v.object({
        category: v.string(),
        value: v.number(),
      }),
    ),
    updatedAt: v.number(),
  })
    .index('by_playerId_and_gameId', ['playerId', 'gameId'])
    .index('by_gameId_and_playerId', ['gameId', 'playerId'])
    .index('by_playerId_and_season', ['playerId', 'season'])
    .index('by_programId_and_season', ['programId', 'season']),

  nflIdentities: defineTable({
    dataQuality,
    entryPath: v.union(
      v.literal('drafted'),
      v.literal('undrafted_free_agent'),
      v.literal('practice_squad'),
      v.literal('later_entry'),
    ),
    firstSeason: v.number(),
    playerId: v.id('players'),
    provider: v.string(),
    providerId: v.string(),
    sourceLinks: v.array(sourceLink),
  })
    .index('by_provider_and_providerId', ['provider', 'providerId'])
    .index('by_playerId', ['playerId'])
    .index('by_firstSeason', ['firstSeason']),

  nflWeeklyRosters: defineTable({
    nflIdentityId: v.id('nflIdentities'),
    playerId: v.id('players'),
    season: v.number(),
    sourceKey: v.string(),
    sourceUpdatedAt: v.number(),
    status: v.union(
      v.literal('active'),
      v.literal('practice_squad'),
      v.literal('injured_reserve'),
      v.literal('reserve'),
      v.literal('inactive'),
    ),
    team: v.string(),
    week: v.number(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_playerId_and_season_and_week', ['playerId', 'season', 'week']),

  nflGames: defineTable({
    awayTeam: v.string(),
    completed: v.boolean(),
    homeTeam: v.string(),
    season: v.number(),
    sourceGameId: v.string(),
    startTime: v.number(),
    week: v.number(),
  })
    .index('by_sourceGameId', ['sourceGameId'])
    .index('by_season_and_week', ['season', 'week']),

  nflPlayerGames: defineTable({
    defenseSnaps: nullableNumber,
    gameId: v.id('nflGames'),
    offenseSnaps: nullableNumber,
    playerId: v.id('players'),
    sourceKey: v.string(),
    sourceUpdatedAt: v.number(),
    specialTeamsSnaps: nullableNumber,
    started: v.boolean(),
    statistics: v.array(
      v.object({
        category: v.string(),
        value: v.number(),
      }),
    ),
    team: v.string(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_playerId_and_gameId', ['playerId', 'gameId'])
    .index('by_gameId', ['gameId']),

  nflSeasonSummaries: defineTable({
    defenseSnaps: v.number(),
    games: v.number(),
    offenseSnaps: v.number(),
    playerId: v.id('players'),
    season: v.number(),
    specialTeamsSnaps: v.number(),
    starts: v.number(),
    statistics: v.array(
      v.object({
        category: v.string(),
        value: v.number(),
      }),
    ),
  })
    .index('by_playerId_and_season', ['playerId', 'season'])
    .index('by_season', ['season']),

  ownerSessions: defineTable({
    createdAt: v.number(),
    expiresAt: v.number(),
    lastUsedAt: v.number(),
    revokedAt: v.union(v.number(), v.null()),
    tokenHash: v.string(),
  })
    .index('by_tokenHash', ['tokenHash'])
    .index('by_expiresAt', ['expiresAt']),

  backupManifests: defineTable({
    completedAt: v.number(),
    counts: v.array(
      v.object({
        count: v.number(),
        dataset: v.string(),
      }),
    ),
    fingerprint: v.string(),
    dataRevision: v.optional(v.number()),
    reason: v.string(),
    schemaVersion: v.string(),
  }).index('by_completedAt', ['completedAt']),

  michiganDataRevisions: defineTable({
    key: v.string(),
    revision: v.number(),
    updatedAt: v.number(),
  }).index('by_key', ['key']),

  ownerAuditEvents: defineTable({
    action: v.string(),
    actor: v.string(),
    backupManifestId: v.optional(v.id('backupManifests')),
    completedAt: v.number(),
    error: v.optional(v.string()),
    result: v.union(v.literal('failed'), v.literal('succeeded')),
    sessionId: v.optional(v.id('ownerSessions')),
    startedAt: v.number(),
    target: v.string(),
    warnings: v.array(v.string()),
  }).index('by_startedAt', ['startedAt']),

  operationRuns: defineTable({
    backupManifestId: v.optional(v.id('backupManifests')),
    completedAt: v.union(v.number(), v.null()),
    errors: v.array(v.string()),
    fingerprint: v.string(),
    kind: v.union(
      v.literal('bulk_import'),
      v.literal('delete'),
      v.literal('merge'),
      v.literal('migration'),
      v.literal('prune'),
      v.literal('restore'),
      v.literal('rollover'),
    ),
    startedAt: v.number(),
    status: v.union(
      v.literal('dry_run'),
      v.literal('running'),
      v.literal('succeeded'),
      v.literal('failed'),
    ),
    warnings: v.array(v.string()),
  }).index('by_kind_and_startedAt', ['kind', 'startedAt']),

  teamDataSyncState: defineTable({
    acceptedRows: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    fetchedRows: v.optional(v.number()),
    rejectedRows: v.optional(v.number()),
    source: teamDataSource,
    startedAt: v.number(),
    status: v.union(
      v.literal('running'),
      v.literal('succeeded'),
      v.literal('failed'),
    ),
    warnings: v.optional(v.array(v.string())),
  }).index('by_source', ['source']),
})
