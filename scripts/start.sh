#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRINT_DIR="$REPO_ROOT/print-service"
PID_FILE="$REPO_ROOT/.print-service.pid"
LOG_FILE="$PRINT_DIR/print-service.log"
TUNNEL_PID_FILE="$REPO_ROOT/.ssh-tunnel.pid"

# Load env for PRINTER_BLE_ADDRESS
set -a; source "$REPO_ROOT/.env"; set +a

# Parse flags
USE_TUNNEL=false
for arg in "$@"; do [ "$arg" = "--tunnel" ] && USE_TUNNEL=true; done

# SSH tunnel to VPS postgres (--tunnel flag)
if $USE_TUNNEL; then
  if [ -f "$TUNNEL_PID_FILE" ] && kill -0 "$(cat "$TUNNEL_PID_FILE")" 2>/dev/null; then
    echo "==> Killing existing SSH tunnel (PID $(cat "$TUNNEL_PID_FILE"))…"
    kill "$(cat "$TUNNEL_PID_FILE")"
    sleep 1
  fi
  echo "==> Starting SSH tunnel: localhost:5433 → VPS recipes-db:5432…"
  ssh -i "$HOME/.ssh/id_servinga" \
    -L 5433:recipes-db:5432 \
    deploy@204.168.164.33 \
    -N -o StrictHostKeyChecking=no -o ServerAliveInterval=60 \
    -o ExitOnForwardFailure=yes &
  echo $! > "$TUNNEL_PID_FILE"
  echo "==> SSH tunnel started (PID $!)"
  sleep 2
fi

echo "==> Starting Docker services…"
COMPOSE_FILES="-f $REPO_ROOT/docker-compose.yml"
$USE_TUNNEL && COMPOSE_FILES="$COMPOSE_FILES -f $REPO_ROOT/docker-compose.tunnel.yml"
# shellcheck disable=SC2086
docker compose $COMPOSE_FILES up -d

# Ensure print-service venv + deps
if [ ! -f "$PRINT_DIR/.venv/bin/python" ]; then
  echo "==> Creating print-service virtualenv…"
  python3 -m venv "$PRINT_DIR/.venv"
fi
if ! "$PRINT_DIR/.venv/bin/pip" show fastapi &>/dev/null; then
  echo "==> Installing print-service dependencies…"
  "$PRINT_DIR/.venv/bin/pip" install -q -r "$PRINT_DIR/requirements.txt"
fi

# Start print-service if not already running
if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "==> print-service already running (PID $(cat "$PID_FILE"))"
else
  echo "==> Starting print-service…"
  nohup "$PRINT_DIR/.venv/bin/python" "$PRINT_DIR/main.py" \
    >> "$LOG_FILE" 2>&1 &
  echo $! > "$PID_FILE"
  echo "==> print-service started (PID $!), log: $LOG_FILE"
fi

echo "==> Done. Frontend: http://localhost:3000  Backend: http://localhost:8000"
