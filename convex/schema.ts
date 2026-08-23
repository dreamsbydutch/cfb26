import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const rosterStatus = v.union(
  v.literal('active'),
  v.literal('committed'),
  v.literal('departed'),
)

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

const injury = v.object({
  expectedReturn: v.optional(v.string()),
  kind: injuryKind,
  note: v.optional(v.string()),
  updatedAt: v.number(),
})

const positionChange = v.object({
  effectiveSeason: v.number(),
  fromPosition: v.string(),
  note: v.optional(v.string()),
  recordedAt: v.number(),
  toPosition: v.string(),
})

const recruitingSource = v.union(
  v.literal('high_school'),
  v.literal('transfer'),
  v.literal('walk_on'),
)

const movementKind = v.union(
  v.literal('recruited'),
  v.literal('walk_on'),
  v.literal('transfer_in'),
  v.literal('transfer_out'),
  v.literal('graduated'),
  v.literal('retired'),
  v.literal('dismissed'),
)

const snapPhase = v.union(v.literal('offense'), v.literal('defense'))

const teamDataSource = v.union(
  v.literal('recruiting'),
  v.literal('standings'),
  v.literal('draft'),
  v.literal('games'),
  v.literal('game_stats'),
  v.literal('ratings'),
  v.literal('rating_inputs'),
)

const seasonType = v.union(v.literal('regular'), v.literal('postseason'))

