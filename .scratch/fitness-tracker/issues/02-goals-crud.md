Status: ready-for-agent

# 02 — Goals CRUD + frontend editor

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

A thin slice that lets the user view and update their nutritional targets both via the REST API and in the browser.

**Backend:** implement `GET /api/goals` (always returns the singleton row) and `PATCH /api/goals` (partial update — only supplied fields are changed; `updated_at` is set to now). The singleton row is guaranteed to exist by the DB seed in issue 01.

**Frontend:** add a goals editor section to the Progress page. It fetches current goals on mount, renders labelled number inputs for calorie goal, protein, carbs, fat, fiber, water, and target weight, and saves on submit via `PATCH /api/goals`. Changes persist immediately — a page refresh shows the updated values.

## Acceptance criteria

- [ ] `GET /api/goals` returns the default goals object (calorie_goal=2000, etc.)
- [ ] `PATCH /api/goals` with a subset of fields updates only those fields; others are unchanged
- [ ] The Progress page goals editor renders with the current saved values
- [ ] Editing a goal and saving updates the displayed value without a full page reload
- [ ] A page refresh after saving shows the new values (confirming persistence)

## Blocked by

- `01-project-scaffold`
