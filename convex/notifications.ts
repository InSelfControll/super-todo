import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * 🛡️ Notification System
 * 
 * Sends notifications to Discord and Telegram with:
 * - Discord: Push notifications (uses @mentions)
 * - Telegram: High priority (bypasses mute)
 * 
 * Environment variables from Convex dashboard:
 * - DISCORD_WEBHOOK: Discord webhook URL
 * - BOT_TOKEN: Telegram bot token
 * - GROUP_ID: Telegram group/chat ID
 * - USER_DISCORD_ID: Your Discord user ID for mentions (optional)
 * - USER_TELEGRAM_ID: Your Telegram user ID for priority messages (optional)
 */

// ============================================
// ENVIRONMENT VARIABLES
// ============================================

function getEnv(name: string): string | undefined {
  return process.env[name];
}

// ============================================
// DISCORD NOTIFICATIONS (with Push)
// ============================================

/**
 * Send notification to Discord webhook
 * Includes @mention for push notifications
 */
export const sendDiscordNotification = internalAction({
  args: { 
    content: v.string(),
    mentionUser: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const webhookUrl = getEnv("DISCORD_WEBHOOK");
    const userId = getEnv("USER_DISCORD_ID");
    
    if (!webhookUrl) {
      console.log("⚠️ DISCORD_WEBHOOK not configured");
      return { sent: false, reason: "webhook_not_configured" };
    }

    // Add mention for push notification if user ID configured
    let message = args.content;
    if (args.mentionUser && userId) {
      message = `<@${userId}> ${message}`;
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: message,
          username: "🛡️ Super Todo",
          avatar_url: "https://cdn.discordapp.com/embed/avatars/0.png",
          allowed_mentions: {
            users: userId ? [userId] : [],
          },
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Discord API error: ${response.status} - ${error}`);
      }

      return { sent: true, platform: "discord", mentioned: args.mentionUser && !!userId };
    } catch (error) {
      console.error("Failed to send Discord notification:", error);
      return { sent: false, reason: "api_error", error: String(error) };
    }
  },
});

// ============================================
// TELEGRAM NOTIFICATIONS (High Priority)
// ============================================

/**
 * Send notification to Telegram bot
 * Uses disable_notification: false for high priority
 * Optionally sends to user directly (bypasses group mute)
 */
export const sendTelegramNotification = internalAction({
  args: { 
    content: v.string(),
    highPriority: v.optional(v.boolean()),
    pinMessage: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const botToken = getEnv("BOT_TOKEN");
    // TELEGRAM_CHAT_ID takes precedence over GROUP_ID
    const chatId = getEnv("TELEGRAM_CHAT_ID") || getEnv("GROUP_ID");
    const userId = getEnv("USER_TELEGRAM_ID");

    if (!botToken) {
      console.log("⚠️ BOT_TOKEN not configured");
      return { sent: false, reason: "bot_token_missing" };
    }

    if (!chatId) {
      console.log("⚠️ Neither TELEGRAM_CHAT_ID nor GROUP_ID configured");
      return { sent: false, reason: "chat_id_missing" };
    }

    const results = [];

    // 1. Send to chat (if configured) - high priority mode
    if (chatId) {
      try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        console.log(`📨 Sending Telegram message to chat_id: ${chatId}`);
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: args.content,
            parse_mode: "Markdown",
            disable_notification: false,
            disable_web_page_preview: true,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Telegram message sent: ${data.result?.message_id}`);
          results.push({ platform: "telegram", sent: true, messageId: data.result?.message_id });

          // Pin message for high priority
          if (args.highPriority && args.pinMessage && data.result?.message_id) {
            const pinResponse = await fetch(`https://api.telegram.org/bot${botToken}/pinChatMessage`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: data.result.message_id,
                disable_notification: false,
              }),
            });
            if (!pinResponse.ok) {
              console.log(`⚠️ Failed to pin message: ${await pinResponse.text()}`);
            }
          }
        } else {
          const error = await response.text();
          console.log(`❌ Telegram send failed: ${error}`);
          results.push({ platform: "telegram", sent: false, error });
        }
      } catch (error) {
        console.log(`❌ Telegram exception: ${String(error)}`);
        results.push({ platform: "telegram", sent: false, error: String(error) });
      }
    }

    // 2. Send directly to user (bypasses group mute completely)
    if (userId && args.highPriority) {
      try {
        const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
        
        console.log(`📨 Sending direct Telegram message to user: ${userId}`);
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: userId,
            text: `🔔 **PRIORITY ALERT**\n\n${args.content}`,
            parse_mode: "Markdown",
            disable_notification: false,
          }),
        });

        if (response.ok) {
          console.log(`✅ Telegram direct message sent`);
          results.push({ platform: "telegram_direct", sent: true });
        } else {
          const error = await response.text();
          console.log(`❌ Telegram direct message failed: ${error}`);
          results.push({ platform: "telegram_direct", sent: false, error });
        }
      } catch (error) {
        console.log(`❌ Telegram direct exception: ${String(error)}`);
        results.push({ platform: "telegram_direct", sent: false, error: String(error) });
      }
    }

    const anySent = results.some((r) => r.sent);
    console.log(`📊 Telegram results: ${results.length} attempts, ${anySent ? 'SUCCESS' : 'FAILED'}`);
    
    return {
      sent: anySent,
      results,
    };
  },
});

