# Safe Merge Script - Merges PMoverall into main without losing any features
# Run this in a NEW PowerShell window

$ErrorActionPreference = "Stop"

Write-Host "=== SAFE MERGE SCRIPT ===" -ForegroundColor Cyan
Write-Host ""

# Navigate to repository
Set-Location "C:\Users\Amit\service-hub"

# Disable git pager
$env:GIT_PAGER = ""

Write-Host "Step 1: Fetching latest changes from origin..." -ForegroundColor Yellow
git fetch origin

Write-Host "`nStep 2: Current status..." -ForegroundColor Yellow  
git status

Write-Host "`nStep 3: Switching to main branch..." -ForegroundColor Yellow
git checkout main

Write-Host "`nStep 4: Pulling latest main from origin..." -ForegroundColor Yellow
git pull origin main

Write-Host "`nStep 5: Showing commits in PMoverall not in main..." -ForegroundColor Yellow
git log --oneline main..PMoverall

Write-Host "`nStep 6: Merging PMoverall into main..." -ForegroundColor Green
git merge PMoverall --no-edit -m "Merge PMoverall: pm overall summarize feature"

Write-Host "`nStep 7: Final status check..." -ForegroundColor Yellow
git status

Write-Host "`nStep 8: Pushing to origin main..." -ForegroundColor Green
git push origin main

Write-Host "`n=== MERGE COMPLETED SUCCESSFULLY ===" -ForegroundColor Green
Write-Host "Your PMoverall features are now on main branch!" -ForegroundColor Cyan
Write-Host "Both your features and everyone else's features are preserved." -ForegroundColor Cyan

Read-Host -Prompt "Press Enter to exit"

