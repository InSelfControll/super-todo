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

# Full automatic migration: dev → prod with env var copying and data migration
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
    just migrate-env-only
    echo ""
    
    echo "4️⃣  Exporting data from DEV..."
    EXPORT_FILE="convex-export-$(date +%Y%m%d-%H%M%S).zip"
    bunx convex export --path "$EXPORT_FILE"
    echo "   ✅ Exported to $EXPORT_FILE"
    echo ""
    
    echo "5️⃣  Deploying to production..."
    bunx convex deploy
    echo "   ✅ Deployed to production"
    echo ""
    
    echo "6️⃣  Importing data to PROD..."
    echo "   ⚠️  This will REPLACE existing PROD data with DEV data!"
    bunx convex import --prod --replace "$EXPORT_FILE"
    echo "   ✅ Data imported to PROD (replaced existing data)"
    echo ""
    
    echo "7️⃣  Verifying crons are registered..."
    echo "   📋 Registered crons should appear in dashboard"
    echo "   Run 'just dashboard-prod' to verify"
    echo ""
    
    echo "🎉 Migration complete!"
    echo ""
    echo "📋 Summary:"
    echo "   • Type checks: ✅"
    echo "   • Code generated: ✅"
    echo "   • Env vars migrated: ✅"
    echo "   • Data exported/imported: ✅"
    echo "   • Deployed to PROD: ✅"
    echo ""
    echo "🔍 Next steps:"
    echo "   1. Run: just dashboard-prod"
    echo "   2. Check 'Schedules' tab for crons"
    echo "   3. Run: just prod-test-notifications"
    echo ""
    echo "💾 Export file kept: $EXPORT_FILE"
    echo "   Delete when no longer needed: rm $EXPORT_FILE"

# Migrate only environment variables (no deploy, no data)
migrate-env-only:
    #!/usr/bin/env bash
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
        DEV_VALUE=$(bunx convex env get "$VAR" 2>/dev/null | tr -d '\n' || echo "")
        if [ -n "$DEV_VALUE" ]; then
            echo "📝 $VAR: DEV → PROD"
            bunx convex env --prod set "$VAR" "$DEV_VALUE"
            ((MIGRATED_COUNT++))
        else
            echo "⚠️  $VAR: Not set in DEV, skipping"
        fi
    done
    
    echo ""
    echo "✅ Migrated $MIGRATED_COUNT environment variables"

# Migrate only data (export dev, import prod) - requires deploy first
migrate-data-only:
    #!/usr/bin/env bash
    set -e
    echo "🛡️ Migrating Data: DEV → PROD"
    echo ""
    
    EXPORT_FILE="convex-export-$(date +%Y%m%d-%H%M%S).zip"
    
    echo "📥 Exporting from DEV..."
    bunx convex export --path "$EXPORT_FILE"
    echo "   ✅ Exported: $EXPORT_FILE"
    echo ""
    
    echo "📤 Importing to PROD..."
    echo "   ⚠️  This will REPLACE existing PROD data!"
    bunx convex import --prod --replace "$EXPORT_FILE"
    echo "   ✅ Imported to PROD (replaced existing data)"
    echo ""
    
    echo "💾 Export file kept: $EXPORT_FILE"
    echo "   Delete when no longer needed: rm $EXPORT_FILE"

# Quick deploy to production (skip checks, no env migration)
convex-deploy-quick:
    bunx convex deploy

# ============================================
# PROJECT MANAGEMENT - DUPLICATES
# ============================================

# Find duplicate projects (same name, different groups)
find-duplicates:
    #!/usr/bin/env bash
    echo "🔍 Finding duplicate projects..."
    echo ""
    bunx convex run projects:findDuplicateProjects

# Preview what auto-fix would do (dry run)
fix-duplicates-preview:
    #!/usr/bin/env bash
    echo "🔍 Preview: Auto-fixing duplicate projects (dry run)..."
    echo ""
    bunx convex run projects:autoFixDuplicateProjects '{"dryRun": true}'

