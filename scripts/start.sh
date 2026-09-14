#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRINT_DIR="$REPO_ROOT/print-service"
PID_FILE="$REPO_ROOT/.print-service.pid"
LOG_FILE="$PRINT_DIR/print-service.log"

set -a; source "$REPO_ROOT/.env"; set +a

echo "==> Starting Docker services…"
docker-compose -f "$REPO_ROOT/docker-compose.yml" up -d --build

# Ensure print-service venv + deps
if [ ! -f "$PRINT_DIR/.venv/bin/python" ]; then
  echo "==> Creating print-service virtualenv…"
  python3 -m venv "$PRINT_DIR/.venv"
fi
if ! "$PRINT_DIR/.venv/bin/pip" show fastapi &>/dev/null; then
  echo "==> Installing print-service dependencies…"
  "$PRINT_DIR/.venv/bin/pip" install -q --index-url https://pypi.org/simple/ -r "$PRINT_DIR/requirements.txt"
fi

# Always restart print-service
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "==> Restarting print-service (PID $(cat "$PID_FILE"))…"
  kill "$(cat "$PID_FILE")"
  sleep 1
fi
echo "==> Starting print-service…"
nohup "$PRINT_DIR/.venv/bin/python" "$PRINT_DIR/main.py" >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "==> print-service started (PID $!), log: $LOG_FILE"

echo "==> Done. Frontend: http://localhost:3000  Backend: http://localhost:8000"