// ============================================
// BROADCAST
// ============================================

/**
 * Broadcast notification to all configured channels
 */
export const broadcastNotification = internalAction({
  args: { 
    content: v.string(),
    mentionUser: v.optional(v.boolean()),
    highPriority: v.optional(v.boolean()),
    pinMessage: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const results = await Promise.all([
      ctx.runAction("notifications:sendDiscordNotification", { 
        content: args.content, 
        mentionUser: args.mentionUser 
      }),
      ctx.runAction("notifications:sendTelegramNotification", { 
        content: args.content, 
        highPriority: args.highPriority,
        pinMessage: args.pinMessage,
      }),
    ]);

    return {
      discord: results[0],
      telegram: results[1],
    };
  },
});

// ============================================
// PROJECT FAMILY NOTIFICATIONS (NEW)
// ============================================

/**
 * Notify about pending tasks for a project FAMILY (parent + subprojects)
 * Combines all tasks into ONE notification per project family
 */
export const notifyProjectFamily = internalAction({
  args: {
    projectName: v.string(),
    group: v.union(v.literal("important"), v.literal("hobbies")),
    totalPending: v.number(),
    tasks: v.array(v.string()),
    hasSubprojects: v.optional(v.boolean()),
    timeOfDay: v.union(v.literal("morning"), v.literal("evening")),
    isUrgent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const icon = args.timeOfDay === "morning" ? "🌅" : "🌆";
    const title = args.timeOfDay === "morning" ? "Morning Sync" : "Evening Sync";
    const groupEmoji = args.group === "important" ? "🔴" : "🔵";
    
    let content = `${icon} **${title}**\n`;
    content += `${groupEmoji} **${args.projectName}**`;
    if (args.hasSubprojects) {
      content += ` (with subprojects)`;
    }
    content += `\n`;
    content += `📝 **Pending Tasks:** ${args.totalPending}\n\n`;

    // Add task list
    if (args.tasks.length > 0) {
      content += args.tasks.map((t, i) => `  ${i + 1}. ${t}`).join("\n");
      content += "\n\n";
    }

    // Add motivational message
    if (args.timeOfDay === "morning") {
      content += "💪 *A 1% improvement each time is a big win.*";
    } else {
      content += "🎯 *Review your progress and plan for tomorrow.*";
    }

    // Broadcast with appropriate priority
    const result = await ctx.runAction("notifications:broadcastNotification", {
      content,
      mentionUser: args.isUrgent,
      highPriority: args.isUrgent,
      pinMessage: args.isUrgent && args.timeOfDay === "morning",
    });

    return {
      sent: result.discord.sent || result.telegram.sent,
      project: args.projectName,
      totalPending: args.totalPending,
      channels: result,
    };
  },
});

// ============================================
// LEGACY SINGLE PROJECT NOTIFICATIONS
// ============================================

/**
 * Notify about pending tasks for a specific project (legacy)
 * Used for morning (important only) and evening (all projects) sync
 */
