# Label System

Home inventory tracker with label printing on MXW01 BLE thermal printer.

## Architecture

- **db, backend, frontend** — Docker Compose
- **print-service** — native macOS process (BLE requires host Bluetooth)

## Prerequisites

- Docker Desktop
- Python 3
- Bluetooth-capable Mac
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

```bash
./scripts/start.sh
```

This will:
- Start db, backend, frontend via Docker Compose
- Create print-service venv (first run only) and install deps
- Start print-service natively on the host

Frontend: http://localhost:3000

### 3. Stop everything

```bash
./scripts/stop.sh
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