# Auto-fix duplicate projects - keeps "important", archives "hobbies"
fix-duplicates:
    #!/usr/bin/env bash
    echo "⚠️  This will merge duplicate projects!"
    echo "   - Keeps the 'important' version"
    echo "   - Migrates tasks from duplicates"
    echo "   - Archives duplicate projects"
    echo ""
    read -p "Continue? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        echo ""
        echo "🔧 Auto-fixing duplicate projects..."
        bunx convex run projects:autoFixDuplicateProjects '{"dryRun": false}'
    else
        echo "Cancelled"
    fi

# Fix duplicates in production
fix-duplicates-prod:
    #!/usr/bin/env bash
    echo "⚠️  ⚠️  ⚠️  THIS WILL MODIFY PRODUCTION DATA!"
    echo ""
    read -p "Type 'PRODUCTION' to confirm: " confirm
    if [ "$confirm" = "PRODUCTION" ]; then
        echo ""
        echo "🔧 Auto-fixing duplicate projects in PROD..."
        bunx convex run --prod projects:autoFixDuplicateProjects '{"dryRun": false}'
    else
        echo "Cancelled"
    fi

# ============================================
# PROJECT DELETION (⚠️ PERMANENT)
# ============================================

# Delete a project and all its tasks (DEV)
# Usage: just delete-project-dev <project-id>
delete-project-dev project-id:
    #!/usr/bin/env bash
    echo "⚠️  ⚠️  ⚠️  THIS WILL PERMANENTLY DELETE THE PROJECT AND ALL TASKS!"
    echo "Project ID: {{project-id}}"
    echo ""
    read -p "Type 'DELETE' to confirm: " confirm
    if [ "$confirm" = "DELETE" ]; then
        echo ""
        echo "🗑️  Deleting project and all related tasks..."
        bunx convex run projects:deleteProject '{"projectId": "{{project-id}}", "confirm": true}'
    else
        echo "Cancelled"
    fi

# Delete a project and all its tasks (PROD)
# Usage: just delete-project-prod <project-id>
delete-project-prod project-id:
    #!/usr/bin/env bash
    echo "⚠️  ⚠️  ⚠️  THIS WILL PERMANENTLY DELETE THE PROJECT AND ALL TASKS IN PRODUCTION!"
    echo "Project ID: {{project-id}}"
    echo ""
    read -p "Type 'DELETE PRODUCTION' to confirm: " confirm
    if [ "$confirm" = "DELETE PRODUCTION" ]; then
        echo ""
        echo "🗑️  Deleting project and all related tasks from PROD..."
        bunx convex run --prod projects:deleteProject '{"projectId": "{{project-id}}", "confirm": true}'
    else
        echo "Cancelled"
    fi

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
# DATA MANAGEMENT
# ============================================

# Export all data from DEV
export-dev:
    #!/usr/bin/env bash
    EXPORT_FILE="convex-export-$(date +%Y%m%d-%H%M%S).zip"
    echo "📥 Exporting DEV data to $EXPORT_FILE..."
    bunx convex export --path "$EXPORT_FILE"
    echo "✅ Exported: $EXPORT_FILE"

# Export all data from PROD
export-prod:
    #!/usr/bin/env bash
    EXPORT_FILE="convex-export-prod-$(date +%Y%m%d-%H%M%S).zip"
    echo "📥 Exporting PROD data to $EXPORT_FILE..."
    bunx convex export --prod --path "$EXPORT_FILE"
    echo "✅ Exported: $EXPORT_FILE"

# Import data to DEV (be careful!)
import-dev file:
    #!/usr/bin/env bash
    echo "⚠️  This will overwrite DEV data with {{file}}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
        bunx convex import {{file}}
    else
        echo "Cancelled"
    fi

# Import data to PROD (be very careful!)
import-prod file:
    #!/usr/bin/env bash
    echo "⚠️  ⚠️  ⚠️  THIS WILL OVERWRITE PRODUCTION DATA!"
    echo "File: {{file}}"
    read -p "Type 'PRODUCTION' to confirm: " confirm
    if [ "$confirm" = "PRODUCTION" ]; then
        bunx convex import --prod --replace {{file}}
    else
        echo "Cancelled"
    fi

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
