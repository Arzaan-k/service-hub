# Docker Deployment Guide - Service Hub Application

## Overview

This guide covers the complete Docker containerization of the Service Hub application, including:
- **Phase 1**: Database migration from Neon (cloud) to local PostgreSQL
- **Phase 2**: Docker containerization of all services

## Architecture

```
┌──────────────────────────────────────────┐
│         service-hub-app                   │
│  ┌────────────────────────────────────┐  │
│  │  React Frontend (Vite build)       │  │
│  │  → Served from /dist/public        │  │
│  └────────────────────────────────────┘  │
│  ┌────────────────────────────────────┐  │
│  │  Express Backend                   │  │
│  │  → API routes + WebSocket          │  │
│  │  → Port 5000                       │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
              ↓ connects to
┌──────────────────────────────────────────┐
│  PostgreSQL Container (postgres:16)      │
│  → Database + migrations                 │
│  → Port 5432                             │
└──────────────────────────────────────────┘
              ↓ connects to
┌──────────────────────────────────────────┐
│  Qdrant Container (vector store)         │
│  → RAG embeddings for manuals            │
│  → Port 6333                             │
└──────────────────────────────────────────┘
```

## Quick Start

### 1. Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 20GB+ disk space

### 2. Setup Environment

```bash
# Copy the Docker environment template
cp docker/.env.docker .env

# Generate secure secrets
openssl rand -base64 64  # Use for JWT_SECRET
openssl rand -base64 32  # Use for SESSION_SECRET

# Edit .env with your values
nano .env
```

### 3. Build and Start

```bash
# Build and start all services
npm run docker:up

# Or build from scratch
npm run docker:rebuild

# View logs
npm run docker:logs
```

### 4. Verify Deployment

```bash
# Check health endpoint
curl http://localhost:5000/api/health

# Expected response:
# {"status":"healthy","database":"connected",...}
```

---

## Phase 1: Database Migration (Neon → Local PostgreSQL)

### Step 1: Export Data from Neon

```bash
# Set Neon connection string
export NEON_DB="postgresql://neondb_owner:npg_ls7YTgzeoNA4@ep-young-grass-aewvokzj-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Full database dump (recommended)
pg_dump "$NEON_DB" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file=neon_backup_$(date +%Y%m%d_%H%M%S).dump

# Alternative: Plain SQL format
pg_dump "$NEON_DB" \
  --no-owner \
  --no-acl \
  --file=neon_backup.sql
```

### Step 2: Start Local PostgreSQL

```bash
# Start only PostgreSQL container
docker-compose up -d postgres

# Wait for it to be healthy
docker-compose ps
```

### Step 3: Import Data

```bash
# Set local connection
export LOCAL_DB="postgresql://service_hub_user:changeme123@localhost:5432/service_hub"

# Import custom format
pg_restore \
  --dbname="$LOCAL_DB" \
  --no-owner \
  --no-acl \
  --verbose \
  neon_backup.dump

# Or import SQL format
psql "$LOCAL_DB" < neon_backup.sql
```

### Step 4: Verify Migration

```bash
# Connect to local database
npm run docker:db

# Check table counts
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

# Check row counts
SELECT 'users' AS table_name, COUNT(*) FROM users
UNION ALL SELECT 'containers', COUNT(*) FROM containers
UNION ALL SELECT 'service_requests', COUNT(*) FROM service_requests;
```

---

## Phase 2: Docker Containerization

### File Structure

```
project/
├── Dockerfile              # Multi-stage build
├── docker-compose.yml      # Development/default config
├── docker-compose.prod.yml # Production overrides
├── .dockerignore           # Build context exclusions
├── healthcheck.js          # Docker health check script
├── server/
│   ├── db.ts               # Neon serverless driver (cloud)
│   └── db.docker.ts        # Standard pg driver (Docker)
└── docker/
    ├── init-db.sh          # Database initialization
    ├── nginx.conf          # Nginx reverse proxy config
    └── .env.docker         # Environment template
```

### Database Driver Strategy

The application uses two database drivers:

1. **Neon Serverless** (`server/db.ts`) - Used for cloud deployment (Render, Vercel, etc.)
2. **Standard pg** (`server/db.docker.ts`) - Used for Docker/local PostgreSQL

During Docker build, the Dockerfile automatically replaces `db.ts` with `db.docker.ts` to use the standard PostgreSQL driver.

### Docker Commands

```bash
# Build image
npm run docker:build

# Start all services
npm run docker:up

# Stop all services
npm run docker:down

# View logs
npm run docker:logs        # App only
npm run docker:logs:all    # All services

# Restart app
npm run docker:restart

# Access app shell
npm run docker:shell

# Access database
npm run docker:db

# Clean everything (including volumes)
npm run docker:clean

# Rebuild from scratch
npm run docker:rebuild

# Production deployment
npm run docker:prod
```

