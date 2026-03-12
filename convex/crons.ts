/**
 * 🕐 Scheduled Cron Jobs - Jerusalem Time
 * 
 * NOTE: This file defines scheduled jobs using Convex's cron system.
 * Cron jobs run automatically based on UTC time.
 * 
 * Jerusalem: UTC+2 (winter) / UTC+3 (summer)
 * 
 * MORNING: 8:00 AM Jerusalem → 6:00 AM UTC (winter)
 * EVENING: 7:00 PM Jerusalem → 5:00 PM UTC (winter)
 */

import { cronJobs } from "convex/server";

export default cronJobs({
  // 🌅 Morning Sync - 8:00 AM Jerusalem (6:00 AM UTC winter)
  morningSync: {
    cron: "0 6 * * *",
    function: "daily:scheduledMorningSync",
    args: {},
  },

  // 🌆 Evening Sync - 7:00 PM Jerusalem (5:00 PM UTC winter)
  eveningSync: {
    cron: "0 17 * * *",
    function: "daily:scheduledEveningSync",
    args: {},
  },
});

/**
 * Summer Schedule (Mar-Oct) - Update when needed:
 * - Morning: "0 5 * * *" (5:00 AM UTC = 8:00 AM Jerusalem summer)
 * - Evening: "0 16 * * *" (4:00 PM UTC = 7:00 PM Jerusalem summer)
 */
