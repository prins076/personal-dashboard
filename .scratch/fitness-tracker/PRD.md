Status: ready-for-agent

# PRD — Personal Fitness Tracker (Local MyFitnessPal)

## Problem Statement

Tracking calories, macros, water, weight, and exercise requires either a proprietary cloud app (privacy concerns, paywalled features) or manual spreadsheets (slow, no insight). The user wants to log everything naturally by chatting with Claude — "log 200g oats for breakfast", "log 300ml water" — and see the results in a local web dashboard without any account, sync, or remote dependency.

---

## Solution

A fully local fitness tracking app: a FastAPI backend persisting to SQLite, a React dashboard at `localhost:3000`, and a standalone MCP server that lets Claude log entries directly via natural language. All data stays on the user's laptop. No auth, no remote access.

The MCP Log Meal Flow follows a two-step pattern: `search_food` returns candidates with per-100g macros → Claude presents the macro breakdown to the user for confirmation/editing → `log_meal` inserts the confirmed values. Macros are always explicit at insert time; the server never infers them.

---

## User Stories

### Natural-language logging via Claude (MCP)

1. As a user, I want to tell Claude "log 150g of chicken breast for lunch" so that the meal is added to today's log without opening a browser.
2. As a user, I want Claude to search Open Food Facts for a food before logging it, so that I get accurate per-100g macro data as a starting point.
3. As a user, I want Claude to show me the resolved macros before inserting a Meal Entry, so that I can catch bad OFF data and correct it.
4. As a user, I want to tell Claude the quantity in any unit (g, ml, cup, tbsp) so that I don't have to convert to grams myself.
5. As a user, I want Claude to handle the unit-to-gram conversion when computing macros, so that the server stays simple and I can say "250ml of milk."
6. As a user, I want to log a meal with fully custom macros (no OFF lookup) so that I can handle homemade dishes or restaurant meals.
7. As a user, I want to save a custom food ("Mom's lasagna, 350 kcal per 200g") once and reuse it in future logs, so that I don't re-enter macros every time.
8. As a user, I want `search_food` to return my saved Custom Foods before OFF results, so that my personal entries are easy to find.
9. As a user, I want to tell Claude "log 300ml of water" so that my water intake is recorded immediately.
10. As a user, I want to tell Claude "I weighed 78.2kg this morning" so that today's weight is recorded.
11. As a user, I want Claude to refuse a second weight log for today and show me the existing value, so that my morning weigh-in isn't accidentally overwritten.
12. As a user, I want to delete today's weight entry via Claude so that I can then re-log a corrected value.
13. As a user, I want to tell Claude "I did 30 minutes of running" so that the exercise is logged with the correct category.
14. As a user, I want to ask Claude "what have I eaten today?" so that I get a full dashboard snapshot including totals vs goals.
15. As a user, I want to ask Claude "show me my weight trend" so that I see min/max/avg and trend direction over the last 30 days.
16. As a user, I want to update my calorie or macro goals by telling Claude, so that progress tracking reflects my current targets.
17. As a user, I want Claude to always receive the current local date so that entries land on the correct calendar date even if my WSL2 timezone differs from UTC.

### Dashboard (web UI)

18. As a user, I want to see a calorie progress ring on the dashboard, so that I can see at a glance how close I am to my daily goal.
19. As a user, I want to see a macro pie chart on the dashboard, so that I understand my protein/carbs/fat split for today.
20. As a user, I want to see a water progress bar on the dashboard, so that I can track hydration without opening a separate view.
21. As a user, I want quick-add buttons on the water bar (e.g. +250ml, +500ml) so that I can log water in one click.
22. As a user, I want to see today's meal list on the dashboard grouped by meal type, so that I can review what I've logged.
23. As a user, I want to see my latest weight and a delta from the previous entry on the dashboard, so that I notice trends immediately.
24. As a user, I want to see an exercise summary for today on the dashboard, so that I can confirm workouts were logged.

### Nutrition page

25. As a user, I want to see all Meal Entries for today grouped by meal type on the Nutrition page, so that I can review my full intake.
26. As a user, I want to open a food search modal, type a food name, and see results from my saved foods and OFF, so that I can find the right food quickly.
27. As a user, I want to enter the quantity and unit in the food search modal, so that the macro breakdown updates accordingly.
28. As a user, I want to edit the resolved macros in the modal before confirming, so that I can correct inaccurate OFF data before it's saved.
29. As a user, I want to pick the meal type (breakfast/lunch/dinner/snack) in the modal, so that the entry lands in the right section.
30. As a user, I want to delete a Meal Entry from the Nutrition page, so that I can remove accidental logs.
31. As a user, I want to edit a Meal Entry's quantity or macros after logging, so that I can correct mistakes without deleting and re-adding.

### Exercise page

32. As a user, I want to see all exercise entries for today on the Exercise page, so that I can confirm what was logged.
33. As a user, I want to add an exercise via a modal (name, category, duration, sets/reps, weight, distance), so that I can log workouts from the browser.
34. As a user, I want to delete an exercise entry, so that I can remove accidental logs.

### Progress page

35. As a user, I want to see a 30-day weight line chart on the Progress page, so that I can visualise my trend over time.
36. As a user, I want to see a 7-day calorie bar chart showing this calendar week (Mon–Sun), so that I can see how consistent I've been.
37. As a user, I want future days in the calendar week chart to appear as empty bars, so that the chart always shows a full week shape.
38. As a user, I want to edit my nutritional goals (calories, protein, carbs, fat, fiber, water, target weight) on the Progress page, so that targets reflect my current plan.
39. As a user, I want goal changes to persist immediately, so that the dashboard reflects the new targets on the next visit.

