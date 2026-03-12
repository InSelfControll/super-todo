# 🔧 Kimi MCP Troubleshooting Guide

## Quick Checklist

### 1. Verify mcp.json Location

The file must be at `~/.kimi/mcp.json` (your home directory, not project directory):

```bash
# Check if file exists in correct location
ls -la ~/.kimi/mcp.json

# If not, create it:
mkdir -p ~/.kimi
cat > ~/.kimi/mcp.json << 'EOF'
{
  "mcpServers": {
    "super-todo": {
      "command": "bun",
      "args": [
        "/home/ofir/Desktop/things/github/private-todolist/src/index.ts"
      ],
      "env": {
        "CONVEX_URL": "https://efficient-sheep-998.convex.cloud"
      }
    }
  }
}
EOF
```

### 2. Test MCP Server Manually

```bash
# Test if the server starts correctly
cd /home/ofir/Desktop/things/github/private-todolist
bun src/index.ts

# Should output:
# 🛡️ Super Todo MCP Server running on stdio
# 📡 Connected to Convex at: https://...
# Press Ctrl+C to stop
```

If you get errors, check:
- `bun --version` works
- `bun install` was run
- `.env` file exists with `CONVEX_URL`

### 3. Restart Kimi Code CLI

After any mcp.json changes, **completely restart** Kimi Code CLI:

```bash
# Exit Kimi completely
# Then restart:
kimi
```

### 4. Verify in Kimi

Once restarted, check if MCP is loaded:

```
# In Kimi chat, type:/mcp

# Or look for the MCP tools indicator in the UI
```

You should see `super-todo` in the list.

## Common Issues & Fixes

### Issue 1: Path Problems

**Symptom:** MCP not detected, no error shown

**Fix:** Use absolute paths in mcp.json:

```json
{
  "mcpServers": {
    "super-todo": {
      "command": "bun",
      "args": [
        "/home/ofir/Desktop/things/github/private-todolist/src/index.ts"
      ],
      "env": {
        "CONVEX_URL": "https://efficient-sheep-998.convex.cloud"
      }
    }
  }
}
```

NOT `~/projects/...` or `./src/...` - use full absolute path!

### Issue 2: Wrong mcp.json Location

**Symptom:** Changes don't take effect

**Fix:** Make sure it's at `~/.kimi/mcp.json`:

```bash
# Wrong locations:
./.kimi/mcp.json                    ❌ project directory
/home/ofir/Desktop/things/github/private-todolist/.kimi/mcp.json  ❌

# Correct location:
~/.kimi/mcp.json                    ✅ home directory
```

### Issue 3: Bun Not in PATH

**Symptom:** "command not found: bun"

**Fix:** Use full path to bun:

```bash
which bun
# Output: /home/ofir/.bun/bin/bun
```

Then update mcp.json:

```json
{
  "command": "/home/ofir/.bun/bin/bun",
  "args": ["/home/ofir/Desktop/things/github/private-todolist/src/index.ts"],
  ...
}
```

### Issue 4: Syntax Error in mcp.json

**Symptom:** MCP not loading, Kimi logs show JSON error

**Fix:** Validate JSON syntax:

```bash
# Check if valid JSON
python3 -m json.tool ~/.kimi/mcp.json > /dev/null && echo "Valid JSON" || echo "Invalid JSON"
```

Common mistakes:
- Trailing commas
- Single quotes instead of double quotes
- Missing brackets

### Issue 5: Environment Variables Not Passed

**Symptom:** "CONVEX_URL not set" error

**Fix:** Ensure env is properly configured:

```json
{
  "mcpServers": {
    "super-todo": {
      "command": "bun",
      "args": ["/home/ofir/Desktop/things/github/private-todolist/src/index.ts"],
      "env": {
        "CONVEX_URL": "https://efficient-sheep-998.convex.cloud"
      }
    }
  }
}
```

### Issue 6: Kimi Version Too Old

**Symptom:** MCP option not available

**Fix:** Update Kimi Code CLI:

