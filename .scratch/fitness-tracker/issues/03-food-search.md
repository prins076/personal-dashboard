Status: ready-for-agent

# 03 — Food search (OFF + local cache)

## Parent

`.scratch/fitness-tracker/PRD.md`

## What to build

The food lookup engine used by both the frontend modal and the MCP flow. Queries the local `foods` table first, then Open Food Facts, upserts results into the cache, and returns typed errors on failure.

**Backend — `off_client.py`:** implement an async `search(query, limit)` function using `httpx.AsyncClient`. Calls `world.openfoodfacts.org/cgi/search.pl` with `json=1` and User-Agent `FitnessTracker/1.0`. Extracts `energy-kcal_100g`, `proteins_100g`, `carbohydrates_100g`, `fat_100g`, `fiber_100g` from `nutriments`; skips products missing `energy-kcal_100g`. Upserts results into the `foods` table; does not re-fetch entries whose `cached_at` is less than 7 days old. On network failure, raises `OFFUnreachableError`; when the filtered result list is empty, raises `NoResultsError`. Also provide a sync `httpx.Client` variant for use by the MCP server.

**Backend — `GET /api/food/search?q=...&limit=10`:** queries the local `foods` table for matching rows first (case-insensitive name/brand search), then calls `off_client.search` for any remaining slots up to `limit`. Returns a unified list with a `source` field (`"local"` or `"off"`). Returns a 502 with `{"error": "OFF_UNREACHABLE"}` on network failure; returns an empty list (not an error) when there are no results.

**Tests:**
- Returns correct per-100g macros for a known product
- Skips products missing `energy-kcal_100g`
- Returns `OFFUnreachableError` on network failure (mock HTTP transport, not DB)
- Returns `NoResultsError` when OFF product list is empty after filtering
- Returns a cached food without calling OFF when a fresh cache entry exists

## Acceptance criteria

- [ ] `GET /api/food/search?q=chicken+breast&limit=3` returns at least one result with non-zero calories
- [ ] A second identical search within 7 days does not make a new HTTP request to OFF (cache hit)
- [ ] When OFF is unreachable, the endpoint returns `{"error": "OFF_UNREACHABLE"}` with HTTP 502
- [ ] When no products pass the `energy-kcal_100g` filter, the endpoint returns an empty list
- [ ] All five OFF client tests pass

## Blocked by

- `01-project-scaffold`