### Environment Variables

Key environment variables for Docker:

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_PASSWORD` | PostgreSQL password | `strong_password_here` |
| `USE_STANDARD_PG` | Use standard pg driver | `true` |
| `JWT_SECRET` | JWT signing secret (64+ chars) | `openssl rand -base64 64` |
| `SESSION_SECRET` | Session secret (32+ chars) | `openssl rand -base64 32` |
| `ALLOWED_ORIGINS` | CORS origins | `https://your-domain.com` |

### Production Deployment

```bash
# 1. Copy and configure environment
cp docker/.env.docker .env.production
nano .env.production

# 2. Build with production config
npm run docker:prod:build

# 3. Start production services
npm run docker:prod

# 4. Verify health
curl https://your-domain.com/api/health
```

---

## Database Backup & Restore

### Backup

```bash
# Backup to SQL file
docker-compose exec postgres pg_dump -U service_hub_user service_hub > backup_$(date +%Y%m%d).sql

# Backup with compression
docker-compose exec postgres pg_dump -U service_hub_user -Fc service_hub > backup_$(date +%Y%m%d).dump
```

### Restore

```bash
# Restore from SQL
docker-compose exec -T postgres psql -U service_hub_user service_hub < backup.sql

# Restore from dump
docker-compose exec -T postgres pg_restore -U service_hub_user -d service_hub < backup.dump
```

---

## Monitoring & Troubleshooting

### Health Checks

```bash
# Application health
curl http://localhost:5000/api/health

# Kubernetes-style probes
curl http://localhost:5000/api/ready  # Readiness
curl http://localhost:5000/api/live   # Liveness

# Container status
docker-compose ps
docker inspect service-hub-app | grep -A 10 Health
```

### Common Issues

#### 1. Database Connection Failed
```bash
# Check if postgres is running
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Verify connection
docker-compose exec postgres pg_isready -U service_hub_user
```

#### 2. App Won't Start
```bash
# Check app logs
docker-compose logs app

# Check if dependencies are healthy
docker-compose ps

# Rebuild app
docker-compose build --no-cache app
```

#### 3. Port Already in Use
```bash
# Find process using port
netstat -tulpn | grep 5000

# Or on Windows
netstat -ano | findstr :5000

# Kill process or change port in docker-compose.yml
```

---

## SSL/HTTPS Setup (Production)

### 1. Generate SSL Certificates

```bash
# Create SSL directory
mkdir -p docker/ssl

# Option A: Self-signed (testing only)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout docker/ssl/key.pem \
  -out docker/ssl/cert.pem

# Option B: Let's Encrypt (production)
# Use certbot or similar
```

### 2. Enable Nginx

Uncomment the nginx service in `docker-compose.yml` and update `docker/nginx.conf` with your domain.

### 3. Update CORS Origins

```env
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
FRONTEND_URL=https://your-domain.com
```

---

## Resource Requirements

### Minimum (Development)
- CPU: 2 cores
- RAM: 4GB
- Disk: 20GB

### Recommended (Production)
- CPU: 4 cores
- RAM: 8GB
- Disk: 50GB SSD

### Per Service
| Service | CPU | RAM |
|---------|-----|-----|
| App | 1-2 cores | 1-2GB |
| PostgreSQL | 0.5-1 core | 512MB-1GB |
| Qdrant | 0.5-1 core | 512MB-1GB |
| Nginx | 0.25 core | 256MB |

---

## Security Checklist

- [ ] Change default `DB_PASSWORD`
- [ ] Generate strong `JWT_SECRET` (64+ characters)
- [ ] Generate strong `SESSION_SECRET` (32+ characters)
- [ ] Set proper `ALLOWED_ORIGINS`
- [ ] Enable `ENABLE_RATE_LIMITING=true`
- [ ] Set `ENABLE_DETAILED_ERRORS=false` in production
- [ ] Use HTTPS in production
- [ ] Don't commit `.env` files to git
- [ ] Rotate secrets periodically
- [ ] Keep Docker images updated

---

## Rollback Plan

If something goes wrong:

```bash
# 1. Stop Docker services
npm run docker:down

# 2. Revert to Neon (update .env)
# DATABASE_URL=postgresql://neondb_owner:...@ep-young-grass...
# USE_STANDARD_PG=false

# 3. Start without Docker
npm run dev

# 4. Verify Neon connection
curl http://localhost:5000/api/health
```

---

## Support

For issues:
1. Check logs: `npm run docker:logs:all`
2. Verify health: `curl http://localhost:5000/api/health`
3. Check container status: `docker-compose ps`
4. Review this documentation
