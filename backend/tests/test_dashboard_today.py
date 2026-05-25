"""Tests for the extended /api/dashboard/today response.

The endpoint must combine meal totals (already covered in test_meals.py)
with water, weight and exercise summaries so the Dashboard page can load
from a single request.
"""

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


def test_dashboard_today_includes_water_summary(client):
    today = date.today().isoformat()
    client.post("/api/water", json={"amount_ml": 500})
    client.post("/api/water", json={"amount_ml": 750})

    response = client.get("/api/dashboard/today")
    assert response.status_code == 200, response.text
    body = response.json()

    water = body["water"]
    assert water["date"] == today
    assert water["daily_total_ml"] == 1250
    assert water["water_goal_ml"] == 2500
    assert water["goal_percentage"] == pytest.approx(50.0)


def test_dashboard_today_water_empty_day(client):
    response = client.get("/api/dashboard/today", params={"date": "2026-04-01"})
    assert response.status_code == 200
    body = response.json()

    water = body["water"]
    assert water["daily_total_ml"] == 0
    assert water["goal_percentage"] == 0
    assert water["water_goal_ml"] == 2500


def test_dashboard_today_includes_latest_weight_and_delta(client):
    client.post("/api/weight", json={"weight_kg": 80.0, "date": "2026-05-23"})
    client.post("/api/weight", json={"weight_kg": 79.5, "date": "2026-05-24"})
    client.post("/api/weight", json={"weight_kg": 79.2, "date": "2026-05-25"})

    response = client.get("/api/dashboard/today")
    assert response.status_code == 200
    body = response.json()

    weight = body["weight"]
    assert weight is not None
    assert weight["latest"] is not None
    assert weight["latest"]["weight_kg"] == 79.2
    assert weight["latest"]["date"] == "2026-05-25"
    assert weight["change_from_previous"] == pytest.approx(-0.3)


def test_dashboard_today_weight_no_entries(client):
    response = client.get("/api/dashboard/today")
    assert response.status_code == 200
    body = response.json()
    assert body["weight"]["latest"] is None
    assert body["weight"]["change_from_previous"] is None


def test_dashboard_today_weight_single_entry_has_no_delta(client):
    client.post("/api/weight", json={"weight_kg": 80.0, "date": "2026-05-25"})

    response = client.get("/api/dashboard/today")
    assert response.status_code == 200
    body = response.json()
    weight = body["weight"]
    assert weight["latest"]["weight_kg"] == 80.0
    assert weight["change_from_previous"] is None


def test_dashboard_today_includes_exercise_summary(client):
    today = date.today().isoformat()
    client.post(
        "/api/exercise",
        json={
            "name": "Running",
            "category": "cardio",
            "duration_min": 30,
            "calories_burned": 300,
        },
    )
    client.post(
        "/api/exercise",
        json={
            "name": "Push-ups",
            "category": "strength",
            "duration_min": 15,
            "calories_burned": 100,
        },
    )

    response = client.get("/api/dashboard/today")
    assert response.status_code == 200
    body = response.json()

    exercise = body["exercise"]
    assert exercise["total_duration_min"] == 45
    assert exercise["total_calories_burned"] == pytest.approx(400)
    assert len(exercise["entries"]) == 2
    names = [e["name"] for e in exercise["entries"]]
    assert "Running" in names
    assert "Push-ups" in names
    # Each entry exposes duration so the widget can list "Running — 30 min"
    for e in exercise["entries"]:
        assert "duration_min" in e
    assert exercise["date"] == today


def test_dashboard_today_exercise_empty_day_returns_zero_totals(client):
    response = client.get("/api/dashboard/today", params={"date": "2026-04-01"})
    assert response.status_code == 200
    body = response.json()

    exercise = body["exercise"]
    assert exercise["total_duration_min"] == 0
    assert exercise["total_calories_burned"] == 0
    assert exercise["entries"] == []


def test_dashboard_today_exercise_handles_null_duration_and_calories(client):
    # entries with no duration/calories shouldn't crash the sum
    client.post(
        "/api/exercise",
        json={"name": "Yoga", "category": "flexibility"},
    )

    response = client.get("/api/dashboard/today")
    assert response.status_code == 200
    body = response.json()
    exercise = body["exercise"]
    assert exercise["total_duration_min"] == 0
    assert exercise["total_calories_burned"] == 0
    assert len(exercise["entries"]) == 1


def test_dashboard_today_combines_all_sections(client):
    """A single GET returns meals, water, weight, and exercise — the page
    needs all of these from one round-trip."""
    today = date.today().isoformat()
    client.post(
        "/api/meals",
        json={
            "food_name": "Oats",
            "meal_type": "breakfast",
            "quantity": 100,
            "unit": "g",
            "calories": 389,
            "protein_g": 16.9,
            "carbs_g": 66.3,
            "fat_g": 6.9,
            "fiber_g": 10.6,
        },
    )
    client.post("/api/water", json={"amount_ml": 500})
    client.post("/api/weight", json={"weight_kg": 79.2})
    client.post(
        "/api/exercise",
        json={"name": "Running", "category": "cardio", "duration_min": 20},
    )

    response = client.get("/api/dashboard/today")
    assert response.status_code == 200
    body = response.json()

    assert body["date"] == today
    assert body["totals"]["calories"] == 389
    assert body["water"]["daily_total_ml"] == 500
    assert body["weight"]["latest"]["weight_kg"] == 79.2
    assert body["exercise"]["total_duration_min"] == 20
    assert body["meals"]["breakfast"][0]["food_name"] == "Oats"
    # goals are still surfaced for the calorie ring / macro pie
    assert body["goals"]["calorie_goal"] == 2000
