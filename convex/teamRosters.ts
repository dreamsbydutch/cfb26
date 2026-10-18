import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import schema from './schema'
import { requireOwnerSession } from './rosterAdmin'
import { teamSport, teamValues, validateTeamValues } from './teamRosterFields'

function validateSeason(season: number) {
  if (!Number.isInteger(season) || season < 1900 || season > 2200)
    throw new Error('Enter a valid season start year.')
}

export const list = query({
  args: { sport: teamSport, season: v.number() },
  returns: v.object({
    revision: v.number(),
    entries: v.array(schema.doc('teamRosterEntries')),
  }),
  handler: async (ctx, { sport, season }) => {
    validateSeason(season)
    const state = await ctx.db
      .query('teamRosterRevisions')
      .withIndex('by_sport_and_season', (q) =>
        q.eq('sport', sport).eq('season', season),
      )
      .unique()
    const entries = await ctx.db
      .query('teamRosterEntries')
      .withIndex('by_sport_and_season', (q) =>
        q.eq('sport', sport).eq('season', season),
      )
      .take(101)
    return { revision: state?.revision ?? 0, entries }
  },
})

export const save = mutation({
  args: {
    sessionToken: v.string(),
    sport: teamSport,
    season: v.number(),
    expectedRevision: v.number(),
    rows: v.array(
      v.object({
        id: v.optional(v.id('teamRosterEntries')),
        values: teamValues,
      }),
    ),
  },
  returns: v.object({ revision: v.number(), saved: v.number() }),
  handler: async (ctx, args) => {
    const session = await requireOwnerSession(ctx, args.sessionToken)
    validateSeason(args.season)
    if (!args.rows.length || args.rows.length > 100)
      throw new Error('Save between 1 and 100 rows.')
    const state = await ctx.db
      .query('teamRosterRevisions')
      .withIndex('by_sport_and_season', (q) =>
        q.eq('sport', args.sport).eq('season', args.season),
      )
      .unique()
    if ((state?.revision ?? 0) !== args.expectedRevision)
      throw new Error(
        'This roster changed in another session. Discard your draft to load the latest roster before editing again.',
      )
    const entries = await ctx.db
      .query('teamRosterEntries')
      .withIndex('by_sport_and_season', (q) =>
        q.eq('sport', args.sport).eq('season', args.season),
      )
      .take(101)
    if (entries.length + args.rows.filter((row) => !row.id).length > 100)
      throw new Error('This season supports up to 100 roster entries.')
    const seen = new Set<string>()
    for (const row of args.rows) {
      const values = validateTeamValues(args.sport, row.values)
      if (row.id) {
        if (seen.has(row.id)) throw new Error('Duplicate row in save.')
        seen.add(row.id)
        if (!entries.some((entry) => entry._id === row.id))
          throw new Error('Player does not belong to this sport and season.')
        await ctx.db.patch('teamRosterEntries', row.id, {
          values,
          updatedAt: Date.now(),
        })
      } else {
        await ctx.db.insert('teamRosterEntries', {
          sport: args.sport,
          season: args.season,
          values,
          updatedAt: Date.now(),
        })
      }
    }
    const revision = args.expectedRevision + 1
    if (state)
      await ctx.db.patch('teamRosterRevisions', state._id, { revision })
    else
      await ctx.db.insert('teamRosterRevisions', {
        sport: args.sport,
        season: args.season,
        revision,
      })
    await ctx.db.insert('teamRosterAudit', {
      sport: args.sport,
      season: args.season,
      revision,
      sessionId: session._id,
      saved: args.rows.length,
      createdAt: Date.now(),
    })
    await ctx.db.patch('ownerSessions', session._id, { lastUsedAt: Date.now() })
    return { revision, saved: args.rows.length }
  },
})
