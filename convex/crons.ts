import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.daily(
  'refresh team-level football data',
  { hourUTC: 10, minuteUTC: 17 },
  internal.teamData.syncAll,
)

crons.daily(
  'refresh current college football games',
  { hourUTC: 11, minuteUTC: 17 },
  internal.games.syncCurrentSeason,
)

export default crons
