# =============================================================================
# Stage 1: Dependencies - Install all dependencies for build
# =============================================================================
FROM node:20-slim AS deps

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# =============================================================================
# Stage 2: Build - Build frontend (Vite) and backend (ESBuild)
# =============================================================================
FROM node:20-slim AS build

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Replace Neon db.ts with standard PostgreSQL db.docker.ts for Docker builds
RUN cp server/db.docker.ts server/db.ts

# Build the application (Vite frontend + ESBuild backend)
# Output: dist/public (frontend) + dist/index.js (backend)
RUN npm run build

# =============================================================================
# Stage 3: Production - Minimal runtime image
# =============================================================================
FROM node:20-slim AS production

WORKDIR /app

# Install dumb-init for proper signal handling and curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs -s /bin/bash -m nodejs

# Copy package files for production dependencies
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application from build stage
COPY --from=build /app/dist ./dist

# Copy shared schema (required by the application)
COPY --from=build /app/shared ./shared

# Copy healthcheck script
COPY healthcheck.js ./

# Copy migrations for runtime execution (optional)
COPY --from=build /app/migrations ./migrations

# Create uploads and logs directories with proper permissions
RUN mkdir -p uploads logs/orbcomm && chown -R nodejs:nodejs uploads logs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Expose application port
EXPOSE 5000

# Switch to non-root user
USER nodejs

# Health check - verify app is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node healthcheck.js || exit 1

# Use dumb-init for proper signal handling (graceful shutdown)
ENTRYPOINT ["dumb-init", "--"]

# Start the application with increased heap memory (1GB)
CMD ["node", "--max-old-space-size=1024", "dist/index.js"]
