import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../convex/_generated/api'
import type { FunctionReturnType } from 'convex/server'

export type SeasonDashboard = NonNullable<
  FunctionReturnType<typeof api.rosters.getSeasonDashboard>
>
export type RosterEntry = SeasonDashboard['entries'][number]
export type PlayerProfile = NonNullable<
  FunctionReturnType<typeof api.players.getProfile>
>

export function useMichiganRoster(season: number) {
  return useQuery(
    convexQuery(api.rosters.getSeasonDashboard, {
      programKey: 'michigan',
      season,
    }),
  )
}

export function useSeasonalStats(season: number) {
  return useQuery(
    convexQuery(api.seasonalStats.listBySeason, {
      programKey: 'michigan',
      season,
    }),
  )
}
