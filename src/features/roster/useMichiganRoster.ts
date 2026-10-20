import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'
import { compareAdminRosterPlayers } from '~/features/roster/adminRosterOrder'
import {
  compareDisplayedSnaps,
  rosterGroup,
  rosterParticipation,
} from '~/features/michigan/rosterSheetModel'

export type SeasonDashboard = NonNullable<
  FunctionReturnType<typeof api.rosters.getSeasonDashboard>
>
export type RosterEntry = SeasonDashboard['entries'][number]
export type PlayerProfile = NonNullable<
  FunctionReturnType<typeof api.players.getProfile>
>

export function sortFootballRoster(data: SeasonDashboard | null) {
  if (!data) return data
  return {
    ...data,
    entries: [...data.entries].sort((a, b) =>
      compareDisplayedSnaps(
        {
          name: a.player?.displayName ?? '',
          snaps: rosterParticipation(a.season).snaps,
        },
        {
          name: b.player?.displayName ?? '',
          snaps: rosterParticipation(b.season).snaps,
        },
      ),
    ),
  }
}

export function sortAdminFootballRoster(data: SeasonDashboard | null) {
  if (!data) return data
  return {
    ...data,
    entries: [...data.entries].sort((a, b) =>
      compareAdminRosterPlayers(
        {
          position: a.season.listedPosition,
          name: a.player?.displayName ?? '',
          tier: rosterGroup({
            enrollmentSeason: a.season.eligibilityEvidence.enrollmentSeason,
            role: a.season.role,
            season: data.season,
          }),
          snaps: rosterParticipation(a.season).snaps,
        },
        {
          position: b.season.listedPosition,
          name: b.player?.displayName ?? '',
          tier: rosterGroup({
            enrollmentSeason: b.season.eligibilityEvidence.enrollmentSeason,
            role: b.season.role,
            season: data.season,
          }),
          snaps: rosterParticipation(b.season).snaps,
        },
      ),
    ),
  }
}

export function useMichiganRoster(season: number) {
  return useQuery({
    ...convexQuery(api.rosters.getSeasonDashboard, {
      programKey: 'michigan',
      season,
    }),
    select: sortFootballRoster,
  })
}

export function useSeasonalStats(season: number) {
  return useQuery(
    convexQuery(api.seasonalStats.listBySeason, {
      programKey: 'michigan',
      season,
    }),
  )
}
