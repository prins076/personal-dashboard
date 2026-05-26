# Personal Fitness Tracker (Local MyFitnessPal)

## Context
Build a local fitness tracking web app from scratch in an empty repo. The user wants to track calories/macros, water, weight, and exercise — and log everything by chatting naturally with Claude Desktop or Claude Code CLI via MCP tools. The app runs continuously on a local laptop; no auth, no remote access.

---

## Architecture

```
personal-dashboard/
├── start.sh                  # starts backend + frontend dev server
├── setup.sh                  # one-time install
├── .claude/
│   └── settings.json         # MCP server registration (stdio)
├── backend/
│   ├── pyproject.toml        # uv project (FastAPI, uvicorn, httpx, pydantic, mcp)
│   ├── src/fitness/
│   │   ├── db.py             # SQLite init + WAL mode + shared connection helper
│   │   ├── models.py         # Pydantic request/response schemas
│   │   ├── main.py           # FastAPI app, CORS, mounts routers
│   │   ├── off_client.py     # Open Food Facts API + foods cache
│   │   ├── routers/
│   │   │   ├── meals.py
│   │   │   ├── water.py
│   │   │   ├── weight.py
│   │   │   ├── exercise.py
│   │   │   ├── dashboard.py
│   │   │   ├── food_search.py
│   │   │   └── goals.py
│   │   └── mcp_server.py     # Standalone MCP stdio server (no FastAPI dep)
│   └── data/
│       └── fitness.db        # SQLite DB (gitignored)
└── frontend/
    ├── package.json          # React 19, Vite 7, Tailwind 4, Recharts >=2.13, react-router-dom v6
    ├── vite.config.ts        # proxy /api → localhost:8000
    └── src/
        ├── api/client.ts     # typed fetch wrappers
        ├── pages/            # Dashboard, Nutrition, Exercise, Progress
        └── components/       # MacroPieChart, WeightLineChart, CalorieBarChart, WaterProgressBar, ...
```

---

## Database (SQLite, `backend/data/fitness.db`)

```sql
PRAGMA journal_mode = WAL;   -- set on every connection, not just init
PRAGMA foreign_keys = ON;

CREATE TABLE foods (           -- OFF search cache (upsert by off_id)
  id INTEGER PRIMARY KEY, off_id TEXT UNIQUE, name TEXT, brand TEXT,
  serving_g REAL, calories REAL, protein_g REAL, carbs_g REAL,
  fat_g REAL, fiber_g REAL, cached_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE meal_entries (    -- one row per food item logged
  id INTEGER PRIMARY KEY, logged_at TEXT, date TEXT,  -- YYYY-MM-DD local
  meal_type TEXT CHECK(meal_type IN ('breakfast','lunch','dinner','snack')),
  food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
  food_name TEXT, quantity REAL, unit TEXT,  -- e.g. 250, "ml" or 150, "g"
  calories REAL, protein_g REAL, carbs_g REAL, fat_g REAL, fiber_g REAL,
  notes TEXT
);

CREATE TABLE water_entries (id, logged_at, date, amount_ml, notes);

CREATE TABLE weight_entries (id, logged_at, date UNIQUE, weight_kg, notes);
-- date UNIQUE enforces first-write-wins: INSERT fails if date already exists; caller must DELETE first

CREATE TABLE exercise_entries (
  id INTEGER PRIMARY KEY, logged_at TEXT, date TEXT, name TEXT,
  category TEXT CHECK(category IN ('cardio','strength','flexibility','other')),
  duration_min INTEGER, sets INTEGER, reps INTEGER,
  weight_kg REAL, distance_km REAL, calories_burned REAL, notes TEXT
);

CREATE TABLE user_goals (      -- singleton row id=1
  id INTEGER PRIMARY KEY CHECK(id=1),
  calorie_goal REAL DEFAULT 2000, protein_goal_g REAL DEFAULT 150,
  carbs_goal_g REAL DEFAULT 200, fat_goal_g REAL DEFAULT 65,
  fiber_goal_g REAL DEFAULT 30, water_goal_ml REAL DEFAULT 2500,
  weight_goal_kg REAL, updated_at TEXT
);
INSERT OR IGNORE INTO user_goals (id) VALUES (1);
```

