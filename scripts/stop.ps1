#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path $PSScriptRoot -Parent
$PidFile  = Join-Path $RepoRoot '.print-service.pid'

# Stop print-service
if (Test-Path $PidFile) {
    $savedPid = [int](Get-Content $PidFile -Raw).Trim()
    try {
        $null = Get-Process -Id $savedPid -ErrorAction Stop
        Write-Host "==> Stopping print-service (PID $savedPid)..."
        Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host '==> print-service not running (stale PID file)'
    }
    Remove-Item $PidFile -Force
} else {
    Write-Host '==> print-service not running'
}

Write-Host '==> Stopping Docker services...'
docker compose -f (Join-Path $RepoRoot 'docker-compose.yml') down

Write-Host '==> Done.'
