import { v } from 'convex/values'
import { action, internalQuery } from './_generated/server'
import { internal } from './_generated/api'
import { hockeyDraft } from './hockeyDraftFields'
import { hockeyPlayerKey } from './hockeyDraftModel'
import { nhlHistory } from './hockeyNhlFields'
import {
  candidateIds,
  matchesMichiganPlayer,
  normalizeNhlHistory,
  unmatchedHistory,
} from './hockeyNhlModel'
import type { NhlHistory } from './hockeyNhlFields'

export const rosterIdentity = internalQuery({
  args: { rosterId: v.id('teamRosterEntries') },
  returns: v.object({
    name: v.string(),
    season: v.number(),
    drafts: v.array(hockeyDraft),
  }),
  handler: async (ctx, { rosterId }) => {
    const row = await ctx.db.get('teamRosterEntries', rosterId)
    if (!row || row.sport !== 'hockey' || typeof row.values.name !== 'string')
      throw new Error('Hockey roster player not found.')
    const records = await ctx.db
      .query('hockeyDraftSelections')
      .withIndex('by_playerKey_and_year', (q) =>
        q.eq('playerKey', hockeyPlayerKey(String(row.values.name))),
      )
      .take(5)
    return {
      name: row.values.name,
      season: row.season,
      drafts: records.map(
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
  },
})

async function nhlJson(url: string): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (!response.ok) throw new Error('NHL history is temporarily unavailable.')
  return response.json() as Promise<unknown>
}

export const forPlayer = action({
  args: { rosterId: v.id('teamRosterEntries') },
  returns: nhlHistory,
  handler: async (ctx, args): Promise<NhlHistory> => {
    const identity = await ctx.runQuery(internal.hockeyNhl.rosterIdentity, args)
    // Fixed hosts and saved roster identity only: never a client-supplied URL/name.
    const surname = identity.name.trim().split(/\s+/).at(-1) ?? identity.name
    const search = await nhlJson(
      `https://search.d3.nhle.com/api/v1/search/player?culture=en-us&limit=100&q=${encodeURIComponent(surname)}`,
    )
    const ids = candidateIds(search, identity.name)
    const players = await Promise.all(
      ids.map(async (id) => {
        const payload = await nhlJson(
          `https://api-web.nhle.com/v1/player/${id}/landing`,
        )
        return matchesMichiganPlayer(
          payload,
          id,
          identity.name,
          identity.season,
          identity.drafts,
        )
          ? payload
          : null
      }),
    )
    const matched = players.filter((player) => player !== null)
    return matched.length === 1
      ? normalizeNhlHistory(matched[0], Date.now())
      : unmatchedHistory(identity.name, Date.now())
  },
})
