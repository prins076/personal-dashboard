# Fitness Tracker — Domain Glossary

## Meal Entry
A single logged food item. Has a `meal_type` (breakfast | lunch | dinner | snack), a `quantity` + `unit` (e.g. 250 ml, 150 g), and explicitly stored macros (calories, protein_g, carbs_g, fat_g, fiber_g). Macros are recorded at log time and are not recalculated if the underlying food cache changes.

## Food
A record in the `foods` table representing a food's per-100g nutritional profile. May come from Open Food Facts (has an `off_id`) or be user-defined (off_id = NULL, created via `create_food`). The authoritative source for macro lookup before logging a meal.

## Macro Confirmation
The step between looking up a food and logging a meal. The caller (Claude or the frontend modal) presents the resolved macros to the user, who may edit any value before the entry is committed. Macros are never inserted without passing through this step.

## Log Meal Flow
`search_food` → macro confirmation → `log_meal` with explicit values. `log_meal` never calls `search_food` internally. Unit conversion (e.g. ml → g for macro scaling) is Claude's responsibility, not the server's.

## Serving Unit
The unit a user provides when logging a quantity (e.g. "g", "ml", "cup", "tbsp"). Stored alongside `quantity` for display. Does not affect stored macros, which are always absolute values computed at log time.

## Daily Weight Entry
One weight reading per calendar date. First write wins — a second log attempt on the same date returns an error containing the existing value. The user must explicitly delete the existing entry before re-logging.

## Calendar Week
Monday through Sunday of the current week. Used by the `/api/dashboard/week` endpoint. Future days in the week are returned as null, not omitted.

## Custom Food
A user-defined `Food` with no `off_id`. Created via the `create_food` MCP tool. Appears in `search_food` results (local results are returned before OFF results).

## Open Food Facts (OFF)
The external nutrition database used to look up per-100g macros. Products missing `energy-kcal_100g` are skipped. On failure, `search_food` returns a typed error (`OFF_UNREACHABLE` or `NO_RESULTS`) — it never serves stale cache.