export const notifyProjectTasks = internalAction({
  args: {
    projectName: v.string(),
    group: v.union(v.literal("important"), v.literal("hobbies")),
    pendingCount: v.number(),
    pendingTasks: v.array(v.string()),
    timeOfDay: v.union(v.literal("morning"), v.literal("evening")),
    isUrgent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Build message based on time of day
    const icon = args.timeOfDay === "morning" ? "🌅" : "🌆";
    const title = args.timeOfDay === "morning" ? "Morning Sync" : "Evening Sync";
    const groupEmoji = args.group === "important" ? "🔴" : "🔵";
    
    let content = `${icon} **${title}**\n`;
    content += `${groupEmoji} **${args.projectName}**\n`;
    content += `📝 **Pending Tasks:** ${args.pendingCount}\n\n`;

    // Add task list
    if (args.pendingTasks.length > 0) {
      content += args.pendingTasks.map((t, i) => `  ${i + 1}. ${t}`).join("\n");
      content += "\n\n";
    }

    // Add motivational message
    if (args.timeOfDay === "morning") {
      content += "💪 *A 1% improvement each time is a big win.*";
    } else {
      content += "🎯 *Review your progress and plan for tomorrow.*";
    }

    // Broadcast with appropriate priority
    const result = await ctx.runAction("notifications:broadcastNotification", {
      content,
      mentionUser: args.isUrgent, // Mention for urgent/important
      highPriority: args.isUrgent, // High priority for urgent
      pinMessage: args.isUrgent && args.timeOfDay === "morning", // Pin morning important
    });

    return {
      sent: result.discord.sent || result.telegram.sent,
      project: args.projectName,
      pendingCount: args.pendingCount,
      channels: result,
    };
  },
});

// ============================================
// TEMPLATES (Legacy Support)
// ============================================

/**
 * Task completion notification
 */
export const notifyTaskCompleted = internalAction({
  args: {
    taskText: v.string(),
    projectName: v.string(),
  },
  handler: async (ctx, args) => {
    const content = `✅ **Completed:** "${args.taskText}"\n📁 **Project:** ${args.projectName}`;
    return await ctx.runAction("notifications:broadcastNotification", { content });
  },
});

/**
 * Morning sync notification (legacy single project)
 */
export const notifyMorningSync = internalAction({
  args: {
    projectName: v.string(),
    pendingCount: v.number(),
  },
  handler: async (ctx, args) => {
    const content = `🌅 **Morning Sync**\n📁 **Project:** ${args.projectName}\n📝 **Pending Tasks:** ${args.pendingCount}\n\n*Remember: A 1% improvement each time is a big win.*`;
    return await ctx.runAction("notifications:broadcastNotification", { 
      content,
      mentionUser: true,
      highPriority: true,
    });
  },
});

/**
 * Evening Victory Lap notification
 */
export const notifyEveningReport = internalAction({
  args: {
    completedCount: v.number(),
    completedTasks: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    let content = `🏆 **Victory Lap - Evening Report**\n`;
    content += `✅ **Tasks Completed Today:** ${args.completedCount}\n\n`;
    
    if (args.completedTasks.length > 0) {
      content += args.completedTasks.map((t) => `  • ${t}`).join("\n");
      content += "\n\n";
    }
    
    content += "🎉 *Great job! Every 1% adds up to 100%.*";

    return await ctx.runAction("notifications:broadcastNotification", { content });
  },
});

/**
 * Project created notification
 */
export const notifyProjectCreated = internalAction({
  args: {
    projectName: v.string(),
    group: v.string(),
  },
  handler: async (ctx, args) => {
    const content = `🆕 **New Project Created**\n📁 **Name:** ${args.projectName}\n🏷️ **Group:** ${args.group}`;
    return await ctx.runAction("notifications:broadcastNotification", { content });
  },
});

// ============================================
// ENVIRONMENT SETUP HELPERS
// ============================================

/**
 * Test all notification channels
 */
export const testNotifications = internalAction({
  args: {},
  handler: async (ctx) => {
    const testMessage = "🧪 **Test Notification**\nIf you see this, notifications are working!";
    
    const result = await ctx.runAction("notifications:broadcastNotification", {
      content: testMessage,
      mentionUser: true,
      highPriority: true,
    });

    return {
      message: "Test notification sent",
      result,
      config: {
        discord: !!getEnv("DISCORD_WEBHOOK"),
        discordUserId: !!getEnv("USER_DISCORD_ID"),
        telegramBot: !!getEnv("BOT_TOKEN"),
        telegramChatId: !!getEnv("TELEGRAM_CHAT_ID"),
        telegramGroupId: !!getEnv("GROUP_ID"),
        telegramUserId: !!getEnv("USER_TELEGRAM_ID"),
      },
    };
  },
});
