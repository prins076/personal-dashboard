# ADR 0003 — Weight entries are first-write-wins per calendar date; no PATCH

## Status
Accepted

## Context
Daily weight is a measurement, not an estimate — once logged it should represent what the scale actually read that morning. Both Claude (via MCP) and the frontend can issue POST requests, so without a guard it would be easy to accidentally overwrite a value the user already confirmed, silently corrupting trend chart data.

A `PATCH /api/weight/{id}` endpoint was considered as a way to allow corrections.

## Decision
`weight_entries` has a `UNIQUE(date)` constraint. A duplicate POST returns HTTP 409 carrying the existing record so the caller can surface the conflict to the user. There is no PATCH endpoint. To correct a mistaken entry the user must explicitly delete it first, then re-log.

## Consequences
- Accidental overwrites by Claude or the frontend are impossible — conflict always surfaces as a visible 409.
- Correction requires a conscious two-step action (delete → re-log), preventing silent data mutation.
- The 409 response body includes the existing entry, so callers can show the user what is already logged without an extra GET.
- Trend chart data is trustworthy: no entry can be silently revised after the fact.
