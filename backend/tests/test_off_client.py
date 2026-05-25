"""Tests for the Open Food Facts client (off_client.py).

Tests use httpx.MockTransport so HTTP is mocked at the transport layer,
not the SQLite layer. The foods cache is exercised with a real DB.
"""

from __future__ import annotations

import asyncio

import httpx
import pytest

from db import get_connection, init_db
from off_client import NoResultsError, OFFUnreachableError, search, search_sync


@pytest.fixture
def db(tmp_path, monkeypatch):
    path = tmp_path / "fitness.db"
    monkeypatch.setenv("FITNESS_DB_PATH", str(path))
    init_db()
    return path


def _ok_transport(payload, captured=None):
    def handler(request: httpx.Request) -> httpx.Response:
        if captured is not None:
            captured.append(request)
        return httpx.Response(200, json=payload)

    return httpx.MockTransport(handler)


def _fail_transport():
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("simulated network failure")

    return httpx.MockTransport(handler)


def _never_called_transport():
    def handler(request: httpx.Request) -> httpx.Response:
        raise AssertionError(
            f"OFF was called unexpectedly: {request.method} {request.url}"
        )

    return httpx.MockTransport(handler)


def _chicken_payload() -> dict:
    return {
        "products": [
            {
                "code": "0123456789012",
                "product_name": "Chicken Breast",
                "brands": "GenericFarm",
                "nutriments": {
                    "energy-kcal_100g": 165.0,
                    "proteins_100g": 31.0,
                    "carbohydrates_100g": 0.0,
                    "fat_100g": 3.6,
                    "fiber_100g": 0.0,
                },
            }
        ]
    }


def _run(coro):
    return asyncio.run(coro)


def test_returns_per_100g_macros_for_known_product(db):
    captured = []
    transport = _ok_transport(_chicken_payload(), captured=captured)

    async def go():
        async with httpx.AsyncClient(transport=transport) as client:
            return await search("chicken", limit=5, client=client)

    results = _run(go())

    assert len(results) == 1
    food = results[0]
    assert food["off_id"] == "0123456789012"
    assert food["name"] == "Chicken Breast"
    assert food["calories"] == 165.0
    assert food["protein_g"] == 31.0
    assert food["carbs_g"] == 0.0
    assert food["fat_g"] == 3.6
    assert food["fiber_g"] == 0.0
    assert len(captured) == 1
    sent = captured[0]
    assert "openfoodfacts" in str(sent.url)
    assert sent.url.params.get("json") == "1"
    assert sent.headers.get("user-agent") == "FitnessTracker/1.0"


def test_skips_products_missing_energy_kcal_100g(db):
    payload = {
        "products": [
            {
                "code": "111",
                "product_name": "Mystery No Kcal",
                "nutriments": {"proteins_100g": 10},
            },
            {
                "code": "222",
                "product_name": "Real Chicken",
                "brands": "B",
                "nutriments": {
                    "energy-kcal_100g": 165.0,
                    "proteins_100g": 31.0,
                    "carbohydrates_100g": 0.0,
                    "fat_100g": 3.6,
                    "fiber_100g": 0.0,
                },
            },
        ]
    }
    transport = _ok_transport(payload)

    async def go():
        async with httpx.AsyncClient(transport=transport) as client:
            return await search("chicken", limit=5, client=client)

    results = _run(go())
    assert len(results) == 1
    assert results[0]["off_id"] == "222"


def test_raises_off_unreachable_on_network_failure(db):
    transport = _fail_transport()

    async def go():
        async with httpx.AsyncClient(transport=transport) as client:
            await search("chicken", limit=5, client=client)

    with pytest.raises(OFFUnreachableError):
        _run(go())


def test_raises_no_results_on_empty_filtered_list(db):
    # Two products, neither has energy-kcal_100g — should raise NoResultsError.
    payload = {
        "products": [
            {"code": "1", "product_name": "A", "nutriments": {}},
            {"code": "2", "product_name": "B", "nutriments": {"proteins_100g": 5}},
        ]
    }
    transport = _ok_transport(payload)

    async def go():
        async with httpx.AsyncClient(transport=transport) as client:
            await search("chicken", limit=5, client=client)

    with pytest.raises(NoResultsError):
        _run(go())


def test_returns_cached_food_without_calling_off(db):
    # Pre-populate the foods table with a fresh OFF cache entry that matches the query.
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO foods (off_id, name, brand, calories, protein_g, carbs_g, fat_g, fiber_g) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            ("9999", "Cached Chicken Breast", "BrandX", 165.0, 31.0, 0.0, 3.6, 0.0),
        )
        conn.commit()

    transport = _never_called_transport()

    async def go():
        async with httpx.AsyncClient(transport=transport) as client:
            return await search("chicken", limit=5, client=client)

    results = _run(go())
    assert any(r["off_id"] == "9999" for r in results)
    assert results[0]["name"] == "Cached Chicken Breast"


def test_sync_variant_returns_per_100g_macros(db):
    transport = httpx.MockTransport(
        lambda req: httpx.Response(200, json=_chicken_payload())
    )
    with httpx.Client(transport=transport) as client:
        results = search_sync("chicken", limit=5, client=client)
    assert len(results) == 1
    assert results[0]["off_id"] == "0123456789012"
    assert results[0]["calories"] == 165.0


def test_sync_variant_raises_off_unreachable(db):
    def handler(req):
        raise httpx.ConnectError("down")

    transport = httpx.MockTransport(handler)
    with httpx.Client(transport=transport) as client:
        with pytest.raises(OFFUnreachableError):
            search_sync("chicken", limit=5, client=client)
