import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

const rosterStatus = v.union(
  v.literal('active'),
  v.literal('committed'),
  v.literal('departed'),
)

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
    eligibilityEndSeason: v.number(),
    eligibilityLeaveSeason: v.number(),
    eligibilityStartSeason: v.number(),
    endSeason: v.optional(v.number()),
    heightInches: v.optional(v.number()),
    jerseyNumber: v.optional(v.number()),
    legacyKey: v.string(),
    medicalExtensionSeasons: v.optional(v.number()),
    playerId: v.id('players'),
    position: v.string(),
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