```bash
pip install --upgrade kimi-code
# or
pipx upgrade kimi-code
```

## Debugging Steps

### Step 1: Check Kimi Logs

```bash
# Find Kimi logs (location varies by system)
find ~/.local/share -name "*kimi*" -type f 2>/dev/null | head -5
# or
find ~/.config -name "*kimi*" -type f 2>/dev/null | head -5
```

### Step 2: Test MCP Server Independently

```bash
# Create a test script
cat > /tmp/test-mcp.sh << 'EOF'
#!/bin/bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
echo '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'
EOF

# Run the MCP server and send test input
cd /home/ofir/Desktop/things/github/private-todolist
CONVEX_URL=https://efficient-sheep-998.convex.cloud bun src/index.ts < /tmp/test-mcp.sh
```

You should see JSON responses with tools list.

### Step 3: Use Wrapper Script

If direct execution fails, use a wrapper:

```bash
cat > /tmp/super-todo-wrapper.sh << 'EOF'
#!/bin/bash
cd /home/ofir/Desktop/things/github/private-todolist
export CONVEX_URL=https://efficient-sheep-998.convex.cloud
exec bun src/index.ts
EOF

chmod +x /tmp/super-todo-wrapper.sh
```

Then in mcp.json:

```json
{
  "mcpServers": {
    "super-todo": {
      "command": "/tmp/super-todo-wrapper.sh"
    }
  }
}
```

## Working Example

Create this exact file at `~/.kimi/mcp.json`:

```json
{
  "mcpServers": {
    "super-todo": {
      "command": "bun",
      "args": [
        "/home/ofir/Desktop/things/github/private-todolist/src/index.ts"
      ],
      "env": {
        "CONVEX_URL": "https://efficient-sheep-998.convex.cloud"
      }
    }
  }
}
```

Then:
1. Save the file
2. **Completely exit** Kimi Code CLI
3. Restart Kimi Code CLI
4. Type `\mcp` or look for MCP indicator

## Alternative: Node.js instead of Bun

If Bun causes issues, use Node.js:

```bash
# Build first
bun run build

# Update mcp.json
{
  "mcpServers": {
    "super-todo": {
      "command": "node",
      "args": [
        "/home/ofir/Desktop/things/github/private-todolist/dist/index.js"
      ],
      "env": {
        "CONVEX_URL": "https://efficient-sheep-998.convex.cloud"
      }
    }
  }
}
```

## Still Not Working?

1. Check Kimi version: `kimi --version`
2. Verify MCP support: `kimi --help | grep -i mcp`
3. Try the Docker approach instead (see REMOTE_DEPLOYMENT.md)
4. Check Kimi documentation: https://docs.kimi.io

## Quick Diagnostic Script

Run this to check everything:

```bash
#!/bin/bash
echo "=== Super Todo MCP Diagnostic ==="
echo ""
echo "1. Checking mcp.json location..."
if [ -f ~/.kimi/mcp.json ]; then
    echo "   ✅ Found at ~/.kimi/mcp.json"
    cat ~/.kimi/mcp.json | python3 -m json.tool > /dev/null && echo "   ✅ Valid JSON" || echo "   ❌ Invalid JSON"
else
    echo "   ❌ Not found at ~/.kimi/mcp.json"
fi

echo ""
echo "2. Checking Bun..."
which bun && bun --version || echo "   ❌ Bun not found"

echo ""
echo "3. Checking project..."
if [ -d /home/ofir/Desktop/things/github/private-todolist ]; then
    echo "   ✅ Directory exists"
    [ -f /home/ofir/Desktop/things/github/private-todolist/src/index.ts ] && echo "   ✅ src/index.ts exists" || echo "   ❌ src/index.ts missing"
else
    echo "   ❌ Directory not found"
fi

echo ""
echo "4. Testing MCP server startup..."
cd /home/ofir/Desktop/things/github/private-todolist
timeout 2 bun src/index.ts 2>&1 | head -3 || true

echo ""
echo "=== Diagnostic Complete ==="
```

Save and run: `bash /tmp/diagnostic.sh`
