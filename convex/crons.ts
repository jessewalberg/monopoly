import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every hour at minute 0
crons.hourly(
  "scheduled-arena-game",
  { minuteUTC: 0 },
  internal.arenaScheduler.startScheduledGame
);

export default crons;
