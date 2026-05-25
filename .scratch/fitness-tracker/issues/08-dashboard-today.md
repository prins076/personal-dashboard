Status: ready-for-agent

# 08 — Dashboard today — full view

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

Wire the Dashboard page into a complete today-at-a-glance view once all data sources exist. This slice integrates the outputs of issues 04–07 into a single polished page.

**Backend:** `GET /api/dashboard/today` already exists from issue 04 (meals portion). Extend it to also return: water total + goal percentage, latest weight entry + delta from previous, exercise summary (total duration, total calories burned). The response is the single source of truth for the dashboard page.

**Frontend — Dashboard page:**
- Calorie SVG progress ring (today's calories vs goal).
- Macro `PieChart` (Recharts) showing protein / carbs / fat split.
- Water progress bar with quick-add buttons (already built in issue 05 — wire it to the dashboard data).
- Today's Meal Entry list grouped by meal type, read from the dashboard response.
- Weight widget: latest weight + delta from previous entry.
- Exercise summary: today's entries (name + duration).

All sections load from a single `GET /api/dashboard/today` call on mount. Each quick-add button re-fetches the endpoint after posting.

## Acceptance criteria

- [ ] `GET /api/dashboard/today` returns calorie totals, macro totals, water total, latest weight, and exercise summary in one response
- [ ] Calorie progress ring displays the correct percentage vs the goal
- [ ] Macro pie chart segments match today's protein/carbs/fat totals
- [ ] Water bar reflects today's logged water
- [ ] Weight widget shows the latest weight and the delta from the previous entry
- [ ] Exercise summary lists today's exercises
- [ ] All widgets update after logging a new entry (meal, water, or exercise) without a full page reload

## Blocked by

- `01-project-scaffold`
- `04-meal-logging`
- `05-water-logging`
- `06-weight-logging`
- `07-exercise-logging`
