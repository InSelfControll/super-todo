# 🛡️ Super Todo - Justfile
# A 1% improvement each time is a big win.

# Default recipe
_default:
    @just --list

# ============================================
# DEVELOPMENT
# ============================================

# Install dependencies with Bun
install:
    bun install

# Run MCP server in dev mode (watch)
dev:
    bun --watch src/index.ts

# Run type checker
check:
    bunx tsc --noEmit

# Build for production
build:
    bun build src/index.ts --outdir dist --target node
    bun build src/cli/index.ts --outdir dist/cli --target node

# Run the CLI
cli *args:
    bun src/cli/index.ts {{args}}

# ============================================
# CONVEX - DEV & PROD WORKFLOWS
# ============================================

# Start Convex dev server (local development)
convex-dev:
    bunx convex dev

# Deploy Convex to production
convex-deploy:
    bunx convex deploy

# Generate Convex client code
convex-codegen:
    bunx convex codegen

# ============================================
# MIGRATION: DEV → PROD
# ============================================

# Full migration workflow from dev to production
migrate-prod:
    #!/usr/bin/env bash
    set -e
    echo "🛡️ Starting Dev → Prod Migration..."
    echo ""
    
    echo "1️⃣  Running type checks..."
    bunx tsc --noEmit
    echo "   ✅ Type checks passed"
    echo ""
    
    echo "2️⃣  Generating Convex code..."
    bunx convex codegen
    echo "   ✅ Code generated"
    echo ""
    
    echo "3️⃣  Testing notifications (manual run)..."
    bunx convex run daily:scheduledMorningSync >/dev/null 2>&1 && echo "   ✅ Morning sync works" || echo "   ⚠️  Morning sync test failed"
    bunx convex run daily:scheduledEveningSync >/dev/null 2>&1 && echo "   ✅ Evening sync works" || echo "   ⚠️  Evening sync test failed"
    echo ""
    
    echo "4️⃣  Deploying to production..."
    bunx convex deploy
    echo "   ✅ Deployed to production"
    echo ""
    
    echo "5️⃣  Checking environment variables..."
    echo "   Make sure these are set in PROD dashboard:"
    echo "   • DISCORD_WEBHOOK"
    echo "   • USER_DISCORD_ID (optional)"
    echo "   • BOT_TOKEN"
    echo "   • GROUP_ID"
    echo "   • USER_TELEGRAM_ID (optional)"
    echo ""
    
    echo "🎉 Migration complete!"
    echo ""
    echo "📋 Next steps:"
    echo "   1. Open Convex Dashboard: https://dashboard.convex.dev"
    echo "   2. Select your PROD project"
    echo "   3. Go to Settings → Environment Variables"
    echo "   4. Add all required env vars"
    echo "   5. Go to Schedules to verify crons are registered"
    echo "   6. Run 'just convex-logs-prod' to monitor"

# Quick deploy to production (skip checks)
convex-deploy-quick:
    bunx convex deploy

# ============================================
# CONVEX - MONITORING & DEBUGGING
# ============================================

# View production logs
convex-logs-prod:
    bunx convex logs --prod

# View dev logs
convex-logs-dev:
    bunx convex logs

# Open Convex Dashboard
dashboard:
    bunx convex dashboard

# Open production dashboard
dashboard-prod:
    bunx convex dashboard --prod

# Check production environment variables
env-check-prod:
    bunx convex env --prod --get DISCORD_WEBHOOK 2>/dev/null && echo "✅ DISCORD_WEBHOOK set" || echo "❌ DISCORD_WEBHOOK missing"
    bunx convex env --prod --get BOT_TOKEN 2>/dev/null && echo "✅ BOT_TOKEN set" || echo "❌ BOT_TOKEN missing"
    bunx convex env --prod --get GROUP_ID 2>/dev/null && echo "✅ GROUP_ID set" || echo "❌ GROUP_ID missing"

# Test notifications in production
prod-test-morning:
    bunx convex run --prod daily:scheduledMorningSync

prod-test-evening:
    bunx convex run --prod daily:scheduledEveningSync

