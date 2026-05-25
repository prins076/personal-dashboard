"""Tests for the GET /api/food/search route.

Uses a FastAPI dependency override to inject an httpx.AsyncClient backed
by httpx.MockTransport, so no real network is touched.
"""

from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from db import get_connection, init_db
from main import app
from routers.food import get_off_http_client


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FITNESS_DB_PATH", str(tmp_path / "fitness.db"))
    init_db()
    app.dependency_overrides.clear()
    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def _override_transport(transport: httpx.MockTransport):
    async def _provider():
        async with httpx.AsyncClient(transport=transport) as c:
            yield c

    return _provider


def _chicken_payload() -> dict:
    return {
        "products": [
            {
                "code": "0001",
                "product_name": "Chicken Breast",
                "brands": "BrandX",
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


def test_search_returns_non_zero_calories(client):
    transport = httpx.MockTransport(
        lambda r: httpx.Response(200, json=_chicken_payload())
    )
    app.dependency_overrides[get_off_http_client] = _override_transport(transport)

    response = client.get("/api/food/search", params={"q": "chicken breast", "limit": 3})
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["calories"] == 165.0
    assert data[0]["source"] == "off"


def test_second_identical_search_does_not_call_off(client):
    calls = {"n": 0}

    def handler(req: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(200, json=_chicken_payload())

    transport = httpx.MockTransport(handler)
    app.dependency_overrides[get_off_http_client] = _override_transport(transport)

    r1 = client.get("/api/food/search", params={"q": "chicken breast", "limit": 3})
    assert r1.status_code == 200
    assert len(r1.json()) >= 1
    assert calls["n"] == 1

    r2 = client.get("/api/food/search", params={"q": "chicken breast", "limit": 3})
    assert r2.status_code == 200
    assert len(r2.json()) >= 1
    assert calls["n"] == 1, "second call should be served from cache"


def test_search_returns_502_when_off_unreachable(client):
    def fail(req: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("network down")

    transport = httpx.MockTransport(fail)
    app.dependency_overrides[get_off_http_client] = _override_transport(transport)

    response = client.get("/api/food/search", params={"q": "banana", "limit": 3})
    assert response.status_code == 502
    assert response.json() == {"error": "OFF_UNREACHABLE"}


def test_search_returns_empty_list_when_off_filtered_results_empty(client):
    payload = {
        "products": [
            {"code": "1", "product_name": "Missing Kcal", "nutriments": {}},
        ]
    }
    transport = httpx.MockTransport(lambda r: httpx.Response(200, json=payload))
    app.dependency_overrides[get_off_http_client] = _override_transport(transport)

    response = client.get("/api/food/search", params={"q": "zzz", "limit": 3})
    assert response.status_code == 200
    assert response.json() == []


def test_custom_foods_appear_before_off_results(client):
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO foods (off_id, name, brand, calories, protein_g, carbs_g, fat_g, fiber_g)
               VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)""",
            ("Custom Chicken Salad", "Home", 200.0, 25.0, 5.0, 8.0, 2.0),
        )
        conn.commit()

    transport = httpx.MockTransport(
        lambda r: httpx.Response(200, json=_chicken_payload())
    )
    app.dependency_overrides[get_off_http_client] = _override_transport(transport)

    response = client.get("/api/food/search", params={"q": "chicken", "limit": 5})
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert data[0]["name"] == "Custom Chicken Salad"
    assert data[0]["source"] == "local"
    assert data[0]["off_id"] is None
    # OFF result follows
    off_entries = [r for r in data if r["source"] == "off"]
    assert any(r["off_id"] == "0001" for r in off_entries)


def test_limit_caps_total_results(client):
    # Two custom foods, both match; limit=1 should return one result and skip OFF.
    with get_connection() as conn:
        conn.executemany(
            """INSERT INTO foods (off_id, name, brand, calories, protein_g, carbs_g, fat_g, fiber_g)
               VALUES (NULL, ?, NULL, ?, ?, ?, ?, ?)""",
            [
                ("Chicken Soup", 50.0, 5.0, 5.0, 1.0, 1.0),
                ("Chicken Curry", 250.0, 20.0, 10.0, 15.0, 2.0),
            ],
        )
        conn.commit()

    def fail(req: httpx.Request) -> httpx.Response:
        raise AssertionError("OFF must not be called when local results already fill limit")

    transport = httpx.MockTransport(fail)
    app.dependency_overrides[get_off_http_client] = _override_transport(transport)

    response = client.get("/api/food/search", params={"q": "chicken", "limit": 1})
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["source"] == "local"
