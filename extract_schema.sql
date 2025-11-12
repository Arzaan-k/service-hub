-- Extract all table structures from source database
-- This will help recreate the schema in the new database

-- Connect to source database first to get structures

-- Get all table creation scripts
SELECT
    'CREATE TABLE ' || table_name || ' (' ||
    string_agg(
        column_name || ' ' || data_type ||
        CASE
            WHEN character_maximum_length IS NOT NULL THEN '(' || character_maximum_length || ')'
            WHEN data_type = 'numeric' AND numeric_precision IS NOT NULL THEN '(' || numeric_precision || ',' || numeric_scale || ')'
            ELSE ''
        END ||
        CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
        CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
        ', '
    ) || ');'
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
