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

# Configure printer BLE address if still set to the placeholder
if [ "${PRINTER_BLE_ADDRESS:-}" = "" ] || [ "${PRINTER_BLE_ADDRESS:-}" = "XX:XX:XX:XX:XX:XX" ]; then
  echo "==> PRINTER_BLE_ADDRESS not configured. Scanning for BLE devices…"
  _SCAN=$("$PRINT_DIR/.venv/bin/python" "$PRINT_DIR/ble_scan.py" 2>/dev/tty) || true
  if [ -z "$_SCAN" ]; then
    echo "==> No BLE devices found. Turn on the printer and re-run, or set PRINTER_BLE_ADDRESS in .env manually."
  else
    echo "$_SCAN" | awk -F'\t' '{printf "  %s. %s (%s)\n", $1, $2, $3}'
    printf "==> Enter device number: " > /dev/tty
    read -r _NUM < /dev/tty
    _NAME=$(echo "$_SCAN" | awk -F'\t' -v n="$_NUM" 'NR==n {print $2}')
    if [ -n "$_NAME" ]; then
      sed -i '' "s|^PRINTER_BLE_ADDRESS=.*|PRINTER_BLE_ADDRESS=$_NAME|" "$REPO_ROOT/.env"
      export PRINTER_BLE_ADDRESS="$_NAME"
      echo "==> Printer set to: $PRINTER_BLE_ADDRESS"
    else
      echo "==> Invalid selection. Set PRINTER_BLE_ADDRESS in .env manually."
    fi
  fi
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
