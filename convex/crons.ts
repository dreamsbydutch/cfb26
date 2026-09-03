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

crons.daily(
  'refresh CFB26 Power and Resume ratings',
  { hourUTC: 11, minuteUTC: 47 },
  internal.ratings.refreshCurrentPowerRatings,
)

crons.weekly(
  'publish official weekly CFB26 ratings',
  { dayOfWeek: 'monday', hourUTC: 12, minuteUTC: 17 },
  internal.ratings.publishCurrentWeeklyRatings,
)

export default crons
