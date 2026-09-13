#Requires -Version 5.1
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$RepoRoot  = Split-Path $PSScriptRoot -Parent
$PrintDir  = Join-Path $RepoRoot 'print-service'
$PidFile   = Join-Path $RepoRoot '.print-service.pid'
$LogFile   = Join-Path $PrintDir 'print-service.log'
$EnvFile   = Join-Path $RepoRoot '.env'
$VenvPy    = Join-Path $PrintDir '.venv\Scripts\python.exe'
$VenvPip   = Join-Path $PrintDir '.venv\Scripts\pip.exe'

# Load .env so PRINTER_BLE_ADDRESS is available for docker compose
if (Test-Path $EnvFile) {
    Get-Content $EnvFile | Where-Object { $_ -match '^\s*[^#]\w+=.' } | ForEach-Object {
        $key, $val = $_ -split '=', 2
        [System.Environment]::SetEnvironmentVariable($key.Trim(), $val.Trim(), 'Process')
    }
}

Write-Host '==> Starting Docker services...'
docker compose -f (Join-Path $RepoRoot 'docker-compose.yml') up -d

# Ensure print-service venv + deps
if (-not (Test-Path $VenvPy)) {
    Write-Host '==> Creating print-service virtualenv...'
    python -m venv (Join-Path $PrintDir '.venv')
}
$fastapiCheck = & $VenvPip show fastapi 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host '==> Installing print-service dependencies...'
    & $VenvPip install -q -r (Join-Path $PrintDir 'requirements.txt')
}

# Start print-service if not already running
$alreadyRunning = $false
if (Test-Path $PidFile) {
    $savedPid = [int](Get-Content $PidFile -Raw).Trim()
    try {
        $null = Get-Process -Id $savedPid -ErrorAction Stop
        $alreadyRunning = $true
        Write-Host "==> print-service already running (PID $savedPid)"
    } catch { }
}

if (-not $alreadyRunning) {
    Write-Host '==> Starting print-service...'
    $proc = Start-Process -FilePath $VenvPy `
        -ArgumentList (Join-Path $PrintDir 'main.py') `
        -WorkingDirectory $PrintDir `
        -RedirectStandardOutput $LogFile `
        -RedirectStandardError  $LogFile `
        -NoNewWindow -PassThru
    $proc.Id | Set-Content $PidFile
    Write-Host "==> print-service started (PID $($proc.Id)), log: $LogFile"
}

Write-Host '==> Done. Frontend: http://localhost:3000  Backend: http://localhost:8000'