Weight uses plain `INSERT` — first write wins. If a record already exists for the date, `log_weight` returns an error containing the existing value; the user must explicitly delete before re-logging. Macros are stored computed at log time so history is not affected by cache changes.

---

## REST API (FastAPI, port 8000)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/dashboard/today` | Totals vs goals, pct progress |
| GET | `/api/dashboard/week` | Calendar week (Mon–Sun); future days returned as null |
| GET/POST/DELETE/PATCH | `/api/meals` | `?date=YYYY-MM-DD` |
| GET | `/api/food/search?q=...&limit=10` | Calls OFF, upserts cache, returns results |
| GET/POST/DELETE | `/api/water` | |
| GET/POST/DELETE | `/api/weight` | `?days=30` |
| GET/POST/DELETE/PATCH | `/api/exercise` | |
| GET/PATCH | `/api/goals` | Partial update (singleton upsert) |

CORS: allow `http://localhost:3000`.

---

## MCP Server (`mcp_server.py`, stdio transport)

Opens `fitness.db` directly — independent of FastAPI. Calls Open Food Facts directly via `httpx.Client` (sync). Calls `init_db()` at startup so it works standalone.

**9 tools:**

| Tool | Key params | Returns |
|------|-----------|---------|
| `search_food` | `query`, `limit=5` | list of foods with per-100g macros; queries local `foods` table first, then OFF |
| `log_meal` | `food_name`, `meal_type`, `quantity`, `unit`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `date?`, `food_id?`, `notes?` | logged entry + macros |
| `create_food` | `name`, `brand?`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `serving_g?` | saved food entry (off_id=NULL) |
| `log_water` | `amount_ml`, `date?`, `notes?` | entry + daily total vs goal |
| `log_weight` | `weight_kg`, `date?`, `notes?` | entry or error if date already has a record |
| `log_exercise` | `name`, `category`, `date?`, `duration_min?`, `sets?`, `reps?`, `weight_kg?`, `distance_km?`, `calories_burned?`, `notes?` | logged entry |
| `get_today_summary` | `date?` | full dashboard snapshot + all entries |
| `get_weight_trend` | `days=30` | entries + min/max/avg/trend direction |
| `update_goals` | any goal field | updated goals object |

`log_meal` behaviour: macros are always caller-supplied — there is no internal food search. The intended flow is: call `search_food` → Claude confirms macros with user (editing quantity/unit as needed, handling unit conversion) → call `log_meal` with explicit values. `search_food` returns an error with type `OFF_UNREACHABLE` or `NO_RESULTS` on failure; it never falls back to stale cache.

---

## Open Food Facts Integration (`off_client.py`)

- Search: `GET https://world.openfoodfacts.org/cgi/search.pl?search_terms={q}&json=1&page_size={limit}&fields=product_name,brands,nutriments,product_id`
- Extract `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g` from `nutriments`
- Skip products missing `energy-kcal_100g`
- Upsert into `foods` table; re-fetch if `cached_at` > 7 days old
- User-Agent: `FitnessTracker/1.0`
- Used async (`httpx.AsyncClient`) in FastAPI routers; sync (`httpx.Client`) in MCP server

---

## Frontend (React + Vite + Tailwind + Recharts)

**Pages (react-router-dom v6):**
- `/` — **Dashboard**: calorie SVG progress ring, macro `PieChart`, water bar with quick-add buttons, today's meal list, weight widget, exercise summary
- `/nutrition` — meal log by meal_type with food search modal (calls `/api/food/search`); after picking a result and entering quantity+unit, user sees editable macro breakdown before confirming
- `/exercise` — exercise log with add modal
- `/progress` — 30-day weight `LineChart`, 7-day calorie `BarChart`, editable goals
- `/history` — paginated table (meals | water | exercise | weight tabs)

Vite proxy: `/api` → `http://localhost:8000` (no env var needed).

