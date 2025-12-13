# PowerShell script to kill Node.js processes and restart the server
# Usage: .\restart-server.ps1

Write-Host "🛑 Stopping all Node.js processes..." -ForegroundColor Yellow

# Kill all Node.js processes
taskkill /F /IM node.exe 2>$null

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Check if port 5000 is still in use
$portInUse = netstat -ano | findstr ":5000" | findstr "LISTENING"
if ($portInUse) {
    Write-Host "⚠️  Port 5000 is still in use. Finding and killing the process..." -ForegroundColor Yellow
    $pid = ($portInUse -split '\s+')[-1]
    if ($pid) {
        taskkill /F /PID $pid 2>$null
        Start-Sleep -Seconds 1
    }
}

Write-Host "✅ Starting server..." -ForegroundColor Green
npm run dev

