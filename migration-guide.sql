-- Database Migration Script
-- Copy all data from source to target database

-- Connect to target database and create tables with data
-- This script should be run on the target database

-- First, let's get all table structures and data from source
-- We'll use a simpler approach: export schema and data separately

-- Export schema from source (run this on source database)
-- pg_dump --schema-only --no-owner --no-privileges 'postgresql://neondb_owner:npg_Od1HJjgkwcM4@ep-square-scene-ad08b80l-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' > schema.sql

-- Export data from source (run this on source database)
-- pg_dump --data-only --no-owner --no-privileges 'postgresql://neondb_owner:npg_Od1HJjgkwcM4@ep-square-scene-ad08b80l-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' > data.sql

-- Then restore on target (run this on target database)
-- psql 'postgresql://neondb_owner:npg_O3naRCIxq1EK@ep-spring-boat-ahz5xl5s-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' < schema.sql
-- psql 'postgresql://neondb_owner:npg_O3naRCIxq1EK@ep-spring-boat-ahz5xl5s-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' < data.sql
