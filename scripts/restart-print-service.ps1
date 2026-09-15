#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path $PSScriptRoot -Parent
$PrintDir = Join-Path $RepoRoot 'print-service'
$PidFile  = Join-Path $RepoRoot '.print-service.pid'
$LogFile  = Join-Path $PrintDir 'print-service.log'
$VenvPy   = Join-Path $PrintDir '.venv\Scripts\python.exe'

# Stop existing process
if (Test-Path $PidFile) {
    $savedPid = [int](Get-Content $PidFile -Raw).Trim()
    try {
        $null = Get-Process -Id $savedPid -ErrorAction Stop
        Write-Host "==> Stopping print-service (PID $savedPid)..."
        Stop-Process -Id $savedPid -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500
    } catch {
        Write-Host '==> print-service not running (stale PID file)'
    }
    Remove-Item $PidFile -Force
}

if (-not (Test-Path $VenvPy)) {
    Write-Error "Virtualenv not found at $VenvPy — run start.ps1 first"
    exit 1
}

Write-Host '==> Starting print-service...'
$proc = Start-Process -FilePath $VenvPy `
    -ArgumentList (Join-Path $PrintDir 'main.py') `
    -WorkingDirectory $PrintDir `
    -RedirectStandardOutput $LogFile `
    -RedirectStandardError  $LogFile `
    -NoNewWindow -PassThru
$proc.Id | Set-Content $PidFile
Write-Host "==> print-service restarted (PID $($proc.Id)), log: $LogFile"
