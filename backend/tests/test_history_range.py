"""Tests for ?start=&end= range filtering on history endpoints.

The History page needs to list entries across a date range for meals,
water, exercise, and weight. When start/end are provided, the endpoints
return a flat list ordered date DESC, logged_at DESC. The existing
date / days / no-arg behaviours remain untouched.
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from db import init_db
from main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FITNESS_DB_PATH", str(tmp_path / "test.db"))
    init_db()
    return TestClient(app)


def _meal(**overrides):
    base = {
        "food_name": "Oats",
        "meal_type": "breakfast",
        "quantity": 100,
        "unit": "g",
        "calories": 389,
        "protein_g": 16.9,
        "carbs_g": 66.3,
        "fat_g": 6.9,
        "fiber_g": 10.6,
    }
    base.update(overrides)
    return base


# ---------- meals ----------


def test_get_meals_range_returns_flat_list_reverse_chronological(client):
    client.post("/api/meals", json=_meal(food_name="A", date="2026-05-20"))
    client.post("/api/meals", json=_meal(food_name="B", date="2026-05-22"))
    client.post("/api/meals", json=_meal(food_name="C", date="2026-05-25"))
    # outside range
    client.post("/api/meals", json=_meal(food_name="OldOut", date="2026-05-10"))
    client.post("/api/meals", json=_meal(food_name="NewOut", date="2026-05-30"))

    response = client.get(
        "/api/meals", params={"start": "2026-05-20", "end": "2026-05-25"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    names = [e["food_name"] for e in body]
    assert names == ["C", "B", "A"]


def test_get_meals_range_with_only_start_is_open_ended(client):
    client.post("/api/meals", json=_meal(food_name="Old", date="2026-04-01"))
    client.post("/api/meals", json=_meal(food_name="Recent", date="2026-05-25"))

    response = client.get("/api/meals", params={"start": "2026-05-01"})
    assert response.status_code == 200
    names = [e["food_name"] for e in response.json()]
    assert "Recent" in names
    assert "Old" not in names


def test_get_meals_range_with_only_end_is_open_ended(client):
    client.post("/api/meals", json=_meal(food_name="Old", date="2026-04-01"))
    client.post("/api/meals", json=_meal(food_name="Recent", date="2026-05-25"))

    response = client.get("/api/meals", params={"end": "2026-04-30"})
    assert response.status_code == 200
    names = [e["food_name"] for e in response.json()]
    assert "Old" in names
    assert "Recent" not in names


def test_get_meals_without_range_still_returns_grouped_shape(client):
    """The existing single-date behaviour must remain unchanged."""
    client.post("/api/meals", json=_meal(food_name="Today oats"))
    response = client.get("/api/meals")
    assert response.status_code == 200
    body = response.json()
    # grouped: dict with all four meal-type keys
    assert isinstance(body, dict)
    assert set(body.keys()) >= {"breakfast", "lunch", "dinner", "snack"}


# ---------- water ----------


def test_get_water_range_returns_flat_list_reverse_chronological(client):
    client.post("/api/water", json={"amount_ml": 100, "date": "2026-05-20"})
    client.post("/api/water", json={"amount_ml": 200, "date": "2026-05-22"})
    client.post("/api/water", json={"amount_ml": 300, "date": "2026-05-25"})
    client.post("/api/water", json={"amount_ml": 999, "date": "2026-04-01"})

    response = client.get(
        "/api/water", params={"start": "2026-05-20", "end": "2026-05-25"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert isinstance(body, list)
    assert len(body) == 3
    amounts = [e["amount_ml"] for e in body]
    assert amounts == [300, 200, 100]


def test_get_water_without_range_still_returns_day_summary(client):
    client.post("/api/water", json={"amount_ml": 100, "date": "2026-05-25"})
    response = client.get("/api/water", params={"date": "2026-05-25"})
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict)
    assert body["daily_total_ml"] == 100
    assert "water_goal_ml" in body


# ---------- exercise ----------


def test_get_exercise_range_returns_flat_list_reverse_chronological(client):
    client.post(
        "/api/exercise",
        json={"name": "A", "category": "cardio", "date": "2026-05-20"},
    )
    client.post(
        "/api/exercise",
        json={"name": "B", "category": "strength", "date": "2026-05-22"},
    )
    client.post(
        "/api/exercise",
        json={"name": "C", "category": "cardio", "date": "2026-05-25"},
    )
    client.post(
        "/api/exercise",
        json={"name": "OldOut", "category": "cardio", "date": "2026-05-10"},
    )

    response = client.get(
        "/api/exercise", params={"start": "2026-05-20", "end": "2026-05-25"}
    )
    assert response.status_code == 200
    body = response.json()
    names = [e["name"] for e in body]
    assert names == ["C", "B", "A"]


def test_get_exercise_without_date_or_range_returns_today(client):
    """Single-date listing still works without explicit date param."""
    client.post("/api/exercise", json={"name": "Run", "category": "cardio"})
    response = client.get("/api/exercise")
    assert response.status_code == 200
    body = response.json()
    assert any(e["name"] == "Run" for e in body)


# ---------- weight ----------


def test_get_weight_range_returns_flat_list_reverse_chronological(client):
    client.post("/api/weight", json={"weight_kg": 80.0, "date": "2026-05-20"})
    client.post("/api/weight", json={"weight_kg": 79.5, "date": "2026-05-22"})
    client.post("/api/weight", json={"weight_kg": 78.2, "date": "2026-05-25"})
    # outside the range
    client.post("/api/weight", json={"weight_kg": 90.0, "date": "2026-01-01"})

    response = client.get(
        "/api/weight", params={"start": "2026-05-20", "end": "2026-05-25"}
    )
    assert response.status_code == 200
    body = response.json()
    dates = [e["date"] for e in body]
    assert dates == ["2026-05-25", "2026-05-22", "2026-05-20"]


def test_get_weight_range_preserves_change_from_previous_chronologically(client):
    client.post("/api/weight", json={"weight_kg": 80.0, "date": "2026-05-20"})
    client.post("/api/weight", json={"weight_kg": 79.5, "date": "2026-05-22"})
    client.post("/api/weight", json={"weight_kg": 78.2, "date": "2026-05-25"})

    response = client.get(
        "/api/weight", params={"start": "2026-05-20", "end": "2026-05-25"}
    )
    assert response.status_code == 200
    body = response.json()
    # In DESC order: change_from_previous is computed against the
    # chronologically previous entry (the older one). The oldest entry
    # has no previous, so its change is None.
    by_date = {e["date"]: e for e in body}
    assert by_date["2026-05-20"]["change_from_previous"] is None
    assert by_date["2026-05-22"]["change_from_previous"] == pytest.approx(-0.5)
    assert by_date["2026-05-25"]["change_from_previous"] == pytest.approx(-1.3)


def test_get_weight_without_range_still_uses_days(client):
    """Existing `days` parameter unaffected."""
    client.post("/api/weight", json={"weight_kg": 80.0, "date": "2026-05-25"})
    response = client.get("/api/weight", params={"days": 30})
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
