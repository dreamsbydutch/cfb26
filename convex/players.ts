import { v } from 'convex/values'
import { query } from './_generated/server'
import { resolvePlayerSeasonEligibility } from './eligibility'
import { derivePositionRoom, summarizePhaseGrades } from './playerDomain'

const boundedLimit = (limit: number | undefined, fallback: number) =>
  Math.min(Math.max(Math.floor(limit ?? fallback), 1), 100)

export const search = query({
  args: {
    searchText: v.string(),
    homeState: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const searchText = args.searchText.trim()
    if (!searchText) return []
    return ctx.db
      .query('players')
      .withSearchIndex('search_displayName', (searchQuery) => {
        const results = searchQuery.search('displayName', searchText)
        return args.homeState
          ? results.eq('homeState', args.homeState)
          : results
      })
      .take(boundedLimit(args.limit, 25))
  },
})

export const getProfile = query({
  args: { playerId: v.id('players') },
  handler: async (ctx, args) => {
    const player = await ctx.db.get('players', args.playerId)
    if (!player) return null
    const [
      commitments,
      stints,
      seasons,
      evaluations,
      movements,
      draft,
      games,
      nflIdentity,
      nflSeasons,
      nflWeeks,
    ] = await Promise.all([
      ctx.db
        .query('commitments')
        .withIndex('by_playerId_and_season', (q) =>
          q.eq('playerId', args.playerId),
        )
        .take(20),
      ctx.db
        .query('rosterStints')
        .withIndex('by_playerId_and_startSeason', (q) =>
          q.eq('playerId', args.playerId),
        )
        .take(20),
      ctx.db
        .query('playerSeasons')
        .withIndex('by_playerId_and_season', (q) =>
          q.eq('playerId', args.playerId),
        )
        .take(50),
      ctx.db
        .query('evaluations')
        .withIndex('by_playerId_and_evaluatedAt', (q) =>
          q.eq('playerId', args.playerId),
        )
        .take(50),
      ctx.db
        .query('movementEvents')
        .withIndex('by_playerId_and_season', (q) =>
          q.eq('playerId', args.playerId),
        )
        .take(50),
      ctx.db
        .query('draftOutcomes')
        .withIndex('by_playerId_and_year', (q) =>
          q.eq('playerId', args.playerId),
        )
        .take(20),
      ctx.db
        .query('playerGames')
        .withIndex('by_playerId_and_season', (q) =>
          q.eq('playerId', args.playerId),
        )
        .take(300),
      ctx.db
        .query('nflIdentities')
        .withIndex('by_playerId', (q) => q.eq('playerId', args.playerId))
        .first(),
      ctx.db
        .query('nflSeasonSummaries')
        .withIndex('by_playerId_and_season', (q) =>
          q.eq('playerId', args.playerId),
        )
        .take(30),
      ctx.db
        .query('nflWeeklyRosters')
        .withIndex('by_playerId_and_season_and_week', (q) =>
          q.eq('playerId', args.playerId),
        )
        .order('desc')
        .take(100),
    ])

    const ruleRows = await Promise.all(
      [...new Set(seasons.map((season) => season.season))].map((season) =>
        ctx.db
          .query('seasonRules')
          .withIndex('by_season', (q) => q.eq('season', season))
          .unique(),
      ),
    )
    const rules = new Map(
      ruleRows.flatMap((rule) => (rule ? [[rule.season, rule] as const] : [])),
    )
    const grades = {
      defense: summarizePhaseGrades(games.map((game) => game.defense)),
      offense: summarizePhaseGrades(games.map((game) => game.offense)),
      specialTeams: summarizePhaseGrades(
        games.map((game) => game.specialTeams),
      ),
    }

    return {
      commitments,
      draft,
      evaluations,
      grades,
      games,
      movements,
      nfl: { identity: nflIdentity, seasons: nflSeasons, weeks: nflWeeks },
      player,
      seasons: seasons.map((season) => ({
        ...season,
        eligibility: resolvePlayerSeasonEligibility(
          season,
          rules.get(season.season) ?? null,
        ),
        positionRoom: derivePositionRoom(season.listedPosition),
      })),
      stints,
    }
  },
})

export const compare = query({
  args: { playerIds: v.array(v.id('players')) },
  handler: async (ctx, args) => {
    const playerIds = [...new Set(args.playerIds)]
    if (playerIds.length === 0 || playerIds.length > 4) {
      throw new Error('Choose between one and four players.')
    }
    return Promise.all(
      playerIds.map(async (playerId) => {
        const player = await ctx.db.get('players', playerId)
        if (!player) return null
        const [seasons, games, nfl] = await Promise.all([
          ctx.db
            .query('playerSeasons')
            .withIndex('by_playerId_and_season', (q) =>
              q.eq('playerId', playerId),
            )
            .take(50),
          ctx.db
            .query('playerGames')
            .withIndex('by_playerId_and_season', (q) =>
              q.eq('playerId', playerId),
            )
            .take(300),
          ctx.db
            .query('nflSeasonSummaries')
            .withIndex('by_playerId_and_season', (q) =>
              q.eq('playerId', playerId),
            )
            .take(30),
        ])
        return {
          grades: {
            defense: summarizePhaseGrades(games.map((game) => game.defense)),
            offense: summarizePhaseGrades(games.map((game) => game.offense)),
            specialTeams: summarizePhaseGrades(
              games.map((game) => game.specialTeams),
            ),
          },
          nfl,
          player,
          seasons: seasons.map((season) => ({
            ...season,
            positionRoom: derivePositionRoom(season.listedPosition),
          })),
        }
      }),
    ).then((rows) => rows.filter((row) => row !== null))
  },
})

export const listNflAlumni = query({
  args: { fromSeason: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identities = await ctx.db
      .query('nflIdentities')
      .withIndex('by_firstSeason', (q) =>
        q.gte('firstSeason', Math.max(2015, args.fromSeason ?? 2015)),
      )
      .take(boundedLimit(args.limit, 100))
    return Promise.all(
      identities.map(async (identity) => {
        const [player, seasons, latestWeek] = await Promise.all([
          ctx.db.get('players', identity.playerId),
          ctx.db
            .query('nflSeasonSummaries')
            .withIndex('by_playerId_and_season', (q) =>
              q.eq('playerId', identity.playerId),
            )
            .take(30),
          ctx.db
            .query('nflWeeklyRosters')
            .withIndex('by_playerId_and_season_and_week', (q) =>
              q.eq('playerId', identity.playerId),
            )
            .order('desc')
            .first(),
        ])
        return { identity, latestWeek, player, seasons }
      }),
    ).then((rows) => rows.filter((row) => row.player !== null))
  },
})
