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

## User Profile
A singleton record (`user_profile` table, always `id=1`) storing biometric stats: `age` (integer years), `sex` (`male` | `female`), `height_cm` (real), and `activity_level` (`sedentary` | `lightly_active` | `moderately_active` | `very_active` | `extra_active`). All fields are nullable — the profile starts empty and is built up via `PATCH /api/profile`. These values feed the Mifflin-St Jeor calorie goal calculator.

## TDEE (Total Daily Energy Expenditure)
Estimated daily calorie burn derived from the User Profile using the Mifflin-St Jeor formula: BMR = 10×weight_kg + 6.25×height_cm − 5×age + (5 for male, −161 for female), multiplied by an activity-level factor (1.2–1.9). Computed client-side in `utils/mifflin.ts` and surfaced in the Settings page as a suggested calorie goal. The user can accept or override it — the stored `calorie_goal` in Goals is independent of the TDEE calculation.

## Goals
A singleton record (`goals` table) storing daily intake targets: `calorie_goal`, `protein_goal_g`, `carbs_goal_g`, `fat_goal_g`, `fiber_goal_g`, `water_goal_ml`, and `weight_goal_kg`. All fields are nullable and partially updatable via `PATCH /api/goals`. The dashboard compares actual intake against these values to compute percentage progress.

## Exercise Entry
A single logged workout activity. Has a `name`, a `category` (`cardio` | `strength` | `flexibility` | `other`), and an optional mix of fields depending on category: `duration_min`, `sets`, `reps`, `weight_kg` (load lifted), `distance_km`, `calories_burned`, and `notes`. All metric fields are optional — a strength session may only record sets/reps/weight, a cardio session may only record duration/distance. Logged via `POST /api/exercise` or the `log_exercise` MCP tool.
