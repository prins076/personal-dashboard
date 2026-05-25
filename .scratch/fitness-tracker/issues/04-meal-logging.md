Status: ready-for-agent

# 04 — Meal logging — schema, API, Nutrition page

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

The core food tracking slice. Covers the full path from searching for a food to having a confirmed Meal Entry in the DB, visible on the Nutrition page and reflected in today's calorie/macro totals.

**Backend — `meal_entries` CRUD:**
- `POST /api/meals` — accepts `food_name`, `meal_type`, `quantity`, `unit`, `calories`, `protein_g`, `carbs_g`, `fat_g`, `fiber_g`, `date?`, `food_id?`, `notes?`. Macros are always caller-supplied (never computed server-side). Uses the caller-supplied date or falls back to `date.today()`.
- `GET /api/meals?date=YYYY-MM-DD` — returns all entries for the date, grouped by meal_type.
- `DELETE /api/meals/:id` — hard delete.
- `PATCH /api/meals/:id` — partial update of `quantity`, `unit`, and any macro fields.
- `GET /api/dashboard/today?date=YYYY-MM-DD` — returns calorie/macro totals vs goals and the full meal entry list. Falls back to today if date omitted.

**Frontend — Nutrition page:**
- Displays Meal Entries grouped by meal type (breakfast / lunch / dinner / snack).
- Food search modal follows the edit-before-log pattern: search field → results list (local first, then OFF, via `GET /api/food/search`) → quantity + unit input → editable macro breakdown (pre-filled from OFF-scaled values) → meal type selector → confirm button. Macros are never submitted without passing through the editable breakdown step.
- Delete button on each entry.
- Edit button opens the same modal pre-filled with existing values.

See ADR-0001 (explicit macros on log_meal) and ADR-0002 (quantity + unit schema).

## Acceptance criteria

- [ ] `POST /api/meals` with all required fields returns the created entry with computed `id` and `logged_at`
- [ ] `GET /api/meals?date=today` returns the posted entry grouped under its meal_type
- [ ] `PATCH /api/meals/:id` updates only the supplied fields; others are unchanged
- [ ] `DELETE /api/meals/:id` removes the entry; subsequent GET does not return it
- [ ] `GET /api/dashboard/today` reflects the posted meal's calories and macros in the totals
- [ ] Nutrition page: searching for "oats", picking a result, entering "100 g", shows editable macros before confirming
- [ ] Confirmed meal appears in the Nutrition page list under the correct meal type without a page reload
- [ ] `npm run build` passes with zero TypeScript errors after this slice

## Blocked by

- `01-project-scaffold`
- `03-food-search`
