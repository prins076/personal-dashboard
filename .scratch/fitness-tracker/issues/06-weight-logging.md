Status: ready-for-agent

# 06 — Weight logging — first-write-wins, API + progress chart

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

Weight tracking with a strict first-write-wins constraint per calendar date, plus a 30-day progress chart on the Progress page.

**Backend:**
- `POST /api/weight` — accepts `weight_kg`, `date?`, `notes?`. Uses a plain `INSERT` (not `ON CONFLICT DO UPDATE`). If a record already exists for the date, returns HTTP 409 with `{"error": "DATE_ALREADY_LOGGED", "existing": {...entry...}}`. Uses caller-supplied date or falls back to `date.today()`.
- `GET /api/weight?days=30` — returns entries in ascending date order plus `change_from_previous` on each entry.
- `DELETE /api/weight/:id` — hard delete (allows re-logging after deletion).

**Frontend — Progress page 30-day chart:**
- `LineChart` (Recharts) plotting `weight_kg` over the last 30 days.
- Shows only dates that have an entry (no interpolation).

**Tests:**
- First `POST` for a date succeeds and returns the entry.
- Second `POST` for the same date returns HTTP 409 containing the existing entry.
- `DELETE` + second `POST` succeeds (first-write-wins resets after delete).
- `GET /api/weight?days=30` returns entries in date order.

## Acceptance criteria

- [ ] `POST /api/weight` for a new date returns the created entry
- [ ] `POST /api/weight` for an existing date returns HTTP 409 with the existing entry's `weight_kg`
- [ ] `DELETE /api/weight/:id` then `POST` for the same date succeeds
- [ ] `GET /api/weight?days=30` returns entries sorted by date ascending with `change_from_previous`
- [ ] Progress page renders the 30-day weight line chart with real data
- [ ] All four weight router tests pass

## Blocked by

- `01-project-scaffold`
