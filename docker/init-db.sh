#!/bin/bash
# =============================================================================
# Database Initialization Script
# =============================================================================
# This script runs when the PostgreSQL container starts for the first time.
# It applies all migrations to set up the database schema.
# =============================================================================

set -e

echo "=============================================="
echo "Service Hub Database Initialization"
echo "=============================================="

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until pg_isready -h localhost -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "PostgreSQL is not ready yet, waiting..."
  sleep 2
done

echo "✅ PostgreSQL is ready!"

# Run migrations if they exist
if [ -d /migrations ]; then
  echo ""
  echo "Running database migrations..."
  echo "----------------------------------------------"
  
  # Sort migrations by filename to ensure correct order
  for migration in $(ls /migrations/*.sql 2>/dev/null | sort); do
    if [ -f "$migration" ]; then
      filename=$(basename "$migration")
      echo "📄 Applying migration: $filename"
      
      # Run migration, continue on error (migration may already be applied)
      if psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f "$migration" 2>&1; then
        echo "   ✅ Applied successfully"
      else
        echo "   ⚠️  Migration may already be applied or has errors (continuing...)"
      fi
    fi
  done
  
  echo "----------------------------------------------"
  echo "✅ All migrations processed!"
else
  echo "⚠️  No migrations directory found at /migrations"
fi

# Create extensions if needed
echo ""
echo "Ensuring required extensions..."
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" <<-EOSQL
  -- Enable UUID extension
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
  
  -- Enable pgcrypto for encryption functions
  CREATE EXTENSION IF NOT EXISTS "pgcrypto";
EOSQL

echo "✅ Extensions configured!"

# Verify tables were created
echo ""
echo "Verifying database schema..."
TABLE_COUNT=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "📊 Found $TABLE_COUNT tables in public schema"

echo ""
echo "=============================================="
echo "✅ Database initialization complete!"
echo "=============================================="