prod-test-notifications:
    bunx convex run --prod notifications:testNotifications

# ============================================
# CRONS - VERIFICATION
# ============================================

# Check if crons are properly configured
crons-verify:
    #!/usr/bin/env bash
    echo "🕐 Checking Cron Configuration..."
    echo ""
    echo "📄 crons.ts content:"
    cat convex/crons.ts | grep -A 3 "cron:"
    echo ""
    echo "🔍 Scheduled Functions:"
    echo "   • daily:scheduledMorningSync"
    echo "   • daily:scheduledEveningSync"
    echo ""
    echo "⏰ Schedule (Jerusalem Time):"
    echo "   Morning: 8:00 AM (6:00 AM UTC)"
    echo "   Evening: 7:00 PM (5:00 PM UTC)"
    echo ""
    echo "📋 To verify in Dashboard:"
    echo "   1. Run: just dashboard"
    echo "   2. Click 'Schedules' in left sidebar"
    echo "   3. Look for: morningSync, eveningSync"

crons-test-dev:
    bunx convex run daily:scheduledMorningSync

crons-test-prod:
    bunx convex run --prod daily:scheduledMorningSync

# ============================================
# CONTAINERIZATION (Multi-Arch)
# ============================================

# Image name and tag
image_name := "super-todo-mcp"
image_tag := "latest"

# Build container for local platform
container-build:
    docker build -t {{image_name}}:{{image_tag}} .

# Build and push multi-arch containers (x86_64 + arm64)
container-build-push:
    #!/usr/bin/env bash
    set -e
    echo "🛡️ Building multi-arch containers for {{image_name}}..."
    docker buildx create --use --name super-todo-builder 2>/dev/null || docker buildx use super-todo-builder
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        -t {{image_name}}:{{image_tag}} \
        -t {{image_name}}:1.0.0 \
        --push \
        .
    echo "✅ Multi-arch containers built and pushed!"
    docker buildx rm super-todo-builder

# Build multi-arch containers locally (load not supported for multi-arch, use push)
container-build-local:
    #!/usr/bin/env bash
    set -e
    echo "🛡️ Building containers for local platform..."
    docker build -t {{image_name}}:{{image_tag}} .
    echo "✅ Container built: {{image_name}}:{{image_tag}}"

# Run container locally with env file (stdio mode)
container-run:
    docker run --rm -it \
        --env-file .env \
        --name super-todo \
        {{image_name}}:{{image_tag}}

# Run container in SSE mode (for remote access)
container-run-sse port="3000":
    docker run -d \
        --name super-todo \
        -p {{port}}:{{port}} \
        -e MCP_TRANSPORT=sse \
        -e MCP_PORT={{port}} \
        -e MCP_HOST=0.0.0.0 \
        -e CONVEX_URL=${CONVEX_URL} \
        {{image_name}}:{{image_tag}}
    @echo "🛡️ Super Todo SSE server running on port {{port}}"
    @echo "Health check: curl http://localhost:{{port}}/health"

# Run container with shell access
container-shell:
    docker run --rm -it \
        --env-file .env \
        --entrypoint /bin/sh \
        {{image_name}}:{{image_tag}}

# ============================================
# DOCKER COMPOSE
# ============================================

# Start with docker-compose
compose-up:
    docker-compose up -d

# Stop docker-compose
compose-down:
    docker-compose down

# View logs
compose-logs:
    docker-compose logs -f

# ============================================
# CLEANUP
# ============================================

clean:
    rm -rf dist node_modules
    docker rmi {{image_name}}:{{image_tag}} 2>/dev/null || true

# Clean everything including Convex generated
clean-all: clean
    rm -rf convex/_generated
    docker buildx rm super-todo-builder 2>/dev/null || true

# ============================================
# TESTING
# ============================================

# Quick health check
test:
    @echo "🛡️ Running basic checks..."
    @bun --version
    @bunx tsc --version
    @echo "✅ Environment ready!"

# Test all notifications channels
test-notifications:
    bunx convex run notifications:testNotifications
