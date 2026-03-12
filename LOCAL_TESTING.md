# 🧪 Local Testing Guide

Quick guide for testing Super Todo MCP locally.

## Prerequisites

```bash
# 1. Install Bun (if not already installed)
curl -fsSL https://bun.sh/install | bash

# 2. Install dependencies
bun install

# 3. Ensure Convex is deployed
bunx convex deploy --yes
```

## Configuration

Create `.env` file:

```bash
CONVEX_URL=https://efficient-sheep-998.convex.cloud
```

## Testing Methods

### Method 1: Test CLI Commands

```bash
# List projects
bun cli projects

# Add a hobby project (no gatekeeper limit)
bun cli add-project "Learn Rust" --group hobbies

# Try to add important projects (test gatekeeper)
bun cli add-project "Project A" --group important
bun cli add-project "Project B" --group important  
bun cli add-project "Project C" --group important

# This should fail (gatekeeper blocks 4th important project)
bun cli add-project "Project D" --group important

# Get tasks for a project (replace with actual project ID)
bun cli tasks <project-id>

# Add tasks
bun cli add-task <project-id> "Setup project structure"
bun cli add-task <project-id> "Write tests"

# Complete a task
bun cli complete <task-id>

# View stats
bun cli stats

# Victory lap report
bun cli evening
```

### Method 2: Test MCP Server (stdio mode)

```bash
# Start MCP server
bun run dev

# The server will start and wait for stdio input
# Press Ctrl+C to stop
```

To actually test the MCP tools, you need to connect it to Kimi Code CLI.

### Method 3: Test with Kimi Code CLI

1. **Configure Kimi:**

Create `.kimi/mcp.json`:

```json
{
  "mcpServers": {
    "super-todo": {
      "command": "bun",
      "args": ["/path/to/super-todo/src/index.ts"],
      "env": {
        "CONVEX_URL": "https://efficient-sheep-998.convex.cloud"
      }
    }
  }
}
```

2. **Restart Kimi Code CLI** to load the MCP

3. **Test in Kimi:**

```
You: Show me my projects
→ Should list projects from Convex

You: Create a new important project called "Auth System"
→ Should create or show gatekeeper error

You: I just finished setting up the database
→ Should auto-complete matching task
```

### Method 4: Test SSE Mode Locally

```bash
# Terminal 1: Start SSE server
MCP_TRANSPORT=sse MCP_PORT=3000 bun run dev

# Terminal 2: Test health endpoint
curl http://localhost:3000/health

# Expected output:
# {"status":"ok","server":"super-todo","version":"1.0.0",...}
```

## Quick Test Checklist

| Test | Command | Expected Result |
|------|---------|-----------------|
| Install | `bun install` | Dependencies installed |
| Type check | `bun typecheck` | No errors |
| CLI help | `bun cli help` | Shows usage |
| List projects | `bun cli projects` | Lists projects (empty or existing) |
| Gatekeeper | Add 4th important project | Error: "GATEKEEPER BLOCKED" |
| Add task | `bun cli add-task ...` | Task created |
| Complete task | `bun cli complete ...` | Task marked done |
| Daily report | `bun cli evening` | Shows Victory Lap |
| MCP server | `bun run dev` | Starts without errors |
| SSE mode | `MCP_TRANSPORT=sse ...` | Health check returns 200 |

## Debugging

### Check Convex Connection

```bash
curl https://efficient-sheep-998.convex.cloud/api/version
```

### View Convex Data

Go to: https://dashboard.convex.dev/d/grand-sturgeon-25/data

### Reset Test Data

```bash
# Archive all projects
bun cli projects | grep "\[" | while read line; do
  id=$(echo $line | grep -oP '\[\K[^\]]+')
  bun cli archive-project $id
done
```

Or use Convex dashboard to manually delete.

### Common Issues

1. **"CONVEX_URL not set"**
   - Check `.env` file exists
   - Run `source .env` or restart terminal

2. **"Cannot resolve convex/server"**
   - Run `bun install` again
   - Check `node_modules/convex` exists

3. **MCP not showing in Kimi**
   - Check `.kimi/mcp.json` syntax
   - Restart Kimi Code CLI
   - Check Kimi logs for errors
