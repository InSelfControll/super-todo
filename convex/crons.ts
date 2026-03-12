/**
 * 🕐 Scheduled Cron Jobs - Jerusalem Time
 * 
 * Jerusalem: UTC+2 (winter) / UTC+3 (summer)
 * 
 * MORNING: 8:00 AM Jerusalem → 6:00 AM UTC (winter)
 * EVENING: 7:00 PM Jerusalem → 5:00 PM UTC (winter)
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// 🌅 Morning Sync - 8:00 AM Jerusalem (6:00 AM UTC winter)
crons.cron(
  "morning-sync",
  "0 6 * * *", // 6:00 AM UTC = 8:00 AM Jerusalem (winter)
  internal.daily.scheduledMorningSync,
  {}
);

// 🌆 Evening Sync - 7:00 PM Jerusalem (5:00 PM UTC winter)
crons.cron(
  "evening-sync",
  "0 17 * * *", // 5:00 PM UTC = 7:00 PM Jerusalem (winter)
  internal.daily.scheduledEveningSync,
  {}
);

export default crons;

/**
 * Summer Schedule (Mar-Oct) - Update when needed:
 * - Morning: "0 5 * * *" (5:00 AM UTC = 8:00 AM Jerusalem summer)
 * - Evening: "0 16 * * *" (4:00 PM UTC = 7:00 PM Jerusalem summer)
 * 
 * To use summer schedule, change the cron expressions above:
 * crons.cron("morning-sync", "0 5 * * *", internal.daily.scheduledMorningSync, {});
 * crons.cron("evening-sync", "0 16 * * *", internal.daily.scheduledEveningSync, {});
 */
