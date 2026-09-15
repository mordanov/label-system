#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$REPO_ROOT/.print-service.pid"

# Stop print-service
if [ -f "$PID_FILE" ]; then
  PID="$(cat "$PID_FILE")"
  if kill -0 "$PID" 2>/dev/null; then
    echo "==> Stopping print-service (PID $PID)…"
    kill "$PID" || true
  else
    echo "==> print-service not running (stale PID file)"
  fi
  rm -f "$PID_FILE"
else
  echo "==> print-service not running"
fi

echo "==> Stopping Docker services…"
docker-compose -f "$REPO_ROOT/docker-compose.yml" down

echo "==> Done."
