#!/usr/bin/env bash
# Start FastAPI (uvicorn :8000) + Vite (:3000) concurrently. Ctrl-C stops both.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

pids=()

cleanup() {
  trap - INT TERM EXIT
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

echo "==> uvicorn on :8000"
(cd "$ROOT/backend" && uv run uvicorn main:app --port 8000 --host 0.0.0.0 --reload) &
pids+=($!)

echo "==> vite on :3000"
(cd "$ROOT/frontend" && npm run dev -- --host 0.0.0.0) &
pids+=($!)

wait
