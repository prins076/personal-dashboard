"""Tests for /api/meals CRUD endpoints and /api/dashboard/today."""

from __future__ import annotations

from datetime import date

import pytest
from fastapi.testclient import TestClient

from db import init_db
from main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FITNESS_DB_PATH", str(tmp_path / "test.db"))
    init_db()
    return TestClient(app)


def _meal_payload(**overrides):
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


def test_post_meal_returns_created_entry_with_id_and_logged_at(client):
    response = client.post("/api/meals", json=_meal_payload(date="2026-05-25"))

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"] > 0
    assert body["logged_at"]
    assert body["food_name"] == "Oats"
    assert body["meal_type"] == "breakfast"
    assert body["quantity"] == 100
    assert body["unit"] == "g"
    assert body["calories"] == 389
    assert body["protein_g"] == 16.9
    assert body["carbs_g"] == 66.3
    assert body["fat_g"] == 6.9
    assert body["fiber_g"] == 10.6
    assert body["date"] == "2026-05-25"


def test_post_meal_defaults_date_to_today(client):
    response = client.post("/api/meals", json=_meal_payload())
    assert response.status_code == 201
    assert response.json()["date"] == date.today().isoformat()


def test_post_meal_accepts_optional_food_id_and_notes(client):
    response = client.post(
        "/api/meals",
        json=_meal_payload(
            food_id=None, notes="With berries", date="2026-05-25"
        ),
    )
    assert response.status_code == 201
    body = response.json()
    assert body["notes"] == "With berries"
    assert body["food_id"] is None


def test_post_meal_rejects_invalid_meal_type(client):
    response = client.post(
        "/api/meals", json=_meal_payload(meal_type="brunch")
    )
    assert response.status_code == 422


def test_post_meal_rejects_unknown_field(client):
    response = client.post(
        "/api/meals", json=_meal_payload(unknown="x")
    )
    assert response.status_code == 422


def test_get_meals_groups_by_meal_type(client):
    client.post(
        "/api/meals",
        json=_meal_payload(
            food_name="Oats",
            meal_type="breakfast",
            calories=389,
            date="2026-05-25",
        ),
    )
    client.post(
        "/api/meals",
        json=_meal_payload(
            food_name="Chicken breast",
            meal_type="lunch",
            calories=165,
            date="2026-05-25",
        ),
    )
    client.post(
        "/api/meals",
        json=_meal_payload(
            food_name="Apple",
            meal_type="snack",
            calories=52,
            date="2026-05-25",
        ),
    )
    # different date entry must not appear
    client.post(
        "/api/meals",
        json=_meal_payload(
            food_name="Yesterday oats",
            meal_type="breakfast",
            date="2026-05-24",
        ),
    )

    response = client.get("/api/meals", params={"date": "2026-05-25"})
    assert response.status_code == 200
    body = response.json()

    assert set(body.keys()) >= {"breakfast", "lunch", "dinner", "snack"}
    assert len(body["breakfast"]) == 1
    assert body["breakfast"][0]["food_name"] == "Oats"
    assert len(body["lunch"]) == 1
    assert body["lunch"][0]["food_name"] == "Chicken breast"
    assert body["snack"][0]["food_name"] == "Apple"
    assert body["dinner"] == []


def test_get_meals_defaults_to_today(client):
    client.post("/api/meals", json=_meal_payload(food_name="Today oats"))
    response = client.get("/api/meals")
    assert response.status_code == 200
    body = response.json()
    names = [e["food_name"] for e in body["breakfast"]]
    assert "Today oats" in names


def test_delete_meal_removes_entry(client):
    created = client.post(
        "/api/meals", json=_meal_payload(date="2026-05-25")
    ).json()
    entry_id = created["id"]

    delete = client.delete(f"/api/meals/{entry_id}")
    assert delete.status_code == 204

    after = client.get("/api/meals", params={"date": "2026-05-25"}).json()
    assert all(e["id"] != entry_id for e in after["breakfast"])


def test_delete_missing_meal_returns_404(client):
    response = client.delete("/api/meals/9999")
    assert response.status_code == 404


def test_patch_meal_updates_only_supplied_fields(client):
    created = client.post(
        "/api/meals",
        json=_meal_payload(
            quantity=100,
            unit="g",
            calories=389,
            protein_g=16.9,
            date="2026-05-25",
        ),
    ).json()
    entry_id = created["id"]

    response = client.patch(
        f"/api/meals/{entry_id}",
        json={"quantity": 50, "calories": 195},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["quantity"] == 50
    assert body["calories"] == 195
    # unchanged fields
    assert body["unit"] == "g"
    assert body["protein_g"] == 16.9
    assert body["food_name"] == "Oats"
    assert body["meal_type"] == "breakfast"


def test_patch_missing_meal_returns_404(client):
    response = client.patch("/api/meals/9999", json={"quantity": 50})
    assert response.status_code == 404


def test_patch_meal_rejects_invalid_meal_type(client):
    created = client.post("/api/meals", json=_meal_payload()).json()
    response = client.patch(
        f"/api/meals/{created['id']}", json={"meal_type": "brunch"}
    )
    assert response.status_code == 422


def test_dashboard_today_reflects_meal_totals(client):
    today = date.today().isoformat()
    client.post(
        "/api/meals",
        json=_meal_payload(
            food_name="Oats",
            meal_type="breakfast",
            calories=389,
            protein_g=16.9,
            carbs_g=66.3,
            fat_g=6.9,
            fiber_g=10.6,
        ),
    )
    client.post(
        "/api/meals",
        json=_meal_payload(
            food_name="Chicken",
            meal_type="lunch",
            calories=165,
            protein_g=31.0,
            carbs_g=0.0,
            fat_g=3.6,
            fiber_g=0.0,
        ),
    )

    response = client.get("/api/dashboard/today")
    assert response.status_code == 200, response.text
    body = response.json()

    assert body["date"] == today
    totals = body["totals"]
    assert totals["calories"] == pytest.approx(389 + 165)
    assert totals["protein_g"] == pytest.approx(16.9 + 31.0)
    assert totals["carbs_g"] == pytest.approx(66.3 + 0.0)
    assert totals["fat_g"] == pytest.approx(6.9 + 3.6)
    assert totals["fiber_g"] == pytest.approx(10.6 + 0.0)

    goals = body["goals"]
    assert goals["calorie_goal"] == 2000
    assert goals["protein_goal_g"] == 150

    meals = body["meals"]
    assert {m["food_name"] for m in meals["breakfast"]} == {"Oats"}
    assert {m["food_name"] for m in meals["lunch"]} == {"Chicken"}
    assert meals["dinner"] == []
    assert meals["snack"] == []


def test_dashboard_today_with_explicit_date(client):
    client.post(
        "/api/meals",
        json=_meal_payload(
            food_name="Old breakfast", calories=200, date="2026-01-01"
        ),
    )
    response = client.get("/api/dashboard/today", params={"date": "2026-01-01"})
    assert response.status_code == 200
    body = response.json()
    assert body["date"] == "2026-01-01"
    assert body["totals"]["calories"] == 200


def test_dashboard_today_no_meals_returns_zero_totals(client):
    response = client.get("/api/dashboard/today", params={"date": "2026-04-01"})
    assert response.status_code == 200
    body = response.json()
    assert body["totals"]["calories"] == 0
    assert body["totals"]["protein_g"] == 0
    for meal_type in ("breakfast", "lunch", "dinner", "snack"):
        assert body["meals"][meal_type] == []
