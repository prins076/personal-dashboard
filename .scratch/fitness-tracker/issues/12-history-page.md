Status: ready-for-agent

# 12 — History page

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

A paginated history view that lets the user browse past entries across all four tracking categories.

**Frontend — History page (`/history`):**
- Four tabs: Meals, Water, Exercise, Weight.
- Each tab shows a paginated table of entries in reverse-chronological order.
- A date-range filter (from / to date inputs) narrows results for any tab.
- Meals tab columns: date, meal type, food name, quantity + unit, calories, protein, carbs, fat.
- Water tab columns: date, amount (ml), notes.
- Exercise tab columns: date, name, category, duration, sets/reps, weight, distance, calories burned.
- Weight tab columns: date, weight (kg), change from previous, notes.

**Backend:** no new endpoints needed — reuse `GET /api/meals`, `GET /api/water`, `GET /api/exercise`, and `GET /api/weight` with date query params. Add `?start=YYYY-MM-DD&end=YYYY-MM-DD` filtering to each if not already present.

## Acceptance criteria

- [ ] History page renders with four tabs; each tab shows entries from the DB
- [ ] Meals logged in issue 04 appear in the Meals tab
- [ ] Date filter correctly narrows results for all four tabs
- [ ] Pagination works (next/previous page controls, correct entry counts)
- [ ] Empty state is shown when no entries exist for the selected tab and date range

## Blocked by

- `01-project-scaffold`
- `04-meal-logging`
- `05-water-logging`
- `06-weight-logging`
- `07-exercise-logging`
