# Label System

Home inventory tracker with label printing on MXW01 BLE thermal printer.

## Architecture

- **db, backend, frontend** — Docker Compose (deployed on VPS via GitHub Actions)
- **print-service** — native host process (BLE requires host Bluetooth; Docker Desktop has no BLE access on macOS or Windows)

The production setup uses a shared PostgreSQL on the VPS. The local machine proxies DB operations through the VPS backend and sends print jobs to the local BLE printer.

## Features

- Create and print product labels with inventory numbers
- Bulk import from Excel
- Search with autocomplete from existing product names
- Reprint labels for existing products
- AI icon generation (OpenAI `gpt-image-1`)
- WYSIWYG label layout editor (positions, font sizes, icon size) — saved per user on server
- Paginated product table (50/100/200 per page)
- Russian/English UI
- PWA — installable as an app on iOS and Android
- BLE printer: macOS CoreBluetooth UUID caching (fast repeat prints ~1s after first ~10s scan)

## Prerequisites

- Docker Desktop
- Python 3.x (for print-service venv)
- Bluetooth-capable machine (Mac or Windows)
- MXW01 BLE thermal printer

## First Run

### 1. Configure

```bash
cp .env.example .env
```

Edit `.env`:
| Variable | Description |
|---|---|
| `DB_PASSWORD` | PostgreSQL password |
| `APP_PASS_1`, `APP_PASS_2` | Login passwords for user1/user2 |
| `PRINTER_BLE_ADDRESS` | Printer name (e.g. `MXW01`) or BLE address |
| `REMOTE_BACKEND_URL` | VPS backend URL (if using remote DB) |
| `PRINT_ENABLED` | `true` on printer machine, `false` on VPS |
| `OPENAI_API_KEY` | For AI icon generation (optional) |

Find your printer's BLE name/address:
```bash
cd print-service
python3 -c "import asyncio; from bleak import BleakScanner; asyncio.run(BleakScanner.discover(timeout=5))" 2>&1 | grep -v Traceback
```

On macOS, CoreBluetooth hides hardware MAC addresses. Use the device name (e.g. `MXW01`) — the service caches the CoreBluetooth UUID after the first scan for fast subsequent prints.

### 2. Start everything

**macOS / Linux:**
```bash
./scripts/start.sh
```

**Windows (PowerShell):**
```powershell
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser  # one-time
./scripts/start.ps1
```

Both scripts start db/backend/frontend via Docker Compose (with `--build`) and start print-service natively on the host.

Frontend: http://localhost:3000

### 3. Restart print-service only

```bash
./scripts/restart-print-service.sh
```

Useful after the BLE printer times out (idle disconnection). The service caches the CoreBluetooth UUID in memory; restarting clears the cache and forces a fresh BLE scan on the next print.

### 4. Stop everything

**macOS / Linux:**
```bash
./scripts/stop.sh
```

**Windows:**
```powershell
./scripts/stop.ps1
```

## Service URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API (Swagger) | http://localhost:8000/docs |
| Print service | http://localhost:9100 |

## Label Layout Editor

Click **⚙ Этикетка / ⚙ Label** in the top bar to open the WYSIWYG editor:

- **Drag** the icon, product name, inventory number, and date to any position on the 2× preview
- **Sliders** adjust font sizes and icon size
- Settings are saved per-user on the server and applied to all subsequent prints

The label is 384×200 pixels (printed at ~96 DPI on the MXW01).

## Adding Custom Icons

Drop black-and-white PNG files (any size, scaled to 160×160) into `assets/icons/`, then rebuild:
```bash
docker compose build backend && docker compose up -d backend
```

Or use the AI generator: expand **✦ Generate icon** in the create form and describe the icon in Russian or English.

## VPS Deployment

Deployed automatically via GitHub Actions on push to `main`. The workflow:
1. Builds `backend` and `frontend` Docker images and pushes to GitHub Container Registry (ghcr.io)
2. SSHes into the VPS, pulls the new images, restarts the containers
3. On startup, the backend container runs `alembic upgrade head` automatically

**On VPS** (`.env`):
```
DB_HOST=<postgres-container-name>
PRINT_ENABLED=false
```

**On local machine with printer** (`.env`):
```
REMOTE_BACKEND_URL=https://<your-vps-domain>
PRINT_ENABLED=true
PRINTER_BLE_ADDRESS=MXW01
```

## Running Tests

```bash
# Backend
cd backend && python -m pytest tests/ -v

# Print service
cd print-service && .venv/bin/python -m pytest tests/ -v
```

## Running Migrations Manually

```bash
cd backend
export $(grep -v '^#' ../.env | xargs) && export DB_HOST=localhost
python -m alembic upgrade head
```

## Development

```bash
# Backend with hot reload (needs DB running)
docker compose up db -d
cd backend && uvicorn app.main:app --reload

# Frontend dev server (proxies /api → localhost:8000)
cd frontend && npm run dev

# Print service
cd print-service && source .venv/bin/activate && python main.py
```

## Windows Notes

**BLE:** Docker Desktop on Windows uses WSL2 (no Bluetooth access). `print-service` always runs natively on the host. `host.docker.internal` resolves correctly in Docker Desktop for Windows.

**Autostart:**
```powershell
$action  = New-ScheduledTaskAction -Execute 'powershell.exe' `
               -Argument "-NonInteractive -File C:\path\to\label-system\scripts\start.ps1"
$trigger = New-ScheduledTaskTrigger -AtLogOn
Register-ScheduledTask -TaskName 'LabelSystem' -Action $action -Trigger $trigger -RunLevel Highest
```

**Find BLE device:**
```powershell
cd print-service
.\.venv\Scripts\python.exe -c "import asyncio; from bleak import BleakScanner; asyncio.run(BleakScanner.discover(timeout=5))"
```
