import { convexQuery } from '@convex-dev/react-query'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../convex/_generated/api'
import type { TeamSport } from '../../../convex/teamRosterFields'
import type { ScheduleState } from './teamSeasonModel'

export function useTeamSchedule(
  sport: TeamSport,
  season: number,
): ScheduleState {
  const hockey = useQuery(
    convexQuery(
      api.hockeySchedules.list,
      sport === 'hockey' ? { season } : 'skip',
    ),
  )
  const basketball = useQuery(
    convexQuery(
      api.basketballSchedules.list,
      sport === 'basketball' ? { season } : 'skip',
    ),
  )
  return sport === 'hockey' ? hockey : basketball
}
