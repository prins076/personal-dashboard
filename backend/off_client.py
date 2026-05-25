"""Open Food Facts client with local 7-day cache.

Both an async (httpx.AsyncClient) and sync (httpx.Client) variant are
exposed. The async one backs the FastAPI route; the sync one is for the
MCP server.

Behaviour:
- Before hitting OFF, look in the local `foods` table for entries whose
  name or brand matches the query and whose `cached_at` is within the
  7-day TTL. If any are found, they are returned without an HTTP call.
- Otherwise the OFF search endpoint is queried. Products missing
  `energy-kcal_100g` are dropped. Survivors are upserted into the cache
  and returned.
- Network failures raise OFFUnreachableError. An empty filtered list
  raises NoResultsError. Stale cache is never returned on failure — by
  the time we attempt OFF, no fresh cache existed.
"""

from __future__ import annotations

from typing import Any

import httpx

from db import get_connection

OFF_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl"
USER_AGENT = "FitnessTracker/1.0"
CACHE_TTL_DAYS = 7


class OFFUnreachableError(Exception):
    """OFF API could not be reached or returned an invalid response."""


class NoResultsError(Exception):
    """OFF returned products but none had energy-kcal_100g."""


def _params(query: str, limit: int) -> dict[str, Any]:
    return {
        "search_terms": query,
        "json": 1,
        "page_size": max(limit, 1),
        "fields": "code,product_name,brands,nutriments,serving_quantity",
    }


def _headers() -> dict[str, str]:
    return {"User-Agent": USER_AGENT}


def _row_to_food(row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "off_id": row["off_id"],
        "name": row["name"],
        "brand": row["brand"],
        "serving_g": row["serving_g"],
        "calories": row["calories"],
        "protein_g": row["protein_g"],
        "carbs_g": row["carbs_g"],
        "fat_g": row["fat_g"],
        "fiber_g": row["fiber_g"],
        "cached_at": row["cached_at"],
    }


def _cache_lookup(query: str, limit: int) -> list[dict[str, Any]]:
    """Fresh OFF-sourced cache entries (off_id IS NOT NULL) matching the query."""
    pattern = f"%{query.lower()}%"
    ttl_modifier = f"-{CACHE_TTL_DAYS} days"
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, off_id, name, brand, serving_g, calories,
                   protein_g, carbs_g, fat_g, fiber_g, cached_at
            FROM foods
            WHERE off_id IS NOT NULL
              AND (LOWER(name) LIKE ? OR LOWER(IFNULL(brand, '')) LIKE ?)
              AND cached_at > datetime('now', ?)
            ORDER BY cached_at DESC
            LIMIT ?
            """,
            (pattern, pattern, ttl_modifier, limit),
        ).fetchall()
    return [_row_to_food(r) for r in rows]


def _extract_food(product: dict[str, Any]) -> dict[str, Any] | None:
    nutriments = product.get("nutriments") or {}
    kcal = nutriments.get("energy-kcal_100g")
    if kcal is None:
        return None
    try:
        kcal_f = float(kcal)
    except (TypeError, ValueError):
        return None
    code = product.get("code")
    if not code:
        return None

    def _to_float(value: Any) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0.0

    return {
        "off_id": str(code),
        "name": (product.get("product_name") or "").strip() or f"OFF {code}",
        "brand": product.get("brands"),
        "serving_g": _to_float(product.get("serving_quantity"))
        if product.get("serving_quantity")
        else None,
        "calories": kcal_f,
        "protein_g": _to_float(nutriments.get("proteins_100g")),
        "carbs_g": _to_float(nutriments.get("carbohydrates_100g")),
        "fat_g": _to_float(nutriments.get("fat_100g")),
        "fiber_g": _to_float(nutriments.get("fiber_100g")),
    }


def _upsert_food(food: dict[str, Any]) -> dict[str, Any]:
    """Insert a new cache entry or refresh an existing one; return the row."""
    ttl_modifier = f"-{CACHE_TTL_DAYS} days"
    with get_connection() as conn:
        fresh = conn.execute(
            "SELECT id FROM foods "
            "WHERE off_id = ? AND cached_at > datetime('now', ?)",
            (food["off_id"], ttl_modifier),
        ).fetchone()
        if fresh is None:
            conn.execute(
                """
                INSERT INTO foods (
                    off_id, name, brand, serving_g, calories,
                    protein_g, carbs_g, fat_g, fiber_g, cached_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
                ON CONFLICT(off_id) DO UPDATE SET
                    name = excluded.name,
                    brand = excluded.brand,
                    serving_g = excluded.serving_g,
                    calories = excluded.calories,
                    protein_g = excluded.protein_g,
                    carbs_g = excluded.carbs_g,
                    fat_g = excluded.fat_g,
                    fiber_g = excluded.fiber_g,
                    cached_at = datetime('now')
                """,
                (
                    food["off_id"],
                    food["name"],
                    food["brand"],
                    food.get("serving_g"),
                    food["calories"],
                    food["protein_g"],
                    food["carbs_g"],
                    food["fat_g"],
                    food["fiber_g"],
                ),
            )
            conn.commit()
        row = conn.execute(
            """
            SELECT id, off_id, name, brand, serving_g, calories,
                   protein_g, carbs_g, fat_g, fiber_g, cached_at
            FROM foods WHERE off_id = ?
            """,
            (food["off_id"],),
        ).fetchone()
    return _row_to_food(row)


def _filter_products(products: list[dict[str, Any]], limit: int) -> list[dict[str, Any]]:
    foods: list[dict[str, Any]] = []
    for product in products:
        food = _extract_food(product)
        if food is None:
            continue
        foods.append(food)
        if len(foods) >= limit:
            break
    return foods


async def search(
    query: str,
    limit: int = 10,
    client: httpx.AsyncClient | None = None,
) -> list[dict[str, Any]]:
    """Search OFF for products, with local 7-day cache.

    Raises OFFUnreachableError on transport errors, NoResultsError when
    no products survive the energy-kcal_100g filter.
    """
    cached = _cache_lookup(query, limit)
    if cached:
        return cached

    own_client = client is None
    if own_client:
        client = httpx.AsyncClient()
    try:
        try:
            response = await client.get(
                OFF_SEARCH_URL, params=_params(query, limit), headers=_headers()
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            raise OFFUnreachableError(str(e)) from e
        except ValueError as e:
            raise OFFUnreachableError(f"Invalid JSON from OFF: {e}") from e
    finally:
        if own_client:
            await client.aclose()

    foods = _filter_products(data.get("products") or [], limit)
    if not foods:
        raise NoResultsError(f"No OFF products with energy-kcal_100g for {query!r}")
    return [_upsert_food(f) for f in foods]


def search_sync(
    query: str,
    limit: int = 10,
    client: httpx.Client | None = None,
) -> list[dict[str, Any]]:
    """Synchronous variant for the MCP server."""
    cached = _cache_lookup(query, limit)
    if cached:
        return cached

    own_client = client is None
    if own_client:
        client = httpx.Client()
    try:
        try:
            response = client.get(
                OFF_SEARCH_URL, params=_params(query, limit), headers=_headers()
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as e:
            raise OFFUnreachableError(str(e)) from e
        except ValueError as e:
            raise OFFUnreachableError(f"Invalid JSON from OFF: {e}") from e
    finally:
        if own_client:
            client.close()

    foods = _filter_products(data.get("products") or [], limit)
    if not foods:
        raise NoResultsError(f"No OFF products with energy-kcal_100g for {query!r}")
    return [_upsert_food(f) for f in foods]
