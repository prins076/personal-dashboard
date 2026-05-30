# ADR 0004 — Goals are set directly; TDEE calculator is an optional helper

## Status
Accepted

## Context
Daily intake targets (calories, macros, water, weight) could be auto-derived from the User Profile via the Mifflin-St Jeor formula and kept in sync automatically. The alternative was to store goals as plain user-editable numbers with no live link to the profile.

Two user types shaped this decision: users who already know their targets (athletes, people tracking on a dietitian's plan) should be able to set goals directly without filling in any profile fields. Less knowledgeable users benefit from a calculator that suggests a starting point.

## Decision
`goals` is a singleton record of plain nullable numbers updated via `PATCH /api/goals`. Goals are never auto-derived from the profile. The Settings page exposes a Mifflin-St Jeor TDEE calculator; if the user accepts the suggestion it writes to `calorie_goal` through the same `PATCH /api/goals` endpoint — the stored value has no provenance link back to the calculation.

## Consequences
- Knowledgeable users can set precise goals immediately, without a profile.
- Less knowledgeable users get a sensible starting point from the calculator.
- Updating profile fields (e.g. logging weight loss progress) never silently shifts goals — the user stays in control.
- Goals and profile can drift apart over time; that is intentional and correct.
