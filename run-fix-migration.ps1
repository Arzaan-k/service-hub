# PowerShell script to run the WhatsApp fix migration
# This fixes both the enum error and missing columns error

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "WhatsApp Error Fix Migration" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Load environment variables from .env file
if (Test-Path ".env") {
    Write-Host "Loading environment variables from .env..." -ForegroundColor Yellow
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)$') {
            $name = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$DATABASE_URL = $env:DATABASE_URL

if (-not $DATABASE_URL) {
    Write-Host "ERROR: DATABASE_URL not found in environment variables!" -ForegroundColor Red
    Write-Host "Please set DATABASE_URL in your .env file" -ForegroundColor Red
    exit 1
}

Write-Host "Database URL found: $($DATABASE_URL.Substring(0, 30))..." -ForegroundColor Green
Write-Host ""

# Check if psql is available
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue

if (-not $psqlPath) {
    Write-Host "ERROR: psql command not found!" -ForegroundColor Red
    Write-Host "Please install PostgreSQL client tools" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Run the SQL manually in your database console" -ForegroundColor Yellow
    Write-Host "SQL file location: fix-whatsapp-errors.sql" -ForegroundColor Yellow
    exit 1
}

Write-Host "Running migration..." -ForegroundColor Yellow
Write-Host ""

# Run the migration
$env:PGPASSWORD = ""
psql $DATABASE_URL -f fix-whatsapp-errors.sql

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Fixed issues:" -ForegroundColor Cyan
    Write-Host "  1. Added 'image', 'video', 'document', 'audio' to whatsapp_message_type enum" -ForegroundColor White
    Write-Host "  2. Added start_time, end_time, duration_minutes columns to service_requests" -ForegroundColor White
    Write-Host "  3. Added signed_document_url, vendor_invoice_url, technician_notes columns" -ForegroundColor White
    Write-Host ""
    Write-Host "Next step: Restart your server with 'npm run dev'" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Migration failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run the SQL manually in your database console" -ForegroundColor Yellow
    Write-Host "SQL file location: fix-whatsapp-errors.sql" -ForegroundColor Yellow
}
