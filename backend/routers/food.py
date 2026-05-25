"""GET /api/food/search — local-first food lookup with OFF fallback.

Custom foods (off_id IS NULL) match by name/brand from the local `foods`
table and always come before OFF results. The remaining slots are filled
by `off_client.search`, which handles its own 7-day cache and raises
typed errors on failure.
"""

from __future__ import annotations

from typing import Any, AsyncIterator

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse

from db import get_connection
from off_client import NoResultsError, OFFUnreachableError, search

router = APIRouter(prefix="/food", tags=["food"])


async def get_off_http_client() -> AsyncIterator[httpx.AsyncClient]:
    """FastAPI dependency that yields an httpx.AsyncClient.

    Overridden in tests to inject a MockTransport-backed client so the
    OFF endpoint is never actually hit.
    """
    async with httpx.AsyncClient() as client:
        yield client


def _local_custom_foods(query: str, limit: int) -> list[dict[str, Any]]:
    pattern = f"%{query.lower()}%"
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, off_id, name, brand, serving_g, calories,
                   protein_g, carbs_g, fat_g, fiber_g
            FROM foods
            WHERE off_id IS NULL
              AND (LOWER(name) LIKE ? OR LOWER(IFNULL(brand, '')) LIKE ?)
            ORDER BY name COLLATE NOCASE
            LIMIT ?
            """,
            (pattern, pattern, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def _serialise(food: dict[str, Any], source: str) -> dict[str, Any]:
    return {
        "id": food.get("id"),
        "off_id": food.get("off_id"),
        "name": food.get("name"),
        "brand": food.get("brand"),
        "serving_g": food.get("serving_g"),
        "calories": food.get("calories"),
        "protein_g": food.get("protein_g"),
        "carbs_g": food.get("carbs_g"),
        "fat_g": food.get("fat_g"),
        "fiber_g": food.get("fiber_g"),
        "source": source,
    }


@router.get("/search")
async def search_food(
    q: str = Query(..., min_length=1),
    limit: int = Query(10, ge=1, le=50),
    http_client: httpx.AsyncClient = Depends(get_off_http_client),
):
    local = _local_custom_foods(q, limit)
    results: list[dict[str, Any]] = [_serialise(f, "local") for f in local]

    remaining = limit - len(results)
    if remaining > 0:
        try:
            off_results = await search(q, limit=remaining, client=http_client)
        except OFFUnreachableError:
            return JSONResponse(
                status_code=502, content={"error": "OFF_UNREACHABLE"}
            )
        except NoResultsError:
            off_results = []
        seen_off_ids = {r["off_id"] for r in results if r.get("off_id")}
        for f in off_results:
            if f.get("off_id") in seen_off_ids:
                continue
            results.append(_serialise(f, "off"))
            if len(results) >= limit:
                break

    return results
