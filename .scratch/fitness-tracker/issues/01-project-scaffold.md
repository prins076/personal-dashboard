Status: ready-for-agent

# 01 — Project scaffold

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

Bootstrap the full project structure so every subsequent slice has a working foundation to build on. This slice contains no business logic — only wiring.

**Backend:** initialise a `uv` project under `backend/` with FastAPI, uvicorn, httpx, pydantic, and mcp as dependencies. Create `db.py` that opens SQLite with WAL mode and foreign keys on every connection, runs the full schema (all six tables: `foods`, `meal_entries`, `water_entries`, `weight_entries`, `exercise_entries`, `user_goals`), and seeds the singleton goals row. Create `main.py` with CORS allowing `http://localhost:3000` and an empty router mount structure.

**Frontend:** initialise a Vite + React 19 + TypeScript project under `frontend/`. Install Tailwind v4 (plugin: `@tailwindcss/vite`, CSS entry uses `@import "tailwindcss"`), react-router-dom v6, and Recharts. Configure the Vite proxy so `/api` → `http://localhost:8000`. Create a stub `api/client.ts` with a typed base fetch wrapper. Add placeholder page components for Dashboard, Nutrition, Exercise, Progress, and History with routes wired up.

**Scripts:** `setup.sh` (one-time: `uv sync`, `npm install`, `init_db`) and `start.sh` (runs uvicorn on `:8000` and `vite` on `:3000` concurrently, trap on Ctrl-C).

**MCP stub:** create `.claude/settings.json` registering the `fitness` MCP server (stdio, launched via `uv run python -m fitness.mcp_server`, with `FITNESS_DB_PATH` env var pointing at `backend/data/fitness.db`).

## Acceptance criteria

- [ ] `./setup.sh` completes without error on a clean checkout
- [ ] `./start.sh` starts both servers; `curl -s http://localhost:8000/docs` returns an OpenAPI response
- [ ] `curl -s http://localhost:3000` returns the React app HTML
- [ ] `npm run build` inside `frontend/` produces zero TypeScript errors
- [ ] All six DB tables exist after running `init_db`; `user_goals` row with id=1 is present
- [ ] Navigating to each route in the browser renders a placeholder without a crash

## Blocked by

None — can start immediately.
