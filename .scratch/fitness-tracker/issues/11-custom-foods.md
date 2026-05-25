Status: ready-for-agent

# 11 — Custom foods (`create_food` + local-first search)

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

Lets the user save Custom Foods (homemade meals, frequently-used items) once and reuse them across future Meal Entries — both via the MCP flow and the frontend modal.

**What changes:**
- The `create_food` MCP tool (already registered in issue 10) is fully implemented: inserts a row into `foods` with `off_id=NULL`, `name`, optional `brand`, per-100g macros, and optional `serving_g`.
- `GET /api/food/search` (built in issue 03) already queries local `foods` first. Confirm that Custom Foods (off_id=NULL) are included in local results and appear before OFF results.
- The frontend food search modal (built in issue 04) already consumes the unified search response. Confirm that Custom Foods appear with a visual indicator (e.g. "Saved" badge) so the user can distinguish them from OFF results.

This slice is primarily about verifying the end-to-end flow works, fixing any gaps, and ensuring the `source: "local"` flag is surfaced in the UI.

## Acceptance criteria

- [ ] `create_food` MCP tool inserts a row with `off_id=NULL`; the tool returns the saved food object
- [ ] `GET /api/food/search?q=<name>` returns the Custom Food in results before any OFF results
- [ ] The frontend food search modal shows a "Saved" (or equivalent) badge on Custom Food results
- [ ] Picking a Custom Food in the modal pre-fills the macro breakdown; the user can still edit before confirming
- [ ] A Custom Food can be used to log a Meal Entry end-to-end via both the MCP flow and the frontend modal

## Blocked by

- `03-food-search`
- `10-mcp-server`
