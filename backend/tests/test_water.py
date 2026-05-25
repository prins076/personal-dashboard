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


def test_post_water_creates_entry_with_caller_date(client):
    response = client.post(
        "/api/water",
        json={"amount_ml": 250, "date": "2026-05-25", "notes": "morning"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["entry"]["amount_ml"] == 250
    assert body["entry"]["date"] == "2026-05-25"
    assert body["entry"]["notes"] == "morning"
    assert body["entry"]["id"] > 0
    assert body["daily_total_ml"] == 250


def test_post_water_defaults_date_to_today(client):
    response = client.post("/api/water", json={"amount_ml": 300})

    assert response.status_code == 201
    body = response.json()
    assert body["entry"]["date"] == date.today().isoformat()


def test_post_water_sums_daily_total(client):
    client.post("/api/water", json={"amount_ml": 150, "date": "2026-05-25"})
    response = client.post(
        "/api/water", json={"amount_ml": 250, "date": "2026-05-25"}
    )

    assert response.status_code == 201
    assert response.json()["daily_total_ml"] == 400


def test_post_water_rejects_non_positive_amount(client):
    response = client.post("/api/water", json={"amount_ml": 0})
    assert response.status_code == 422

    response = client.post("/api/water", json={"amount_ml": -10})
    assert response.status_code == 422


def test_get_water_returns_entries_total_and_percentage(client):
    client.post("/api/water", json={"amount_ml": 500, "date": "2026-05-25"})
    client.post("/api/water", json={"amount_ml": 750, "date": "2026-05-25"})
    client.post("/api/water", json={"amount_ml": 200, "date": "2026-05-24"})

    response = client.get("/api/water", params={"date": "2026-05-25"})

    assert response.status_code == 200
    body = response.json()
    assert body["date"] == "2026-05-25"
    assert body["daily_total_ml"] == 1250
    assert body["water_goal_ml"] == 2500
    assert body["goal_percentage"] == pytest.approx(50.0)
    assert len(body["entries"]) == 2
    amounts = [e["amount_ml"] for e in body["entries"]]
    assert sorted(amounts) == [500, 750]


def test_get_water_defaults_to_today_when_date_omitted(client):
    today = date.today().isoformat()
    client.post("/api/water", json={"amount_ml": 100})

    response = client.get("/api/water")
    assert response.status_code == 200
    body = response.json()
    assert body["date"] == today
    assert body["daily_total_ml"] == 100


def test_get_water_empty_day_returns_zero_total(client):
    response = client.get("/api/water", params={"date": "2026-01-01"})

    assert response.status_code == 200
    body = response.json()
    assert body["entries"] == []
    assert body["daily_total_ml"] == 0
    assert body["goal_percentage"] == 0


def test_delete_water_removes_entry(client):
    post = client.post("/api/water", json={"amount_ml": 500, "date": "2026-05-25"})
    entry_id = post.json()["entry"]["id"]

    response = client.delete(f"/api/water/{entry_id}")
    assert response.status_code == 204

    after = client.get("/api/water", params={"date": "2026-05-25"})
    assert after.json()["daily_total_ml"] == 0
    assert after.json()["entries"] == []


def test_delete_water_unknown_id_returns_404(client):
    response = client.delete("/api/water/9999")
    assert response.status_code == 404
