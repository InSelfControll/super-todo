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
# MIGRATION: DEV → PROD (FULL AUTOMATIC)
# ============================================

# Full automatic migration: dev → prod with env var copying
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
    
    echo "3️⃣  Copying environment variables from DEV to PROD..."
    echo "   Fetching DEV environment variables..."
    
    # List of critical env vars to migrate
    ENV_VARS=(
        "DISCORD_WEBHOOK"
        "USER_DISCORD_ID"
        "BOT_TOKEN"
        "GROUP_ID"
        "USER_TELEGRAM_ID"
    )
    
    MIGRATED_COUNT=0
    SKIPPED_COUNT=0
    
    for VAR in "${ENV_VARS[@]}"; do
        DEV_VALUE=$(bunx convex env get "$VAR" 2>/dev/null || echo "")
        if [ -n "$DEV_VALUE" ]; then
            echo "   📝 Copying $VAR..."
            echo "$DEV_VALUE" | bunx convex env --prod set "$VAR" -
            ((MIGRATED_COUNT++))
        else
            echo "   ⚠️  $VAR not set in DEV, skipping"
            ((SKIPPED_COUNT++))
        fi
    done
    
    echo ""
    echo "   ✅ Migrated $MIGRATED_COUNT env vars to PROD"
    echo "   ⚠️  Skipped $SKIPPED_COUNT env vars (not set in DEV)"
    echo ""
    
    echo "4️⃣  Deploying to production..."
    bunx convex deploy
    echo "   ✅ Deployed to production"
    echo ""
    
    echo "5️⃣  Verifying crons are registered..."
    echo "   📋 Registered crons should appear in dashboard"
    echo "   Run 'just dashboard-prod' to verify"
    echo ""
    
    echo "🎉 Migration complete!"
    echo ""
    echo "📋 Summary:"
    echo "   • Type checks: ✅"
    echo "   • Code generated: ✅"
    echo "   • Env vars migrated: $MIGRATED_COUNT"
    echo "   • Deployed to PROD: ✅"
    echo ""
    echo "🔍 Next steps:"
    echo "   1. Run: just dashboard-prod"
    echo "   2. Check 'Schedules' tab for crons"
    echo "   3. Run: just prod-test-notifications"

# Migrate only environment variables (no deploy)
migrate-env-only:
    #!/usr/bin/env bash
    set -e
    echo "🛡️ Migrating Environment Variables: DEV → PROD"
    echo ""
    
    ENV_VARS=(
        "DISCORD_WEBHOOK"
        "USER_DISCORD_ID"
        "BOT_TOKEN"
        "GROUP_ID"
        "USER_TELEGRAM_ID"
    )
    
    MIGRATED_COUNT=0
    
    for VAR in "${ENV_VARS[@]}"; do
        DEV_VALUE=$(bunx convex env get "$VAR" 2>/dev/null || echo "")
        if [ -n "$DEV_VALUE" ]; then
            echo "📝 $VAR: DEV → PROD"
            echo "$DEV_VALUE" | bunx convex env --prod set "$VAR" -
            ((MIGRATED_COUNT++))
        else
            echo "⚠️  $VAR: Not set in DEV, skipping"
        fi
    done
    
    echo ""
    echo "✅ Migrated $MIGRATED_COUNT environment variables"

# Quick deploy to production (skip checks, no env migration)
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

# List all environment variables (dev vs prod comparison)
env-list-all:
    #!/usr/bin/env bash
    echo "🛡️ Environment Variables Comparison"
    echo ""
    echo "📋 DEV Environment:"
    bunx convex env list 2>/dev/null || echo "   (No env vars set or error)"
    echo ""
    echo "📋 PROD Environment:"
    bunx convex env --prod list 2>/dev/null || echo "   (No env vars set or error)"

# Check production environment variables
env-check-prod:
    #!/usr/bin/env bash
    echo "🛡️ Checking PROD Environment Variables..."
    echo ""
    
    ENV_VARS=(
        "DISCORD_WEBHOOK"
        "USER_DISCORD_ID"
        "BOT_TOKEN"
        "GROUP_ID"
        "USER_TELEGRAM_ID"
    )
    
    for VAR in "${ENV_VARS[@]}"; do
        if bunx convex env --prod get "$VAR" >/dev/null 2>&1; then
            echo "   ✅ $VAR: Set"
        else
            echo "   ❌ $VAR: Missing"
        fi
    done

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
