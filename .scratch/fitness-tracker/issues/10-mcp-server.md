Status: ready-for-agent

# 10 — MCP server — all 9 tools + tests

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

A standalone MCP stdio server that lets Claude log and query fitness data directly via natural language, independent of the FastAPI process.

**`mcp_server.py`** opens `fitness.db` directly (path from `FITNESS_DB_PATH` env var, defaulting to `backend/data/fitness.db`), calls `init_db()` at startup, and registers 9 tools:

| Tool | Behaviour |
|------|-----------|
| `search_food(query, limit=5)` | Queries local `foods` table first, then OFF (sync `httpx.Client`). Returns `OFFUnreachableError` or `NoResultsError` on failure — never stale cache. |
| `log_meal(food_name, meal_type, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, date?, food_id?, notes?)` | Inserts a Meal Entry with explicit macros. Never calls `search_food` internally. Uses provided date or `date.today()`. See ADR-0001. |
| `create_food(name, brand?, calories, protein_g, carbs_g, fat_g, fiber_g, serving_g?)` | Inserts a Custom Food with `off_id=NULL`. |
| `log_water(amount_ml, date?, notes?)` | Returns entry + daily total vs goal. |
| `log_weight(weight_kg, date?, notes?)` | Returns HTTP-409-equivalent error with existing entry if date is already logged. |
| `log_exercise(name, category, date?, duration_min?, sets?, reps?, weight_kg?, distance_km?, calories_burned?, notes?)` | Returns logged entry. |
| `get_today_summary(date?)` | Returns full dashboard snapshot (totals + all entries). |
| `get_weight_trend(days=30)` | Returns entries + min/max/avg/trend direction. |
| `update_goals(any goal field)` | Partial update on the singleton goals row. |

Claude is responsible for unit-to-gram conversion when computing macros before calling `log_meal`. The server has no unit conversion logic.

**`.claude/settings.json`** (already stubbed in issue 01) — confirm the MCP registration points at the correct module path and env var.

**Tests:**
- All 9 tool names are present in `mcp.list_tools()`.
- `log_meal` called without macros returns a validation error (does not fall back to search).
- `log_weight` returns an error on duplicate date (real SQLite DB, no mocks).

## Acceptance criteria

- [ ] `uv run python -c "import fitness.mcp_server as s; tools = {t.name for t in s.mcp.list_tools()}; assert tools == {'search_food','log_meal','create_food','log_water','log_weight','log_exercise','get_today_summary','get_weight_trend','update_goals'}, tools; print('PASS')"` prints PASS
- [ ] Calling `log_meal` without `calories` returns a validation error, not a DB insert
- [ ] Calling `log_weight` twice for the same date returns an error containing the existing `weight_kg`
- [ ] In Claude Code CLI with `start.sh` running: "log 300ml of water" triggers `log_water`; subsequent `GET /api/water?date=<today>` shows the 300ml entry
- [ ] All three MCP server tests pass

## Blocked by

- `01-project-scaffold`
- `03-food-search`
- `04-meal-logging`
- `05-water-logging`
- `06-weight-logging`
- `07-exercise-logging`
