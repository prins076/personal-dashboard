#!/usr/bin/env bash
# Start FastAPI (uvicorn :8000) + Vite (:3000) concurrently. Ctrl-C stops both.
set -euo pipefail

# Ensure WSL node (via nvm) takes precedence over any Windows node in PATH
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

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

(until bash -c 'echo >/dev/tcp/localhost/3000' 2>/dev/null; do sleep 0.5; done && explorer.exe "http://localhost:3000") &

wait
