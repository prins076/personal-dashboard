Status: ready-for-agent

# 07 — Exercise logging — API + Exercise page

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

Exercise tracking end-to-end: REST CRUD and an Exercise page with an add modal.

**Backend:**
- `POST /api/exercise` — accepts `name`, `category` (cardio | strength | flexibility | other), `date?`, `duration_min?`, `sets?`, `reps?`, `weight_kg?`, `distance_km?`, `calories_burned?`, `notes?`. Uses caller-supplied date or falls back to `date.today()`.
- `GET /api/exercise?date=YYYY-MM-DD` — returns all entries for the date.
- `DELETE /api/exercise/:id` — hard delete.
- `PATCH /api/exercise/:id` — partial update of any field.

**Frontend — Exercise page:**
- Lists today's exercise entries (name, category, duration, key stats).
- Add modal with fields for name, category selector, duration, sets/reps, weight, distance, calories burned, and notes.
- Delete button on each entry.

## Acceptance criteria

- [ ] `POST /api/exercise` returns the created entry with `id` and `logged_at`
- [ ] `GET /api/exercise?date=today` returns the posted entry
- [ ] `DELETE /api/exercise/:id` removes the entry
- [ ] `PATCH /api/exercise/:id` updates only the supplied fields
- [ ] Exercise page lists today's entries on load
- [ ] Add modal submits and the new entry appears in the list without a page reload
- [ ] `category` values outside the enum return HTTP 422

## Blocked by

- `01-project-scaffold`
