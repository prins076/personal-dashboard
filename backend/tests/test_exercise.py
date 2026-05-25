"""Tests for /api/exercise CRUD endpoints."""

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


def test_post_exercise_creates_entry_with_id_and_logged_at(client):
    response = client.post(
        "/api/exercise",
        json={
            "name": "Morning run",
            "category": "cardio",
            "duration_min": 30,
            "distance_km": 5.0,
            "calories_burned": 320,
        },
    )

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"] > 0
    assert body["name"] == "Morning run"
    assert body["category"] == "cardio"
    assert body["duration_min"] == 30
    assert body["distance_km"] == 5.0
    assert body["calories_burned"] == 320
    assert body["date"] == date.today().isoformat()
    assert body["logged_at"]  # non-empty timestamp string


def test_post_exercise_with_explicit_date_uses_it(client):
    response = client.post(
        "/api/exercise",
        json={
            "name": "Squats",
            "category": "strength",
            "date": "2026-01-15",
            "sets": 3,
            "reps": 10,
            "weight_kg": 80.0,
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["date"] == "2026-01-15"
    assert body["sets"] == 3
    assert body["reps"] == 10
    assert body["weight_kg"] == 80.0


def test_post_exercise_rejects_invalid_category(client):
    response = client.post(
        "/api/exercise",
        json={"name": "Yoga", "category": "swimming"},
    )
    assert response.status_code == 422


def test_get_exercise_returns_entries_for_date(client):
    today = date.today().isoformat()
    client.post(
        "/api/exercise",
        json={"name": "Run", "category": "cardio", "duration_min": 20},
    )
    client.post(
        "/api/exercise",
        json={"name": "Bench", "category": "strength", "sets": 3, "reps": 8},
    )
    # an entry for a different date should not be returned
    client.post(
        "/api/exercise",
        json={
            "name": "Old run",
            "category": "cardio",
            "date": "2025-01-01",
        },
    )

    response = client.get(f"/api/exercise?date={today}")
    assert response.status_code == 200
    entries = response.json()
    assert isinstance(entries, list)
    assert len(entries) == 2
    names = {e["name"] for e in entries}
    assert names == {"Run", "Bench"}


def test_get_exercise_with_no_entries_returns_empty_list(client):
    response = client.get("/api/exercise?date=2026-05-25")
    assert response.status_code == 200
    assert response.json() == []


def test_delete_exercise_removes_entry(client):
    created = client.post(
        "/api/exercise",
        json={"name": "Run", "category": "cardio"},
    ).json()
    entry_id = created["id"]

    delete = client.delete(f"/api/exercise/{entry_id}")
    assert delete.status_code in (200, 204)

    today = date.today().isoformat()
    listed = client.get(f"/api/exercise?date={today}").json()
    assert all(e["id"] != entry_id for e in listed)


def test_delete_missing_exercise_returns_404(client):
    response = client.delete("/api/exercise/9999")
    assert response.status_code == 404


def test_patch_exercise_updates_only_supplied_fields(client):
    created = client.post(
        "/api/exercise",
        json={
            "name": "Run",
            "category": "cardio",
            "duration_min": 30,
            "distance_km": 5.0,
            "notes": "easy pace",
        },
    ).json()
    entry_id = created["id"]

    response = client.patch(
        f"/api/exercise/{entry_id}",
        json={"duration_min": 45, "notes": "tempo run"},
    )
    assert response.status_code == 200
    updated = response.json()
    assert updated["id"] == entry_id
    assert updated["duration_min"] == 45
    assert updated["notes"] == "tempo run"
    # unchanged fields
    assert updated["name"] == "Run"
    assert updated["category"] == "cardio"
    assert updated["distance_km"] == 5.0


def test_patch_missing_exercise_returns_404(client):
    response = client.patch("/api/exercise/9999", json={"name": "x"})
    assert response.status_code == 404


def test_patch_rejects_invalid_category(client):
    created = client.post(
        "/api/exercise",
        json={"name": "Run", "category": "cardio"},
    ).json()
    response = client.patch(
        f"/api/exercise/{created['id']}",
        json={"category": "swimming"},
    )
    assert response.status_code == 422
