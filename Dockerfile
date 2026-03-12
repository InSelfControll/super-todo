# 🛡️ Super Todo MCP - Multi-Arch Container
# A 1% improvement each time is a big win.

# ============================================
# BUILD STAGE
# ============================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json bun.lockb* ./
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build the project
RUN bun run build

# ============================================
# PRODUCTION STAGE
# ============================================
FROM oven/bun:1-alpine AS production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init ca-certificates && \
    rm -rf /var/cache/apk/*

# Create non-root user for security
RUN addgroup -g 1000 sentinel && \
    adduser -D -u 1000 -G sentinel sentinel

WORKDIR /app

# Copy built artifacts
COPY --from=builder --chown=sentinel:sentinel /app/dist ./dist
COPY --from=builder --chown=sentinel:sentinel /app/package.json .
COPY --from=builder --chown=sentinel:sentinel /app/node_modules ./node_modules

# Switch to non-root user
USER sentinel

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD bun --version || exit 1

# Default to MCP server mode
ENTRYPOINT ["dumb-init", "--"]
CMD ["bun", "dist/index.js"]

# ============================================
# CLI STAGE
# ============================================
FROM production AS cli

ENTRYPOINT ["dumb-init", "--", "bun", "dist/cli/index.js"]
CMD ["help"]