const homeAway = v.union(v.literal('home'), v.literal('away'))

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
    displayName: v.string(),
    highSchool: v.string(),
    homeState: v.string(),
    hometown: v.string(),
    legacyKey: v.string(),
    slug: v.string(),
    sourceUpdatedAt: v.number(),
  })
    .index('by_legacyKey', ['legacyKey'])
    .index('by_slug', ['slug'])
    .searchIndex('search_displayName', {
      searchField: 'displayName',
      filterFields: ['homeState'],
    }),

  recruitingProfiles: defineTable({
    classRank: v.number(),
    compositeOverallRank: v.optional(v.number()),
    compositePositionRank: v.optional(v.number()),
    compositeRating: v.optional(v.number()),
    compositeStateRank: v.optional(v.number()),
    heightInches: v.optional(v.number()),
    legacyKey: v.string(),
    playerId: v.id('players'),
    position: v.optional(v.string()),
    recruitingSeason: v.number(),
    service247OverallRank: v.optional(v.number()),
    service247PositionRank: v.optional(v.number()),
    service247Rating: v.optional(v.number()),
    service247StateRank: v.optional(v.number()),
    source: recruitingSource,
    weightPounds: v.optional(v.number()),
  })
    .index('by_playerId', ['playerId'])
    .index('by_recruitingSeason_and_source', ['recruitingSeason', 'source']),

  rosterStints: defineTable({
    departureClass: v.optional(v.string()),
    departureRank: v.optional(v.number()),
    depthChartOrder: v.optional(v.number()),
    depthTierOverride: v.optional(depthTier),
    eligibilityEndSeason: v.number(),
    eligibilityLeaveSeason: v.number(),
    eligibilityStartSeason: v.number(),
    endSeason: v.optional(v.number()),
    extraEligibilitySeasons: v.optional(v.number()),
    heightInches: v.optional(v.number()),
    injury: v.optional(injury),
    jerseyNumber: v.optional(v.number()),
    legacyKey: v.string(),
    medicalExtensionSeasons: v.optional(v.number()),
    playerId: v.id('players'),
    position: v.string(),
    positionChanges: v.optional(v.array(positionChange)),
    programId: v.id('programs'),
    redshirtSeasons: v.optional(v.number()),
    startSeason: v.number(),
    status: rosterStatus,
    weightPounds: v.optional(v.number()),
  })
    .index('by_legacyKey', ['legacyKey'])
    .index('by_playerId_and_startSeason', ['playerId', 'startSeason'])
    .index('by_programId_and_startSeason', ['programId', 'startSeason'])
    .index('by_programId_and_status_and_position', [
      'programId',
      'status',
      'position',
    ]),

  programCareerSummaries: defineTable({
    gamesPlayed: v.number(),
    legacyKey: v.string(),
    playerId: v.id('players'),
    programId: v.id('programs'),
    recentRating: v.number(),
    snaps: v.number(),
  })
    .index('by_legacyKey', ['legacyKey'])
    .index('by_playerId_and_programId', ['playerId', 'programId']),

  seasonalPlayerStats: defineTable({
    compositeRating: v.number(),
    gamesPlayed: v.number(),
    phase: snapPhase,
    playerId: v.optional(v.id('players')),
    pffRating: v.number(),
    position: v.string(),
    programId: v.id('programs'),
    recruitingSeason: v.number(),
    recruitingType: v.string(),
    season: v.number(),
    snaps: v.number(),
    sourceKey: v.string(),
    sourceNumber: v.string(),
    sourcePlayerName: v.string(),
  })
    .index('by_playerId_and_season', ['playerId', 'season'])
    .index('by_programId_and_season_and_snaps', [
      'programId',
      'season',
      'snaps',
    ])
    .index('by_sourceKey', ['sourceKey']),

  movementEvents: defineTable({
    cohortRank: v.optional(v.number()),
    fromProgramId: v.optional(v.id('programs')),
    kind: movementKind,
    legacyCode: v.string(),
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
    legacyKey: v.string(),
    overallPick: v.optional(v.number()),
    playerId: v.id('players'),
    round: v.optional(v.number()),
    status: v.union(v.literal('drafted'), v.literal('undrafted_free_agent')),
    team: v.string(),
    year: v.number(),
  })
    .index('by_legacyKey', ['legacyKey'])
    .index('by_playerId', ['playerId'])
    .index('by_year_and_status', ['year', 'status']),

  programs: defineTable({
    key: v.string(),
    name: v.string(),
  }).index('by_key', ['key']),

  programAliases: defineTable({
    programId: v.id('programs'),
    source: teamDataSource,
    sourceKey: v.string(),
    sourceName: v.string(),
  })
    .index('by_sourceKey', ['sourceKey'])
    .index('by_programId_and_source', ['programId', 'source']),

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
    venue: v.optional(v.string()),
    venueId: v.optional(v.number()),
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

  legacyPlayerRows: defineTable({
    CompositeOverallRank: v.string(),
    CompositePositionRank: v.string(),
    CompositeRating: v.string(),
    CompositeStateRank: v.string(),
    CurrentHeight: v.string(),
    CurrentPos: v.string(),
    CurrentWeight: v.string(),
    DepartRank: v.string(),
    DepthChart: v.string(),
    DraftOverall: v.string(),
    DraftRound: v.string(),
    DraftTeam: v.string(),
    DraftYear: v.string(),
    EligEnd: v.string(),
    EligLeave: v.string(),
    EligStart: v.string(),
    FinishType: v.string(),
    FirstYear: v.string(),
    Highschool: v.string(),
    Hometown: v.string(),
    LastYear: v.string(),
    MichiganGamesPlayed: v.string(),
    MichiganSnaps: v.string(),
    Number: v.string(),
    Player: v.string(),
    ProCareerValue: v.string(),
    ProGamesPlayed: v.string(),
    RecentMichiganRtg: v.string(),
    Recruit: v.string(),
    RecruitHeight: v.string(),
    RecruitingRank: v.string(),
    RecruitPos: v.string(),
    RecruitWeight: v.string(),
    RecruitYear: v.string(),
    RedshirtYears: v.string(),
    State: v.string(),
    TransferInTeam: v.string(),
    TransferOutTeam: v.string(),
    migratedAt: v.number(),
    migrationState: v.string(),
    migrationVersion: v.number(),
    service247OverallRank: v.string(),
    service247PositionRank: v.string(),
    service247Rating: v.string(),
    service247StateRank: v.string(),
  }).index('by_migrationState', ['migrationState']),
})
