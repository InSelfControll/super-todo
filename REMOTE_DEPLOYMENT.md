# 🌐 Remote Deployment Guide

This guide explains how to run Super Todo MCP on a remote server and connect to it from your local machine.

## Overview

Super Todo MCP supports two transport modes:

| Mode | Use Case | Transport |
|------|----------|-----------|
| `stdio` | Local development | Standard input/output |
| `sse` | Remote servers | HTTP Server-Sent Events |

## Option 1: SSE Transport (Recommended for Remote)

### On Your Remote Server

1. **Deploy with Docker:**

```bash
docker run -d \
  --name super-todo \
  --restart unless-stopped \
  -p 3000:3000 \
  -e MCP_TRANSPORT=sse \
  -e MCP_PORT=3000 \
  -e MCP_HOST=0.0.0.0 \
  -e CONVEX_URL=https://your-deployment.convex.cloud \
  super-todo-mcp:latest
```

2. **Or use Docker Compose:**

```yaml
version: "3.8"
services:
  super-todo:
    image: super-todo-mcp:latest
    container_name: super-todo
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - MCP_TRANSPORT=sse
      - MCP_PORT=3000
      - MCP_HOST=0.0.0.0
      - CONVEX_URL=https://your-deployment.convex.cloud
```

3. **Verify it's working:**

```bash
curl http://your-server:3000/health
```

Expected response:
```json
{
  "status": "ok",
  "server": "super-todo",
  "version": "1.0.0",
  "convex": "https://your-deployment.convex.cloud"
}
```

### From Your Local Machine

Kimi Code CLI uses stdio transport by default. To connect to a remote SSE server, you have several options:

#### Option A: SSH Tunnel (Simplest)

Create an SSH tunnel to forward remote port 3000 to local port 3000:

```bash
ssh -L 3000:localhost:3000 your-remote-server
# Keep this terminal open
```

Then use a local stdio-to-SSE proxy in your `.kimi/mcp.json`.

#### Option B: stdio-to-SSE Proxy

Install the MCP SSE proxy:

```bash
npm install -g @modelcontextprotocol/sse-proxy
```

Then configure Kimi:

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

#### Option C: Reverse Proxy with HTTPS (Production)

For production deployments, put the MCP server behind a reverse proxy with HTTPS:

**Nginx example:**

```nginx
server {
    listen 443 ssl;
    server_name mcp.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400;
    }
}
```

Then connect via:

```json
{
  "mcpServers": {
    "super-todo": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/sse-proxy",
        "https://mcp.yourdomain.com/sse"
      ]
    }
  }
}
```

## Option 2: Run on Remote, Use CLI Locally

If you just want the scheduled notifications (morning/evening reports) to run on your remote server, but use the CLI locally:

### On Remote Server

Run only the Convex backend (notifications work via Convex, no MCP server needed):

```bash
# Just ensure Convex env vars are set in dashboard
# Notifications will work automatically via scheduled jobs
```

### On Local Machine

Use the CLI directly with your local `.env`:

```bash
# .env
CONVEX_URL=https://your-deployment.convex.cloud

# Run CLI commands
bun cli morning
bun cli evening
bun cli projects
```

## Security Considerations

### For SSE Transport

1. **Firewall:** Only expose port 3000 to trusted IPs:
   ```bash
   ufw allow from YOUR_IP to any port 3000
   ```

2. **HTTPS:** Always use HTTPS in production (via reverse proxy)

3. **Authentication:** The MCP protocol doesn't have built-in auth. Consider:
   - VPN access only
   - Basic auth in reverse proxy
   - IP whitelisting

### Environment Variables

- `CONVEX_URL` - Required for both local and remote
- Webhooks (`DISCORD_WEBHOOK`, etc.) - Store in **Convex Dashboard**, not on remote server

## Troubleshooting

### SSE Connection Issues

```bash
# Test SSE endpoint
curl -N http://your-server:3000/sse

# Should stream data
```

### CORS Errors

The SSE server includes CORS headers for all origins. If you need to restrict:

```javascript
// In src/mcp/server.ts, modify the CORS headers
res.setHeader("Access-Control-Allow-Origin", "https://your-domain.com");
```

### Health Check Fails

```bash
# Check if container is running
docker ps | grep super-todo

# Check logs
docker logs super-todo

# Verify env vars
docker exec super-todo env | grep CONVEX
```

## Architecture: Remote Deployment

```
┌──────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│  Kimi Code CLI   │────►│  Remote MCP Server   │────►│  Convex Cloud   │
│   (Your Laptop)  │ SSE │  (Docker Container)  │     │  (Backend DB)   │
└──────────────────┘     └──────────────────────┘     └─────────────────┘
                                │
                                ▼
                    ┌──────────────────────┐
                    │  Notifications       │
                    │  (Discord/Telegram)  │
                    └──────────────────────┘
```

## Summary

| Scenario | Solution |
|----------|----------|
| Local dev with Kimi | `MCP_TRANSPORT=stdio` (default) |
| Remote server + local Kimi | `MCP_TRANSPORT=sse` + SSE proxy |
| Just scheduled notifications | Only Convex backend needed |
| Production deployment | SSE + HTTPS reverse proxy |
