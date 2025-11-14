# Database Migration PowerShell Script
# Copy all data from source to target PostgreSQL databases

$sourceConn = "postgresql://neondb_owner:npg_Od1HJjgkwcM4@ep-square-scene-ad08b80l-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
$targetConn = "postgresql://neondb_owner:npg_O3naRCIxq1EK@ep-spring-boat-ahz5xl5s-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Get list of tables from source database
Write-Host "Getting table list from source database..."
$tables = psql $sourceConn -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;" | Select-String -Pattern "^\s+[a-zA-Z_].*" | ForEach-Object { $_.Line.Trim() }

Write-Host "Found $($tables.Count) tables: $($tables -join ', ')"

foreach ($table in $tables) {
    Write-Host "Processing table: $table"

    try {
        # Create table structure in target database
        Write-Host "  Creating table structure..."
        $createTableSQL = psql $sourceConn -c "\d $table"
        # This is complex to parse, let's use a simpler approach

        # Copy data using PostgreSQL's COPY command
        Write-Host "  Exporting data from source..."
        psql $sourceConn -c "\COPY (SELECT * FROM ""$table"") TO STDOUT WITH CSV HEADER" > "$table.csv"

        # Import data to target
        Write-Host "  Importing data to target..."
        psql $targetConn -c "CREATE TABLE IF NOT EXISTS ""$table"" AS SELECT * FROM ""$table"" WHERE false;"
        psql $targetConn -c "\COPY ""$table"" FROM '$table.csv' WITH CSV HEADER"

        # Clean up
        Remove-Item "$table.csv"

        Write-Host "  ✓ Completed table: $table"
    }
    catch {
        Write-Host "  ✗ Error processing table $table : $($_.Exception.Message)"
    }
}

Write-Host "Migration completed!"
