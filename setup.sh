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

echo "==> Patching .claude/settings.json with actual paths"
cat > "$ROOT/.claude/settings.json" << SETTINGS
{
  "mcpServers": {
    "fitness": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "$ROOT/backend",
        "--project",
        "$ROOT/backend",
        "python",
        "-m",
        "fitness.mcp_server"
      ],
      "env": {
        "FITNESS_DB_PATH": "$ROOT/backend/data/fitness.db"
      }
    }
  }
}
SETTINGS

echo "Done. Run ./start.sh to launch both servers."
