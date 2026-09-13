# Progress

## Checklist

- [x] Repo scaffold, docker-compose, .env.example
- [x] DB schema (products, inventory_counter) + Alembic migration
- [x] Backend: config, database, models
- [x] Backend: HTTP Basic Auth
- [x] Backend: inventory number generation (atomic, wrapping)
- [x] Backend: POST /products, GET /products, POST /products/{id}/reprint, POST /products/{id}/delete
- [x] Backend: GET /icons, GET /icons/{filename}
- [x] Backend: Dockerfile
- [x] Print service: label rendering (Pillow, 384px, 1-bit, Floyd-Steinberg)
- [x] Print service: MXW01 BLE protocol (printer.py)
- [x] Print service: POST /print endpoint
- [x] Print service: README (native macOS setup, optional launchd)
- [x] Frontend: Vite + React, auth layer
- [x] Frontend: create form + icon gallery
- [x] Frontend: product table, search, print/delete actions
- [x] Frontend: Dockerfile + nginx
- [x] scripts/start.sh + scripts/stop.sh
- [x] README.md

## Known Limitations

- No user management UI — users are set via `APP_PASS_1` / `APP_PASS_2` env vars only
- No label print history — each print is fire-and-forget
- Print service requires real BLE hardware; tests mock the BLE layer and cannot be fully verified without an MXW01 device
