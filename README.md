# Personal Fitness Tracker

A local fitness tracking web app. Track calories/macros, water, weight, and exercise — log everything by chatting naturally with Claude via MCP tools. Runs on localhost; no auth, no remote access.

## Architecture

```
personal-dashboard/
├── start.sh                  # starts backend + frontend dev server
├── setup.sh                  # one-time install
├── .claude/
│   └── settings.json         # MCP server registration (stdio)
├── backend/
│   ├── pyproject.toml        # uv project (FastAPI, uvicorn, httpx, pydantic, mcp)
│   └── src/fitness/
│       ├── db.py             # SQLite init + WAL mode
│       ├── models.py         # Pydantic schemas
│       ├── main.py           # FastAPI app, CORS, mounts routers
│       ├── off_client.py     # Open Food Facts API + foods cache
│       ├── routers/          # meals, water, weight, exercise, dashboard, food_search, goals
│       └── mcp_server.py     # Standalone MCP stdio server
└── frontend/
    ├── package.json          # React 19, Vite 7, Tailwind 4, Recharts, react-router-dom v6
    └── src/
        ├── api/client.ts     # typed fetch wrappers
        ├── pages/            # Dashboard, Nutrition, Exercise, Progress, History
        └── components/       # MacroPieChart, WeightLineChart, CalorieBarChart, WaterProgressBar, …
```

## Setup & Run

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
./start.sh   # launches uvicorn :8000 + vite :3000
```

Open `http://localhost:3000`. API docs at `http://localhost:8000/docs`.

## REST API (port 8000)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/dashboard/today` | Totals vs goals, pct progress |
| GET | `/api/dashboard/week` | Calendar week (Mon–Sun); future days returned as null |
| GET/POST/DELETE/PATCH | `/api/meals` | `?date=YYYY-MM-DD` |
| GET | `/api/food/search?q=…&limit=10` | Calls OFF, upserts cache |
| GET/POST/DELETE | `/api/water` | |
| GET/POST/DELETE | `/api/weight` | `?days=30` |
| GET/POST/DELETE/PATCH | `/api/exercise` | |
| GET/PATCH | `/api/goals` | Partial update (singleton upsert) |

## MCP Server (stdio, port-less)

Opens `fitness.db` directly — independent of FastAPI.

| Tool | Key params |
|------|-----------|
| `search_food` | `query`, `limit=5` |
| `log_meal` | `food_name`, `meal_type`, `quantity`, `unit`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `date?` |
| `create_food` | `name`, `brand?`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `serving_g?` |
| `log_water` | `amount_ml`, `date?`, `notes?` |
| `log_weight` | `weight_kg`, `date?`, `notes?` |
| `log_exercise` | `name`, `category`, `date?`, `duration_min?`, `sets?`, `reps?`, `weight_kg?`, `distance_km?`, `calories_burned?` |
| `get_today_summary` | `date?` |
| `get_weight_trend` | `days=30` |
| `update_goals` | any goal field |

**MCP registration** (`.claude/settings.json`):

`setup.sh` writes the correct absolute paths into `.claude/settings.json` automatically. For Claude Desktop or a manual setup, use the block below — replace `/path/to/personal-dashboard` with your actual clone path:

```json
{
  "mcpServers": {
    "fitness": {
      "command": "uv",
      "args": ["run", "--directory", "/path/to/personal-dashboard/backend",
               "--project", "/path/to/personal-dashboard/backend",
               "python", "-m", "fitness.mcp_server"],
      "env": {
        "FITNESS_DB_PATH": "/path/to/personal-dashboard/backend/data/fitness.db"
      }
    }
  }
}
```
