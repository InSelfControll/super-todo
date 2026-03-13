# Changelog

## [Unreleased] - 2025-03-12

### 🛡️ Super Todo - Major Updates

#### 🗑️ Project Removal & Task Management
- **New Mutation: `deleteProject`** - Permanently delete a project and ALL its tasks (both inProgress and completed)
- **New Mutation: `deleteProjectTasks`** - Delete all tasks for a specific project while keeping the project
- **New Mutation: `deleteAllInProgressTasks`** - NUKE option to delete ALL pending tasks globally
- **New Mutation: `removeDuplicateTasks`** - Find and remove duplicate tasks (same text for same project)
- **New MCP Tool: `remove_project`** - Permanently delete project with confirmation
- **New MCP Tool: `clear_project_tasks`** - Clear all tasks from a project
- **New MCP Tool: `remove_duplicate_tasks`** - Remove duplicate tasks via MCP

#### 📬 Discord/Telegram Notifications
- **Split messages by project** - Each project now gets its own message to avoid Discord 2000 char limit
- **5-second delay between messages** - Prevents rate limiting
- **Added `TELEGRAM_CHAT_ID` env var** - New preferred way to set Telegram chat ID (takes precedence over `GROUP_ID`)
- **Enhanced logging** - Added console logs for Telegram message sending
- **Removed message truncation** - All tasks now shown in full since each project has its own message

#### 🔧 Bug Fixes
- **Fixed database targeting** - All CLI commands now properly use `--prod` flag
- **Fixed `getEveningSummary`** - Now shows ALL projects (not filtering out projects with 0 tasks)
- **Fixed `inProgressTasks` queries** - Removed invalid `.eq("completed", false)` filters
- **Fixed `completedTasks` queries** - Changed from querying `inProgressTasks` to `completedTasks` table
- **Fixed schema issues** - Removed references to non-existent `by_completion` index

#### 📜 Justfile Updates
- **Added `sync-evening`** - Run evening sync on prod
- **Added `sync-morning`** - Run morning sync on prod
- **Added `clear-project-tasks PROJECT_ID`** - Clear tasks from specific project
- **Added `de-dupe`** - Find and remove duplicate tasks
- **Updated all commands** - Now use `--prod` flag by default

#### 📁 Files Changed
- `convex/daily.ts` - Message splitting, removed truncation
- `convex/notifications.ts` - TELEGRAM_CHAT_ID support, better logging
- `convex/projects.ts` - New deletion mutations, duplicate removal
- `convex/tasks.ts` - Helper queries
- `justfile` - New commands, prod flag fixes
- `src/convex/client.ts` - New client methods
- `src/mcp/server.ts` - New MCP tool handlers
- `src/mcp/tools.ts` - New tool definitions

### Migration Notes
1. Set `TELEGRAM_CHAT_ID` in Convex dashboard (your user ID, not bot ID)
2. Ensure `BOT_TOKEN` is set to actual bot token (format: `number:alphanumeric`)
3. Use `just sync-evening` and `just sync-morning` instead of raw convex commands