### History page

40. As a user, I want a paginated history table with tabs for meals, water, exercise, and weight, so that I can review past entries.
41. As a user, I want to filter history by date on the History page, so that I can look up a specific day's log.

---

## Implementation Decisions

### Schema

- `meal_entries` stores `quantity REAL` and `unit TEXT` (e.g. 250, "ml") rather than `quantity_g`. Macros are stored as absolute values at log time and never recomputed. See ADR-0002.
- `foods.off_id` is nullable — Custom Foods have `off_id = NULL`.
- `weight_entries.date` has a `UNIQUE` constraint. Inserts use plain `INSERT` (not `ON CONFLICT DO UPDATE`) — first write wins. A duplicate insert returns an error containing the existing value.
- `user_goals` is a singleton row (`id=1`) initialised with defaults at DB creation. `GET /api/goals` always returns a row.
- All `date` columns store local date as `YYYY-MM-DD` text. The server uses the caller-supplied date; falls back to `date.today()` only when no date is provided.

### MCP Server (9 tools)

- `search_food(query, limit=5)` — queries local `foods` table first, then OFF. Returns typed errors: `OFF_UNREACHABLE` or `NO_RESULTS`. Never serves stale cache on failure.
- `log_meal(food_name, meal_type, quantity, unit, calories, protein_g, carbs_g, fat_g, fiber_g, date?, food_id?, notes?)` — requires all macros explicitly. Never calls `search_food` internally. See ADR-0001.
- `create_food(name, brand?, calories, protein_g, carbs_g, fat_g, fiber_g, serving_g?)` — inserts a Custom Food with `off_id = NULL`.
- `log_water(amount_ml, date?, notes?)` — returns entry + daily total vs goal.
- `log_weight(weight_kg, date?, notes?)` — returns error with existing value if date already has a record.
- `log_exercise(name, category, date?, duration_min?, sets?, reps?, weight_kg?, distance_km?, calories_burned?, notes?)` — category enum: cardio | strength | flexibility | other.
- `get_today_summary(date?)` — full dashboard snapshot + all entries for the date.
- `get_weight_trend(days=30)` — entries + min/max/avg/trend direction.
- `update_goals(any goal field)` — partial update on the singleton goals row.

Claude is responsible for unit-to-gram conversion when computing macros before calling `log_meal`. The server has no unit conversion logic.

### REST API

- `GET /api/dashboard/week` returns Mon–Sun of the current calendar week; future days are `null` (not omitted).
- `GET /api/food/search?q=...` queries local `foods` table first, then OFF.
- `PATCH /api/meals/:id` supports partial updates (quantity, unit, macros).
- CORS allows `http://localhost:3000`.

### Frontend — Food Search Modal

The modal follows the edit-before-log pattern: search → pick result → enter quantity + unit → see editable macro breakdown (defaulting to OFF-scaled values) → confirm. Macros are never inserted without this confirmation step. This mirrors the MCP Macro Confirmation flow.

### Open Food Facts Integration

- Search endpoint: `world.openfoodfacts.org/cgi/search.pl` with `json=1`.
- Products missing `energy-kcal_100g` are skipped.
- Cache TTL: 7 days. Stale cache is never served on failure — failure returns a typed error.
- User-Agent: `FitnessTracker/1.0`.
- Async (`httpx.AsyncClient`) in FastAPI; sync (`httpx.Client`) in MCP server.

### MCP Registration

The MCP server is registered in `.claude/settings.json` as a stdio server launched via `uv run`. It opens `fitness.db` directly and is independent of FastAPI.

---

## Testing Decisions

A good test verifies observable behaviour through the module's public interface — not implementation details like which SQL query was used or how many times a helper was called. Tests should pass against a real SQLite DB (no mocking the DB layer), since mock/real divergence has caused silent failures in the past.

### Modules to test

**`off_client.py`**
- Returns correct per-100g macros for a known product.
- Skips products missing `energy-kcal_100g`.
- Returns `OFF_UNREACHABLE` error on network failure (mock HTTP at the transport level, not at the db level).
- Returns `NO_RESULTS` when OFF returns an empty product list.
- Local-first: returns cached food without hitting OFF when a fresh cache entry exists.

**`routers/weight.py`**
- First log of the day succeeds and returns the entry.
- Second log attempt on the same date returns a typed error containing the existing weight value.
- Delete + re-log succeeds.
- `GET /api/weight?days=30` returns entries in date order.

**`mcp_server.py`**
- All 9 tools are registered (tool name list matches the expected set).
- `log_meal` with missing macros returns a validation error (does not fall back to search).
- `log_weight` returns an error on duplicate date (real SQLite DB, not mocked).

---

## Out of Scope

- Authentication or multi-user support.
- Remote access or cloud sync.
- Barcode scanning.
- Meal planning or recipe builder.
- Automatic calorie burn estimation from wearables.
- Push notifications or reminders.
- Data export (CSV, JSON).
- Mobile app.
- Offline PWA.

---

## Further Notes

- The app runs continuously on a local laptop. `start.sh` starts both uvicorn (`:8000`) and the Vite dev server (`:3000`).
- For Claude Desktop, the same MCP block from `.claude/settings.json` can be copied to `~/.claude/settings.json`.
- SQLite WAL mode is set on every connection (not just init) to handle concurrent reads from the MCP server and FastAPI without locking issues.
- The `foods` table grows unboundedly — there is no cache eviction. This is intentional for a personal local app.
