import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Run once daily at 12:00 UTC (noon)
crons.daily(
  'scheduled-arena-game',
  { hourUTC: 12, minuteUTC: 0 },
  internal.arenaScheduler.startScheduledGame,
)

export default crons