**Tailwind v4 notes** (differs from v3):
- CSS entry point uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`)
- Config is optional; use `@theme` in CSS for custom tokens if needed
- Plugin is `@tailwindcss/vite`, not PostCSS — no `postcss.config.js` required
- `tailwind.config.ts` is not needed for basic usage

---

## MCP Registration (`.claude/settings.json`)

```json
{
  "mcpServers": {
    "fitness": {
      "command": "uv",
      "args": ["run", "--project", "/path/to/personal-dashboard/backend",
               "python", "-m", "fitness.mcp_server"],
      "env": {
        "FITNESS_DB_PATH": "/path/to/personal-dashboard/backend/data/fitness.db"
      }
    }
  }
}
```

`db.py` and `mcp_server.py` both read `FITNESS_DB_PATH` env var. For Claude Desktop, copy the same block to `~/.claude/settings.json`.

---

## Build & Run

**One-time setup:**
```bash
# backend
cd backend && uv sync --python 3.12
uv run python -c "from fitness.db import init_db; init_db()"

# frontend
cd frontend && npm install
```

**Daily start:**
```bash
./start.sh   # launches uvicorn :8000 + vite :3000, trap on Ctrl+C
```

Open `http://localhost:3000`. API docs at `http://localhost:8000/docs`.

---

## Verification

Run these checks after each implementation phase:

### Phase 1 — Backend + DB
```bash
cd backend && uv run python -c "from fitness.db import init_db; init_db(); print('DB OK')"
uv run uvicorn fitness.main:app --port 8000 &
curl -s http://localhost:8000/api/goals | python3 -m json.tool  # should return default goals
curl -s http://localhost:8000/docs | grep -q "openapi" && echo "API docs OK"
```

### Phase 2 — Food search + meal logging
```bash
curl -s "http://localhost:8000/api/food/search?q=chicken+breast&limit=3" | python3 -m json.tool
curl -s -X POST http://localhost:8000/api/meals \
  -H "Content-Type: application/json" \
  -d '{"date":"2026-05-25","meal_type":"lunch","food_name":"Chicken breast","quantity_g":150,"calories":247,"protein_g":46.5,"carbs_g":0,"fat_g":5.4,"fiber_g":0}' \
  | python3 -m json.tool
curl -s "http://localhost:8000/api/dashboard/today" | python3 -m json.tool  # calories > 0
```

### Phase 3 — MCP server
```bash
# Verify the module imports and tool registration without starting the stdio loop
cd backend && uv run python -c "
import fitness.mcp_server as s
tools = [t.name for t in s.mcp.list_tools()]
expected = {'search_food','log_meal','log_water','log_weight','log_exercise',
            'get_today_summary','get_weight_trend','update_goals'}
missing = expected - set(tools)
print('PASS' if not missing else f'MISSING: {missing}')
"

# Then in Claude Code CLI, ask: "what fitness tools do you have?"
# Claude should list all 8 tools above.
```

### Phase 4 — Frontend
```bash
cd frontend && npm run build 2>&1 | tail -5  # zero TypeScript errors, build succeeds
# Start dev server and open browser
cd frontend && npm run dev &
# Manually open http://localhost:3000 and verify:
# - Dashboard renders with calorie ring, macro chart, water bar
# - /nutrition page: food search returns results, adding a food updates the meal list
# - /progress page: goals editor saves and persists across refresh
# - /exercise page: add an exercise, it appears in the list
```

### Phase 5 — End-to-end with Claude
```bash
# With start.sh running and MCP server registered:
# In Claude Code CLI, say: "log 300ml of water"
# → Claude should call log_water tool
# → curl http://localhost:8000/api/water?date=$(date +%Y-%m-%d) should show 300ml entry

# In Claude Code CLI, say: "log 200g of oats with milk for breakfast"
# → Claude should call search_food then log_meal
# → Dashboard at http://localhost:3000 should show updated calories/macros
```

### Regression checks after any change
```bash
curl -sf http://localhost:8000/api/dashboard/today > /dev/null && echo "API healthy"
curl -sf http://localhost:3000 > /dev/null && echo "Frontend healthy"
```
