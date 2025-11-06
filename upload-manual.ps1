param(
    [Parameter(Mandatory=$true)]
    [string]$PdfPath,

    [string]$ManualName = ""
)

# Script to upload a single manual using PowerShell
# Usage: .\upload-manual.ps1 -PdfPath "C:\path\to\manual.pdf" -ManualName "Optional Name"

if (-not (Test-Path $PdfPath)) {
    Write-Error "PDF file not found: $PdfPath"
    exit 1
}

if (-not $ManualName) {
    $ManualName = [System.IO.Path]::GetFileNameWithoutExtension($PdfPath)
}

Write-Host "Uploading: $PdfPath" -ForegroundColor Green
Write-Host "Name: $ManualName" -ForegroundColor Green

$form = @{
    file = Get-Item $PdfPath
    name = $ManualName
    version = "1.0"
}

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/api/manuals/upload" -Method Post -Form $form -Headers @{
        "Authorization" = "Bearer YOUR_ADMIN_TOKEN_HERE"
    }

    Write-Host "Upload successful!" -ForegroundColor Green
    $response | ConvertTo-Json -Depth 3
} catch {
    Write-Error "Upload failed: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $reader.BaseStream.Position = 0
        $reader.DiscardBufferedData()
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
}







