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
# CONVEX
# ============================================

# Start Convex dev server
convex-dev:
    bunx convex dev

# Deploy Convex to production
convex-deploy:
    bunx convex deploy

# Generate Convex client code
convex-codegen:
    bunx convex codegen

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
