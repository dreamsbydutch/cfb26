import { v } from 'convex/values'
import { internalMutation, query } from './_generated/server'
import { hockeyDraft, hockeyDraftProjection } from './hockeyDraftFields'
import { hockeyPlayerKey, validateHockeyDraft } from './hockeyDraftModel'

export const importMatched = internalMutation({
  args: {
    rows: v.array(
      v.object({
        draft: hockeyDraft,
        rosterIds: v.array(v.id('teamRosterEntries')),
      }),
    ),
  },
  returns: v.object({
    saved: v.number(),
    unchanged: v.number(),
    matchedRosterEntries: v.number(),
  }),
  handler: async (ctx, { rows }) => {
    if (!rows.length || rows.length > 150)
      throw new Error('Import 1-150 matched NHL selections.')
    const seen = new Set<string>()
    let saved = 0,
      unchanged = 0,
      matchedRosterEntries = 0
    for (const { draft, rosterIds } of rows) {
      validateHockeyDraft(draft)
      const playerKey = hockeyPlayerKey(draft.playerName)
      const key = `${draft.year}:${draft.overallPick}`
      if (
        seen.has(key) ||
        !rosterIds.length ||
        rosterIds.length > 30 ||
        new Set(rosterIds).size !== rosterIds.length
      )
        throw new Error('Duplicate pick or missing/duplicate roster matches.')
      seen.add(key)
      for (const id of rosterIds) {
        const player = await ctx.db.get('teamRosterEntries', id)
        if (
          !player ||
          player.sport !== 'hockey' ||
          hockeyPlayerKey(String(player.values.name ?? '')) !== playerKey ||
          draft.year < player.season - 10 ||
          draft.year > player.season + 6
        )
          throw new Error(
            'Draft selection does not match the saved hockey player.',
          )
      }
      matchedRosterEntries += rosterIds.length
      const existing = await ctx.db
        .query('hockeyDraftSelections')
        .withIndex('by_year_and_pick', (q) =>
          q.eq('year', draft.year).eq('overallPick', draft.overallPick),
        )
        .unique()
      if (existing && existing.playerKey !== playerKey)
        throw new Error('Draft pick belongs to a different player.')
      const playerSelections = await ctx.db
        .query('hockeyDraftSelections')
        .withIndex('by_playerKey_and_year', (q) =>
          q.eq('playerKey', playerKey).eq('year', draft.year),
        )
        .take(2)
      if (
        playerSelections.some(
          (selection) => selection.overallPick !== draft.overallPick,
        )
      )
        throw new Error('Conflicting saved NHL pick for player and year.')
      if (
        existing &&
        Object.entries(draft).every(
          ([field, value]) => existing[field as keyof typeof draft] === value,
        )
      ) {
        unchanged++
        continue
      }
      const values = { ...draft, playerKey, importedAt: Date.now() }
      if (existing)
        await ctx.db.patch('hockeyDraftSelections', existing._id, values)
      else await ctx.db.insert('hockeyDraftSelections', values)
      saved++
    }
    return { saved, unchanged, matchedRosterEntries }
  },
})

