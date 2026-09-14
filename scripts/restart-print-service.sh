#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PRINT_DIR="$REPO_ROOT/print-service"
PID_FILE="$REPO_ROOT/.print-service.pid"
LOG_FILE="$PRINT_DIR/print-service.log"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    kill "$(cat "$PID_FILE")"
    sleep 1
    echo "Stopped print-service (PID $(cat "$PID_FILE"))"
fi

set -a; source "$REPO_ROOT/.env"; set +a

nohup "$PRINT_DIR/.venv/bin/python" "$PRINT_DIR/main.py" >> "$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "Started print-service (PID $!)"
echo "Log: $LOG_FILE"
