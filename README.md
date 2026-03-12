# 🛡️ Super Todo MCP

> *A 1% improvement each time is a big win.*

The Ultimate TODO MCP (Model Context Protocol) server with Convex backend. Features intelligent task auto-completion, the "Three-Project Gatekeeper" for focus management, and daily sync cycles with Discord/Telegram notifications.

## ✨ Features

- 🤖 **AI Auto-Complete** - Detects completed tasks from conversation
- 🛡️ **Three-Project Gatekeeper** - Enforces maximum 3 important projects
- 📈 **Daily Sync Cycles** - Morning task lists & evening Victory Lap reports
- 🔔 **Notifications** - Discord & Telegram webhook integration
- 📝 **Obsidian-Ready** - Markdown formatted task lists
- ⚡ **Real-time** - Convex backend for instant sync
- 🐳 **Containerized** - Multi-arch Docker support (x86_64 + ARM64)
- ⚡ **Bun-Powered** - Fast TypeScript runtime

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) 1.0+ installed
- Convex account (free tier works)
- (Optional) Docker for containerization

### 1. Install Dependencies

```bash
bun install
```

### 2. Set up Convex

```bash
bunx convex dev
```

This will:
- Create a Convex project
- Deploy the schema and functions
- Generate the client code

### 3. Configure Environment Variables

#### For MCP Server & CLI (local `.env` file):

```bash
cp .env.example .env
```

Edit `.env` with your Convex URL:

```env
CONVEX_URL=https://your-deployment.convex.cloud
```

#### For Notifications (Convex Dashboard):

Webhooks for scheduled notifications must be set in **Convex Dashboard**:

1. Go to: https://dashboard.convex.dev
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the following:

```
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_ID=your-chat-id
```

⚠️ **Important**: Notifications from scheduled actions (morning/evening reports) 
read env vars from Convex dashboard, not your local `.env` file.

### 4. Choose Your Deployment Mode

#### Option A: Local (stdio) - Default
Best for local development with Kimi Code CLI:

```bash
bun run dev
```

#### Option B: Remote (SSE) - For Remote Servers
Run on a remote server and connect via HTTP:

```bash
# On your remote server
MCP_TRANSPORT=sse MCP_PORT=3000 bun run dev

# Or with Docker
MCP_TRANSPORT=sse MCP_PORT=3000 just container-run
```

Then connect from your local machine via SSE transport.

### 4. Run MCP Server

```bash
bun run dev
```

## 🐳 Container Usage

### Build & Run Locally

```bash
# Using Just (recommended)
just container-build
just container-run

# Using Docker directly
docker build -t super-todo-mcp:latest .
docker run --rm -it --env-file .env super-todo-mcp:latest
```

### Run on Remote Server (SSE Mode)

```bash
# Run with SSE transport for remote access
docker run -d \
  --name super-todo \
  -p 3000:3000 \
  -e MCP_TRANSPORT=sse \
  -e MCP_PORT=3000 \
  -e CONVEX_URL=https://your-deployment.convex.cloud \
  super-todo-mcp:latest

# Check health
curl http://your-server:3000/health
```

### Multi-Arch Build (x86_64 + ARM64)

```bash
# Build and push to registry
just container-build-push

# Or manually with docker buildx
docker buildx create --use --name super-todo-builder
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t super-todo-mcp:latest \
  --push .
docker buildx rm super-todo-builder
```

### Docker Compose

```bash
# Start the MCP server
docker-compose up -d

# Run CLI commands
docker-compose --profile cli run --rm super-todo-cli morning
docker-compose --profile cli run --rm super-todo-cli evening
```

## 🔌 MCP Integration (Kimi Code CLI)

### Local Mode (stdio)

Add to your `.kimi/mcp.json`:

```json
{
  "mcpServers": {
    "super-todo": {
      "command": "bun",
      "args": ["/path/to/super-todo/src/index.ts"],
      "env": {
        "CONVEX_URL": "https://your-deployment.convex.cloud"
      }
    }
  }
}
```

