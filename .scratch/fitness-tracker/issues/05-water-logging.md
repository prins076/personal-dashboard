Status: ready-for-agent

# 05 — Water logging — API + dashboard bar

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

Water intake tracking end-to-end: REST CRUD, a daily total vs goal response, and the dashboard water progress bar with quick-add buttons.

**Backend:**
- `POST /api/water` — accepts `amount_ml`, `date?`, `notes?`. Uses caller-supplied date or falls back to `date.today()`.
- `GET /api/water?date=YYYY-MM-DD` — returns all entries for the date plus a `daily_total_ml` and percentage of the water goal.
- `DELETE /api/water/:id` — hard delete.

**Frontend — Dashboard water section:**
- Horizontal progress bar showing daily water total vs the goal from `GET /api/goals`.
- Quick-add buttons for common amounts (+150ml, +250ml, +500ml) that call `POST /api/water` and refresh the bar immediately.

## Acceptance criteria

- [ ] `POST /api/water` returns the created entry and the updated `daily_total_ml`
- [ ] `GET /api/water?date=today` returns all entries for the date and the correct total
- [ ] `DELETE /api/water/:id` removes the entry; total decreases accordingly
- [ ] Dashboard water bar reflects the current daily total on load
- [ ] Clicking a quick-add button updates the bar without a full page reload

## Blocked by

- `01-project-scaffold`
