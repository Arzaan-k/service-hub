Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   SERVICE HUB - CENTRALIZED AUTH" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Change to Service Hub directory
Set-Location "C:\Users\user\Downloads\service-hub"

Write-Host "📂 Directory: $(Get-Location)" -ForegroundColor Gray
Write-Host "🔧 Starting Service Hub on port 5000..." -ForegroundColor Yellow
Write-Host ""
Write-Host "⚠️  IMPORTANT: Keep this window open!" -ForegroundColor Red
Write-Host "   Service Hub must run for login to work" -ForegroundColor White
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Start the server
npm run dev