Or using the container:

```json
{
  "mcpServers": {
    "super-todo": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "--env-file",
        "/path/to/super-todo/.env",
        "super-todo-mcp:latest"
      ]
    }
  }
}
```

### Remote Mode (SSE)

If you run the MCP server on a remote server:

**On Remote Server:**
```bash
docker run -d \
  --name super-todo \
  -p 3000:3000 \
  -e MCP_TRANSPORT=sse \
  -e MCP_PORT=3000 \
  -e CONVEX_URL=https://your-deployment.convex.cloud \
  super-todo-mcp:latest
```

**Local Kimi Config:**

Kimi Code CLI currently doesn't support SSE transport natively, but you can use:

1. **SSH Tunnel** (recommended):
   ```bash
   ssh -L 3000:localhost:3000 your-remote-server
   # Then configure Kimi to use stdio with a local proxy
   ```

2. **Proxy with stdio-to-SSE bridge**:
   ```json
   {
     "mcpServers": {
       "super-todo": {
         "command": "npx",
         "args": [
           "-y",
           "@modelcontextprotocol/sse-proxy",
           "http://your-remote-server:3000/sse"
         ]
       }
     }
   }
   ```

## 🛠️ Available Tools

| Tool | Description |
|------|-------------|
| `get_projects` | List all projects with optional group filter |
| `add_project` | Create project (enforces 3-project limit) |
| `archive_project` | Soft-delete a project |
| `get_tasks` | List tasks for a project |
| `add_task` | Add a task to a project |
| `complete_task` | Mark a task as completed |
| `sync_completed_tasks` | 🤖 AI auto-complete from conversation |
| `bulk_add_tasks` | Add multiple tasks at once |
| `daily_report` | 🏆 Victory Lap report |
| `get_project_stats` | Show project statistics |

## 💻 CLI Usage

```bash
# Using Bun (recommended)
bun cli morning                   # 🌅 Morning sync
bun cli evening                   # 🏆 Victory Lap
bun cli projects --group important
bun cli tasks <project-id> --filter pending
bun cli add-project "My Project" --group important
bun cli add-task <project-id> "Fix the bug"
bun cli complete <task-id>

# Or with Just
just cli morning
just cli evening
just cli projects
```

## 🎛️ Just Commands

```bash
just install          # Install dependencies
just dev              # Run dev server with watch
just build            # Build for production
just check            # Type check
just container-build  # Build container
just container-run    # Run container locally
just container-build-push  # Build & push multi-arch
just convex-dev       # Start Convex dev
just clean            # Clean build artifacts
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐
│   MCP Server    │◄──►│  Convex Client  │◄──►│   Convex Cloud (Backend)│
│   (stdio/sse)   │    │   (HTTP API)    │    │   - projects table      │
│                 │    │                 │    │   - tasks table         │
│  Tools:         │    │                 │    │   - mutations/queries   │
│  - getProjects  │    │                 │    │   - scheduled actions   │
│  - addProject   │    │                 │    │                         │
│  - getTasks     │    │                 │    │   Webhooks:             │
│  - addTask      │    │                 │    │   - Discord             │
│  - completeTask │    │                 │    │   - Telegram            │
│  - dailyReport  │    │                 │    │                         │
└─────────────────┘    └─────────────────┘    └─────────────────────────┘
         │                                                  ▲
         │ stdio                                            │
         ▼                                                  │
┌───────────────────────────────────────────────────────────┘│
│                   🐳 Docker Container                       │
│              (Multi-arch: x86_64, ARM64)                    │
│                    Bun Runtime 1.0+                         │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
super-todo-mcp/
├── convex/
│   ├── schema.ts          # Database schema
│   ├── projects.ts        # Project operations
│   ├── tasks.ts           # Task operations & auto-complete
│   ├── notifications.ts   # Webhook notifications
│   └── daily.ts           # Scheduled daily actions
├── src/
│   ├── mcp/
│   │   ├── server.ts      # MCP server setup
│   │   ├── tools.ts       # Tool definitions
│   │   └── prompts.ts     # AI behavior prompts
│   ├── convex/
│   │   └── client.ts      # Typed Convex client
│   ├── cli/
│   │   └── index.ts       # CLI commands
│   └── index.ts           # Entry point
├── .kimi/mcp.example.json # Kimi Code CLI config
├── Dockerfile             # Multi-arch container
├── docker-compose.yml     # Compose configuration
├── justfile               # Task runner
├── .env.example           # Environment template
├── README.md              # This file
└── package.json
```

