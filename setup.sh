#!/usr/bin/env bash
# One-time setup: install backend (uv) + frontend (npm) deps, then init DB.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> uv sync (backend)"
cd "$ROOT/backend"
uv sync

echo "==> npm install (frontend)"
cd "$ROOT/frontend"
npm install

echo "==> init_db"
cd "$ROOT/backend"
uv run python -c "from db import init_db; init_db()"

echo "Done. Run ./start.sh to launch both servers."
