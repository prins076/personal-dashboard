# ADR 0002 — meal_entries stores quantity + unit, not quantity_g

## Status
Accepted

## Context
The initial schema used `quantity_g REAL` — everything measured in grams. This breaks for liquids (ml), cooking ingredients (tbsp, cup), and any food users naturally measure in non-gram units.

## Decision
`meal_entries` stores `quantity REAL` and `unit TEXT` (e.g. 250, "ml"). Macros are always explicit and stored at log time, so the server never needs to re-derive quantity in grams. Unit-to-gram conversion for macro scaling is Claude's responsibility in the natural-language flow.

## Consequences
- Schema is more expressive; display matches what the user actually said ("250 ml" not "258 g").
- Server has no unit conversion logic — that complexity lives in Claude's domain knowledge.
- Stored macros remain authoritative regardless of unit; changing the unit of a logged entry would require re-logging.