export const importProjection = internalMutation({
  args: {
    projection: hockeyDraftProjection,
    rosterIds: v.array(v.id('teamRosterEntries')),
    expectedObservedAt: v.union(v.number(), v.null()),
  },
  returns: v.boolean(),
  handler: async (ctx, { projection, rosterIds, expectedObservedAt }) => {
    const playerKey = hockeyPlayerKey(projection.playerName)
    const profile = new URL(projection.sourcePlayerUrl)
    if (
      !projection.playerName.trim() ||
      projection.playerName.length > 100 ||
      !Number.isInteger(projection.draftYear) ||
      projection.draftYear < 2027 ||
      projection.draftYear > 2200 ||
      !Number.isInteger(projection.rank) ||
      projection.rank < 1 ||
      projection.rank > 100 ||
      !Number.isFinite(projection.observedAt) ||
      projection.observedAt < Date.UTC(2026, 0, 1) ||
      projection.observedAt > Date.now() + 60_000 ||
      !/^[a-f0-9]{64}$/.test(projection.sourceSha256) ||
      profile.origin !== 'https://www.eliteprospects.com' ||
      profile.username ||
      profile.password ||
      profile.search ||
      profile.hash ||
      !/^\/player\/\d+\/[a-z0-9-]+$/.test(profile.pathname) ||
      hockeyPlayerKey(profile.pathname.split('/').at(-1) ?? '') !== playerKey ||
      !rosterIds.length ||
      rosterIds.length > 30 ||
      new Set(rosterIds).size !== rosterIds.length
    )
      throw new Error('Invalid sourced NHL draft projection.')
    for (const id of rosterIds) {
      const player = await ctx.db.get('teamRosterEntries', id)
      if (
        !player ||
        player.sport !== 'hockey' ||
        hockeyPlayerKey(String(player.values.name ?? '')) !== playerKey ||
        player.season + 1 !== projection.draftYear
      )
        throw new Error(
          'Projection must match a saved hockey player in the draft season.',
        )
    }
    const drafted = await ctx.db
      .query('hockeyDraftSelections')
      .withIndex('by_playerKey_and_year', (q) => q.eq('playerKey', playerKey))
      .first()
    if (drafted)
      throw new Error('Player already has a completed NHL selection.')
    const previous = await ctx.db
      .query('hockeyDraftProjections')
      .withIndex('by_playerKey_and_year', (q) =>
        q.eq('playerKey', playerKey).eq('draftYear', projection.draftYear),
      )
      .unique()
    if (
      previous &&
      Object.entries(projection).every(
        ([field, value]) =>
          previous[field as keyof typeof projection] === value,
      )
    )
      return false
    if (
      (previous?.observedAt ?? null) !== expectedObservedAt ||
      (previous && projection.observedAt <= previous.observedAt)
    )
      throw new Error('Draft projection changed or observation is stale.')
    if (previous)
      await ctx.db.patch('hockeyDraftProjections', previous._id, projection)
    else
      await ctx.db.insert('hockeyDraftProjections', {
        ...projection,
        playerKey,
      })
    return true
  },
})

export const forSeason = query({
  args: { season: v.number() },
  returns: v.array(
    v.object({
      playerKey: v.string(),
      selections: v.array(hockeyDraft),
      projection: v.union(hockeyDraftProjection, v.null()),
    }),
  ),
  handler: async (ctx, { season }) => {
    if (!Number.isInteger(season) || season < 1900 || season > 2200)
      throw new Error('Invalid hockey season.')
    const roster = await ctx.db
      .query('teamRosterEntries')
      .withIndex('by_sport_and_season', (q) =>
        q.eq('sport', 'hockey').eq('season', season),
      )
      .take(101)
    const keys = [
      ...new Set(
        roster.map((player) =>
          hockeyPlayerKey(String(player.values.name ?? '')),
        ),
      ),
    ]
    return await Promise.all(
      keys.map(async (playerKey) => {
        const rows = await ctx.db
          .query('hockeyDraftSelections')
          .withIndex('by_playerKey_and_year', (q) =>
            q.eq('playerKey', playerKey),
          )
          .order('desc')
          .take(5)
        const projectionRow = rows.length
          ? null
          : await ctx.db
              .query('hockeyDraftProjections')
              .withIndex('by_playerKey_and_year', (q) =>
                q.eq('playerKey', playerKey).eq('draftYear', season + 1),
              )
              .unique()
        const projection = projectionRow
          ? {
              playerName: projectionRow.playerName,
              draftYear: projectionRow.draftYear,
              rank: projectionRow.rank,
              sourceUrl: projectionRow.sourceUrl,
              sourcePlayerUrl: projectionRow.sourcePlayerUrl,
              observedAt: projectionRow.observedAt,
              sourceSha256: projectionRow.sourceSha256,
            }
          : null
        return {
          playerKey,
          projection,
          selections: rows.map(
            ({
              playerName,
              year,
              round,
              overallPick,
              nhlTeam,
              priorToMichigan,
              sourceUrl,
              sourceSha256,
            }) => ({
              playerName,
              year,
              round,
              overallPick,
              nhlTeam,
              priorToMichigan,
              sourceUrl,
              sourceSha256,
            }),
          ),
        }
      }),
    )
  },
})
