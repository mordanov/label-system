# Label System — Design Spec

**Date:** 2026-09-13  
**Status:** Approved

## Problem

A local home inventory system for tracking products (freezer/pantry) with physical label printing on a BLE thermal printer (MXW01). Runs on a single macOS machine.

## Architecture

Four runtime units:

```
Browser → Frontend (React/Vite, :3000)
             ↓ HTTP
          Backend (FastAPI, :8000)  ←→  DB (PostgreSQL, :5432)
             ↓ HTTP (host.docker.internal:9100)
          Print Service (FastAPI, :9100, native macOS process)
             ↓ BLE (CoreBluetooth via bleak)
          MXW01 Printer
```

**Constraint:** MXW01 connects via BLE. Docker Desktop on macOS runs in a Linux VM with no BLE access. Print service must run natively on the host — not in Docker.

- `db`, `backend`, `frontend` → Docker Compose
- `print-service` → native Python process on macOS host, managed by `scripts/start.sh` / `scripts/stop.sh`

## Repository Layout

```
label-system/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/
│   ├── app/
│   │   ├── main.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── crud.py
│   │   ├── auth.py
│   │   └── routers/
│   │       ├── products.py
│   │       └── icons.py
│   └── alembic.ini
├── frontend/
│   ├── Dockerfile
│   └── src/
├── print-service/
│   ├── main.py
│   ├── printer.py        # MXW01 BLE protocol
│   ├── label.py          # PIL label rendering
│   ├── requirements.txt
│   └── README.md
├── assets/
│   └── icons/            # black-and-white PNG glyphs
├── scripts/
│   ├── start.sh
│   └── stop.sh
├── docker-compose.yml
├── .env.example
├── README.md
└── PROGRESS.md
```

## Data Model

### `inventory_counter` table
| column | type | notes |
|--------|------|-------|
| id | integer | always 1 (single row) |
| last_number | integer | 1–9999, wraps |

### `products` table
| column | type | notes |
|--------|------|-------|
| id | uuid | PK |
| inventory_number | char(4) | e.g. "0001", unique |
| name | text | |
| icon_filename | text | filename from assets/icons/ |
| created_at | timestamptz | set on insert |
| is_deleted | boolean | default false |
| deleted_at | timestamptz | nullable |
| deleted_by | text | nullable, username |

**Number generation:** `SELECT last_number FROM inventory_counter WHERE id=1 FOR UPDATE` in a transaction; increment mod 9999 (wrap 9999→0001); update row; return zero-padded string. Atomic, no race.

## Backend

**Stack:** Python 3.13, FastAPI, SQLAlchemy (async, asyncpg), Alembic, httpx, python-multipart, passlib

**Auth:** HTTP Basic Auth. Two users from env (`APP_USER_1`/`APP_PASS_1`, `APP_USER_2`/`APP_PASS_2`). Passwords stored as bcrypt hashes at startup (hashed in-memory, not persisted — env vars are the source of truth). Username available from request for `deleted_by`.

**Endpoints:**

| method | path | notes |
|--------|------|-------|
| POST | /products | create + print |
| POST | /products/{id}/reprint | reprint existing label |
| GET | /products | list; query params: `q` (name filter), `include_deleted` (bool, default false) |
| POST | /products/{id}/delete | soft delete, records `deleted_by` |
| GET | /icons | list available icon filenames |
| GET | /icons/{filename} | serve icon file |

**Print call:** backend POSTs to `PRINT_SERVICE_URL/print` with JSON `{inventory_number, name, created_at, icon_filename}` + icon bytes as multipart. If print service is unreachable, the product is still saved but the response includes `print_warning: true` (non-fatal — label can be reprinted).

**DB connection:** all config via env vars (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`). No hardcoded values.

## Print Service

**Stack:** Python 3.13, FastAPI, bleak, Pillow

**Endpoint:** `POST /print` — multipart form: `inventory_number`, `name`, `created_at`, `icon_filename`, `icon_file` (bytes).

**Label rendering (Pillow, 384px wide):**
- Canvas: 384×~200px white
- Top-left: icon glyph (scaled to ~80×80px)
- Top-right: product name (bold, ~24pt)
- Middle: inventory number large (`#0001`, ~48pt)
- Bottom: created_at date (`2026-09-13`, ~18pt)
- Convert to 1-bit with Floyd–Steinberg dithering

**MXW01 protocol** (adapted from PinThePenguinOne/MXW01_Thermal-Printer-Tool):
- BLE address from `PRINTER_BLE_ADDRESS` env var
- 384px wide, data in chunked commands per that project's protocol
- Connect → send print data → disconnect

**Startup:** connects to env-configured BLE address on first print (lazy connect). Reconnects on failure.

## Frontend

**Stack:** React 18, Vite, plain fetch (no extra HTTP lib)

**Auth:** browser-native Basic Auth header injected into every fetch call. Login form on first load that stores credentials in `sessionStorage`.

**Pages/views (single page):**
1. **Create form** — name input + icon gallery (grid of PNG previews) + "Add & Print" button
2. **Product table** — columns: #, icon, name, date, status (active / deleted by X at Y). Rows with `is_deleted` show with strikethrough + who/when.
3. **Search** — text input, live filter by name (client-side against loaded list; re-fetches on submit for server-side if list grows large)
4. **Row actions** — "Print" button (active rows), "Delete" button (active rows, with `window.confirm`)

No routing — single-view app, table + form on same page.

## Docker Compose

Services: `db` (postgres:16-alpine, named volume), `backend` (depends_on db, health check), `frontend` (nginx serving Vite build, proxies `/api` → backend).

All secrets/config from `.env`. `host.docker.internal` is automatically available on Docker Desktop for Mac.

## Scripts

`scripts/start.sh`:
1. Check if print-service venv exists (`print-service/.venv`); if not, create and `pip install -r requirements.txt`
2. `docker compose up -d`
3. If print-service already running (check `.print-service.pid`), skip. Otherwise: `nohup python main.py > print-service/print-service.log 2>&1 &`, save PID
4. Print status

`scripts/stop.sh`:
1. Kill PID from `.print-service.pid` if it exists and process is alive; remove PID file
2. `docker compose down`
3. Print status

Both idempotent (no error if already in desired state).

## Error Handling

- Print service down → product saved, response has `print_warning` field; frontend shows toast "Saved, but printing failed — use Reprint"
- DB constraint violation on number generation → retry once (extremely rare wrap collision)
- BLE connect failure in print service → 503 with message; backend surfaces as `print_warning`
- Invalid auth → 401

## Testing

- Print service: `python -m pytest print-service/test_label.py` — renders a label to PNG, checks dimensions and pixel content. No BLE hardware required.
- Backend: no test suite in initial scope (endpoints are thin CRUD; integration tests need DB). Manual test via `curl` examples in README.

## Implementation Phases

1. **Infrastructure** — `docker-compose.yml`, `.env.example`, DB schema, Alembic migrations
2. **Backend** — all FastAPI endpoints, auth, icon serving, print call
3. **Print service** — MXW01 protocol, label rendering, `/print` endpoint
4. **Frontend** — Vite/React UI
5. **Scripts + docs** — `start.sh`, `stop.sh`, `README.md`, `PROGRESS.md`
