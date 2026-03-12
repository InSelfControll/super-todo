import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * 🧪 Test Notifications
 * 
 * Manual test functions for Discord/Telegram notifications.
 * Run these from Convex dashboard to verify webhooks are working.
 */

/**
 * Test Discord webhook directly
 */
export const testDiscord = action({
  args: {
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const content = args.message || "🧪 Test message from Super Todo MCP";
    
    const result = await ctx.runAction("notifications:sendDiscordNotification", {
      content,
    });
    
    return {
      tested: "discord",
      result,
      envCheck: {
        DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK ? "✅ Set" : "❌ Not set",
      }
    };
  },
});

/**
 * Test Telegram bot directly
 */
export const testTelegram = action({
  args: {
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const content = args.message || "🧪 Test message from Super Todo MCP";
    
    const result = await ctx.runAction("notifications:sendTelegramNotification", {
      content,
    });
    
    return {
      tested: "telegram",
      result,
      envCheck: {
        BOT_TOKEN: process.env.BOT_TOKEN ? "✅ Set" : "❌ Not set",
        GROUP_ID: process.env.GROUP_ID ? `✅ Set (${process.env.GROUP_ID})` : "❌ Not set",
      }
    };
  },
});

/**
 * Test both notifications
 */
export const testAll = action({
  args: {
    message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const content = args.message || "🧪 Test broadcast from Super Todo MCP";
    
    const results = await ctx.runAction("notifications:broadcastNotification", {
      content,
    });
    
    return {
      tested: "all",
      results,
      envSummary: {
        DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK ? "✅" : "❌",
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? "✅" : "❌",
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? "✅" : "❌",
      },
      message: "Check your Discord/Telegram for test messages!"
    };
  },
});

/**
 * Check environment variables
 */
export const checkEnv = action({
  args: {},
  handler: async () => {
    return {
      environment: {
        DISCORD_WEBHOOK: process.env.DISCORD_WEBHOOK 
          ? `✅ Set (${process.env.DISCORD_WEBHOOK.substring(0, 30)}...)` 
          : "❌ Not configured",
        BOT_TOKEN: process.env.BOT_TOKEN 
          ? `✅ Set (${process.env.BOT_TOKEN.substring(0, 10)}...)` 
          : "❌ Not configured",
        GROUP_ID: process.env.GROUP_ID 
          ? `✅ Set (${process.env.GROUP_ID})` 
          : "❌ Not configured",
      },
      instructions: "Set these in Convex Dashboard > Settings > Environment Variables: DISCORD_WEBHOOK, BOT_TOKEN, GROUP_ID"
    };
  },
});
