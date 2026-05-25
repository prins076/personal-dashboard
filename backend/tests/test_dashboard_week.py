"""Tests for GET /api/dashboard/week."""

from __future__ import annotations

from datetime import date, timedelta

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


def _monday_of_this_week() -> date:
    today = date.today()
    return today - timedelta(days=today.weekday())


def test_week_returns_seven_entries_monday_to_sunday(client):
    response = client.get("/api/dashboard/week")
    assert response.status_code == 200, response.text
    body = response.json()

    assert isinstance(body, list)
    assert len(body) == 7

    monday = _monday_of_this_week()
    for i, entry in enumerate(body):
        expected_date = (monday + timedelta(days=i)).isoformat()
        assert entry["date"] == expected_date


def test_week_first_entry_is_monday(client):
    response = client.get("/api/dashboard/week")
    body = response.json()
    monday = _monday_of_this_week()
    assert body[0]["date"] == monday.isoformat()
    # weekday() == 0 means Monday
    assert date.fromisoformat(body[0]["date"]).weekday() == 0


def test_week_future_days_have_null_numeric_fields(client):
    response = client.get("/api/dashboard/week")
    body = response.json()
    today = date.today()

    for entry in body:
        d = date.fromisoformat(entry["date"])
        if d > today:
            assert entry["calories"] is None
            assert entry["protein_g"] is None
            assert entry["carbs_g"] is None
            assert entry["fat_g"] is None


def test_week_past_days_with_no_meals_return_zero(client):
    response = client.get("/api/dashboard/week")
    body = response.json()
    today = date.today()

    for entry in body:
        d = date.fromisoformat(entry["date"])
        if d <= today:
            assert entry["calories"] == 0
            assert entry["protein_g"] == 0
            assert entry["carbs_g"] == 0
            assert entry["fat_g"] == 0


def test_week_aggregates_meals_for_each_day(client):
    monday = _monday_of_this_week()
    today = date.today()
    # Only log on days <= today
    if monday <= today:
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
                date=monday.isoformat(),
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
                date=monday.isoformat(),
            ),
        )

    response = client.get("/api/dashboard/week")
    body = response.json()
    monday_entry = body[0]
    assert monday_entry["date"] == monday.isoformat()
    assert monday_entry["calories"] == pytest.approx(389 + 165)
    assert monday_entry["protein_g"] == pytest.approx(16.9 + 31.0)
    assert monday_entry["carbs_g"] == pytest.approx(66.3 + 0.0)
    assert monday_entry["fat_g"] == pytest.approx(6.9 + 3.6)


def test_week_ignores_meals_outside_current_week(client):
    # log a meal way in the past
    client.post(
        "/api/meals",
        json=_meal_payload(
            food_name="Old", calories=999, date="2024-01-01"
        ),
    )

    response = client.get("/api/dashboard/week")
    body = response.json()
    today = date.today()
    for entry in body:
        d = date.fromisoformat(entry["date"])
        if d <= today:
            assert entry["calories"] == 0
