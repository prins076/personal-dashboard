# ADR 0001 — log_meal requires explicit macros; no internal food search

## Status
Accepted

## Context
The initial plan had `log_meal` internally call `search_food` when macros were not provided, picking the top OFF result and scaling by quantity. This made the tool convenient but silently inserted data the user never confirmed — a risk given OFF's inconsistent data quality.

## Decision
`log_meal` always requires caller-supplied macros. It never calls `search_food` internally. The intended call sequence is: `search_food` → Claude presents macros to user for confirmation/editing → `log_meal` with explicit values.

## Consequences
- One extra step for the natural-language flow, handled transparently by Claude.
- Users can always override any macro value before committing.
- `log_meal` is a pure insert with no side effects — easier to test and reason about.
- Homemade or off-network meals are handled identically: supply macros directly.
