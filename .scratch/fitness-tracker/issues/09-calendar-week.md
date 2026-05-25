Status: ready-for-agent

# 09 — Calendar week endpoint + calorie bar chart

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

A weekly view of calorie intake aligned to the calendar week (Monday–Sunday), surfaced as a bar chart on the Progress page.

**Backend — `GET /api/dashboard/week`:**
Returns an array of exactly 7 entries, one per day from Monday to Sunday of the current calendar week. Each entry contains: `date`, `calories`, `protein_g`, `carbs_g`, `fat_g`. Future days (after today) have all numeric fields as `null`. Days with no logged meals return `0` (not `null`) for calorie/macro fields.

**Frontend — Progress page calorie bar chart:**
- `BarChart` (Recharts) with 7 bars labelled Mon–Sun.
- Bars for past days with no data show as 0. Bars for future days are visually muted (different fill colour) and show no tooltip value.
- A reference line at the calorie goal value from `GET /api/goals`.

## Acceptance criteria

- [ ] `GET /api/dashboard/week` always returns exactly 7 entries ordered Mon–Sun
- [ ] Future days have `null` for all numeric fields
- [ ] A day with no meals returns `calories: 0` (not `null`)
- [ ] The first day of the array is always Monday of the current calendar week
- [ ] Progress page bar chart renders with today's data visible and future days muted
- [ ] The calorie goal reference line is drawn at the correct value

## Blocked by

- `01-project-scaffold`
- `04-meal-logging`
