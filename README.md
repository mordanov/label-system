# Label System

Home inventory tracker with label printing on MXW01 BLE thermal printer.

## Architecture

- **db, backend, frontend** — Docker Compose
- **print-service** — native host process (BLE requires host Bluetooth; Docker Desktop has no BLE access on either macOS or Windows)

## Prerequisites

- Docker Desktop
- Python 3
- Bluetooth-capable machine (Mac or Windows)
- MXW01 BLE thermal printer

## First Run

### 1. Configure

```bash
cp .env.example .env
# Edit .env: set DB_PASSWORD, APP_PASS_1, APP_PASS_2, PRINTER_BLE_ADDRESS
```

Find your printer's BLE address:
```bash
cd print-service
python3 -c "import asyncio; from bleak import BleakScanner; asyncio.run(BleakScanner.discover())"
```

### 2. Start everything

**macOS / Linux:**
```bash
./scripts/start.sh
```

**Windows (PowerShell):**
```powershell
# Allow local scripts once (per user, one-time):
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

./scripts/start.ps1
```

Both scripts:
- Start db, backend, frontend via Docker Compose
- Create print-service venv (first run only) and install deps
- Start print-service natively on the host

Frontend: http://localhost:3000

### 3. Stop everything

**macOS / Linux:**
```bash
./scripts/stop.sh
```

**Windows (PowerShell):**
```powershell
./scripts/stop.ps1
```

## Service URLs

| Service       | URL                            |
|---------------|--------------------------------|
| Frontend      | http://localhost:3000          |
| Backend API   | http://localhost:8000/docs     |
| Print service | http://localhost:9100          |

## Running Tests

Backend:
```bash
cd backend && python -m pytest tests/ -v
```

Print service:
```bash
cd print-service && .venv/bin/python -m pytest tests/ -v
```

## Running migrations manually

```bash
cd backend
export $(grep -v '^#' ../.env | xargs) && export DB_HOST=localhost
python -m alembic upgrade head
```

## Adding icons

Drop black-and-white PNG files (any size, will be scaled to 80×80) into `assets/icons/`, then rebuild the backend image:
```bash
docker compose build backend && docker compose up -d backend
```

## Development

Backend dev server (outside Docker, needs DB running):
```bash
docker compose up db -d
cd backend && uvicorn app.main:app --reload
```

Frontend dev server:
```bash
cd frontend && npm run dev  # proxies /api → localhost:8000
```

Print service:
```bash
cd print-service && source .venv/bin/activate && python main.py
```

## VPS Deployment

Run the same codebase on a VPS (without printer). The shared PostgreSQL on the VPS is used by both the VPS instance and the local machine.

**On VPS** — add to `.env`:
```
DB_HOST=localhost   # or postgres container name
PRINT_ENABLED=false
```

Start only backend and frontend (skip the `db` service — use the existing VPS postgres):
```bash
docker compose up -d --no-deps backend frontend
```

**On local machine** — point to the VPS database by updating `.env`:
```
DB_HOST=<VPS_IP>
DB_PORT=5432
PRINT_ENABLED=true
```

Then start as usual (`./scripts/start.sh`). The local `db` container is no longer needed — remove it from `docker compose up` or just leave it stopped.

With `PRINT_ENABLED=false`, the web UI shows "Add" instead of "Add & Print" and hides the Print button in the product table. All create/delete functionality remains available.

## Windows Notes

**BLE constraint:** Docker Desktop on Windows runs in a WSL2 VM with no access to the host Bluetooth adapter — the same constraint as macOS. `print-service` must run natively on the host in both cases. `host.docker.internal` resolves correctly on Docker Desktop for Windows with no extra configuration.

**Autostart with Task Scheduler:**
```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
               -Argument "-NonInteractive -File C:\path\to\label-system\scripts\start.ps1"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName 'LabelSystem' -Action $action -Trigger $trigger -RunLevel Highest
```

**Find your printer's BLE address (Windows):**
```powershell
cd print-service
.\.venv\Scripts\python.exe -c "import asyncio; from bleak import BleakScanner; asyncio.run(BleakScanner.discover())"
```