## 🛡️ The Three-Project Gatekeeper

To maintain focus, only **3 projects** are allowed in the `[IMPORTANT]` group.

When you try to create a 4th important project:

```
🛡️ GATEKEEPER BLOCKED: You already have 3 important projects.
Archive one before adding a new important project.
```

To add a new important project:
1. Archive an existing project, OR
2. Add as `[HOBBIES]` instead

## 🤖 AI Auto-Complete

The MCP scans your messages for completion indicators:

```
User: "I just fixed the login bug"
→ Calls sync_completed_tasks
→ Marks "Fix login bug" task as complete
→ Response: "✅ Auto-completed: 'Fix login bug' - 1% win!"
```

Detected phrases:
- "done with [task]"
- "finished [task]"
- "completed [task]"
- "fixed [task]"
- "implemented [task]"

## 🔔 Notifications

Configure webhooks for **Discord** (push notifications) and **Telegram** (priority alerts):

### Discord Setup
1. Server Settings → Integrations → Webhooks → New Webhook
2. Copy webhook URL → set as `DISCORD_WEBHOOK`
3. (Optional) Get your User ID → set as `USER_DISCORD_ID` for @mentions

### Telegram Setup
1. Message [@BotFather](https://t.me/botfather) → `/newbot` → copy token
2. Add bot to your group
3. Message [@getidsbot](https://t.me/getidsbot) in the group → copy `group_id`
4. (Optional) Message [@userinfobot](https://t.me/userinfobot) → copy your ID for priority DMs

### Notification Types
| Event | Discord | Telegram |
|-------|---------|----------|
| Task completed | ✅ | ✅ |
| Morning sync (Important) | 🔴 Push + @mention | 🔴 High priority + pin |
| Morning sync (Hobbies) | - | - |
| Evening sync (All) | 🟡 Push (Important only) | 🟡 Priority (Important only) |
| New project created | ✅ | ✅ |

## 🌅 Daily Sync Cycles

### Morning Sync (8:00 AM UTC) - IMPORTANT Only
**Sends separate message per Important project** with pending tasks:

```
🌅 Morning Sync
🔴 DNS-Fabric / Backend
📝 Pending Tasks: 3

1. Review Convex schema
2. Check queries and mutations
3. Test Convex functions

💪 A 1% improvement each time is a big win.
```

- 🔴 **Important projects**: Discord @mention + Telegram priority + pin
- 🔵 **Hobbies**: No morning notification (focus on important work!)

### Evening Sync (6:00 PM UTC) - ALL Projects
**Sends separate message per ALL projects** (Important + Hobbies):

```
🌆 Evening Sync
🔴 DNS-Fabric / Frontend
📝 Pending Tasks: 5

1. Setup React components
2. Build UI layout
...

🎯 Review your progress and plan for tomorrow.
```

```
🌆 Evening Sync
🔵 Hobby Project
📝 Pending Tasks: 2

1. Practice guitar scales
2. Read chapter 3

🎯 Review your progress and plan for tomorrow.
```

- 🔴 **Important**: Discord @mention + Telegram priority
- 🔵 **Hobbies**: Normal notification

### Victory Lap (Optional)
Run manually for a daily completion summary:
```
🏆 Victory Lap - Evening Report
✅ Tasks Completed Today: 3

• Fixed login bug
• Updated documentation
• Refactored API

🎉 Every 1% adds up to 100%.
```

## ⏰ Setting Up Scheduled Notifications

Cron jobs are automatically configured via `convex/crons.ts`. They run at:

| Schedule | Jerusalem Time | UTC (Winter) | Function |
|----------|----------------|--------------|----------|
| 🌅 Morning | 8:00 AM | `0 6 * * *` | `daily:scheduledMorningSync` |
| 🌆 Evening | 7:00 PM | `0 17 * * *` | `daily:scheduledEveningSync` |

> 🌍 **Timezone Note:** Israel is UTC+2 (winter) / UTC+3 (summer). Adjust cron in `convex/crons.ts` by 1 hour when daylight saving changes (March/October).

### 1. Set Environment Variables (Convex Dashboard)

Go to [Convex Dashboard](https://dashboard.convex.dev) → Your Project → Settings → Environment Variables:

```
DISCORD_WEBHOOK=https://discord.com/api/webhooks/...
USER_DISCORD_ID=123456789012345678      # For @mentions
BOT_TOKEN=your-telegram-bot-token
GROUP_ID=-1001234567890                 # Your group ID
USER_TELEGRAM_ID=123456789              # For priority DMs
```

### 2. Verify Crons Are Registered

After deploying, crons are automatically registered. To verify:

```bash
# Check crons configuration
just crons-verify

# Open dashboard to see registered schedules
just dashboard
# Then click "Schedules" in the left sidebar
```

### 3. Test Notifications

```bash
# Test morning sync manually
just crons-test-dev        # Dev environment
just crons-test-prod       # Production

# Test all notification channels
just test-notifications
```

## 🚀 Dev → Production Migration

### Automatic Migration (Recommended)

One command to migrate **everything** from dev to production:

```bash
just migrate-prod
```

This will automatically:
1. ✅ Run type checks
2. ✅ Generate Convex code
3. ✅ **Copy environment variables from DEV to PROD**
4. ✅ **Export data from DEV**
5. ✅ Deploy to production
6. ✅ **Import data to PROD**
7. ✅ Verify crons are registered

> ⚠️ **Warning:** This will overwrite PRODUCTION data with DEV data!

### Partial Migrations

Migrate only specific parts:

```bash
# Copy only environment variables
just migrate-env-only

# Copy only data (export dev, import prod)
just migrate-data-only

# Deploy without data/env migration
just convex-deploy
```

### Environment Variables Copied

| Variable | Purpose | Required |
|----------|---------|----------|
| `DISCORD_WEBHOOK` | Discord notifications | ✅ |
| `USER_DISCORD_ID` | Discord @mentions | ❌ |
| `BOT_TOKEN` | Telegram bot token | ✅ |
| `GROUP_ID` | Telegram group ID | ✅ |
| `USER_TELEGRAM_ID` | Telegram priority DMs | ❌ |

### Verify Migration Success

```bash
# Compare DEV vs PROD env vars
just env-list-all

# Check only PROD env vars
just env-check-prod

# Test notifications in production
just prod-test-notifications

# Open production dashboard
just dashboard-prod
```

## 📝 Output Format

Tasks are formatted as Obsidian-ready Markdown:

```markdown
- [ ] Task 1
- [x] Task 2 (completed)
- [ ] Task 3 🤖 (auto-generated)
```

## 🔧 Environment Variables

### For MCP Server & CLI (local `.env`):

| Variable | Required | Description |
|----------|----------|-------------|
| `CONVEX_URL` | ✅ | Your Convex deployment URL |
| `CONVEX_DEPLOY_KEY` | ❌ | For CI/CD deployments |
| `MCP_TRANSPORT` | ❌ | `stdio` (default) or `sse` for remote |
| `MCP_HOST` | ❌ | HTTP host for SSE mode (default: `0.0.0.0`) |
| `MCP_PORT` | ❌ | HTTP port for SSE mode (default: `3000`) |
| `MCP_SERVER_NAME` | ❌ | Server name (default: `super-todo`) |

### For Notifications (Convex Dashboard):

These must be set in Convex Dashboard → Settings → Environment Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `DISCORD_WEBHOOK` | ❌ | Discord webhook URL |
| `USER_DISCORD_ID` | ❌ | Your Discord user ID (for @mentions / push) |
| `BOT_TOKEN` | ❌ | Telegram bot token |
| `GROUP_ID` | ❌ | Telegram group/chat ID |
| `USER_TELEGRAM_ID` | ❌ | Your Telegram user ID (priority DMs) |

> 💡 **Why two places?** The MCP server and CLI run locally and need `CONVEX_URL`. 
> But scheduled notifications (morning/evening reports) run on Convex servers 
> and read webhooks from the dashboard env vars.

## 💾 Data Management

### Export/Import Data

```bash
# Export DEV data
just export-dev

# Export PROD data (backup)
just export-prod

# Import data to DEV
just import-dev export-file.zip

# Import data to PROD (⚠️ overwrites production!)
just import-prod export-file.zip
```

> ⚠️ **Note:** Import uses `--replace` mode which overwrites existing tables. This is intentional for full migration workflows.

### Data Migration Workflow

```bash
# Full DEV → PROD migration (env vars + data)
# ⚠️ This will REPLACE all PROD data with DEV data!
just migrate-prod

# Or step by step:
just migrate-env-only     # Copy env vars only
just migrate-data-only    # Copy data only (replaces existing)
```

## 🐛 Troubleshooting

### Cron Jobs Not Running

**Problem:** Notifications not sending at scheduled times.

**Checklist:**

1. **Verify crons.ts exists and uses correct API:**
   ```bash
   cat convex/crons.ts
   ```
   
   Should use `crons.cron()` method:
   ```typescript
   const crons = cronJobs();
   crons.cron("morning-sync", "0 6 * * *", internal.daily.scheduledMorningSync, {});
   export default crons;
   ```

2. **Check Convex Dashboard:**
   - Go to https://dashboard.convex.dev
   - Select your project
   - Click **"Schedules"** in left sidebar
   - You should see `morning-sync` and `evening-sync`

3. **Test manually:**
   ```bash
   just crons-test-dev     # Should send notification immediately
   ```

4. **Check environment variables:**
   ```bash
   just env-check-prod     # For production
   ```

5. **Check logs:**
   ```bash
   just convex-logs-prod   # See if crons are triggering
   ```

**Common Issues:**

| Issue | Fix |
|-------|-----|
| No Schedules tab in dashboard | Crons auto-register on deploy. Run `just convex-deploy` |
| Cron runs but no notification | Check env vars in dashboard (DISCORD_WEBHOOK, BOT_TOKEN) |
| Wrong timezone | Update `convex/crons.ts` cron expression |
| Prod not working but dev works | Set env vars in PROD dashboard separately |
| `internal is not defined` error | Make sure to import `internal` from `_generated/api` |

## 🐳 Docker Details

The Dockerfile uses multi-stage builds:

1. **Builder stage**: Uses `oven/bun:1-alpine` to install deps and build
2. **Production stage**: Minimal image with only runtime artifacts
3. **CLI stage**: Same as production but with CLI entrypoint

Security features:
- Non-root user (`super-todo:1000`)
- Minimal Alpine base image
- Security updates applied
- `dumb-init` for proper signal handling

Multi-arch support:
- `linux/amd64` (x86_64)
- `linux/arm64` (Apple Silicon, AWS Graviton, etc.)

## 📜 License

MIT

---

<p align="center">
  <i>📈 A 1% improvement each time is a big win.</i>
</p>
