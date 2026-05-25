"""Tests for the weight router.

Covers the first-write-wins constraint per calendar date, delete + re-log,
and the GET listing with change_from_previous in ascending date order.
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


def test_post_weight_for_new_date_returns_created_entry(client):
    response = client.post(
        "/api/weight",
        json={"weight_kg": 78.2, "date": "2026-05-25"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["weight_kg"] == 78.2
    assert body["date"] == "2026-05-25"
    assert "id" in body


def test_second_post_for_same_date_returns_409_with_existing_entry(client):
    client.post("/api/weight", json={"weight_kg": 78.2, "date": "2026-05-25"})

    response = client.post(
        "/api/weight",
        json={"weight_kg": 80.0, "date": "2026-05-25"},
    )

    assert response.status_code == 409
    body = response.json()
    assert body["error"] == "DATE_ALREADY_LOGGED"
    assert body["existing"]["weight_kg"] == 78.2
    assert body["existing"]["date"] == "2026-05-25"


def test_delete_then_post_same_date_succeeds(client):
    created = client.post(
        "/api/weight", json={"weight_kg": 78.2, "date": "2026-05-25"}
    ).json()

    delete_response = client.delete(f"/api/weight/{created['id']}")
    assert delete_response.status_code == 204

    second = client.post(
        "/api/weight", json={"weight_kg": 79.0, "date": "2026-05-25"}
    )
    assert second.status_code == 201
    assert second.json()["weight_kg"] == 79.0


def test_get_weight_returns_entries_sorted_with_change_from_previous(client):
    client.post("/api/weight", json={"weight_kg": 80.0, "date": "2026-05-22"})
    client.post("/api/weight", json={"weight_kg": 79.5, "date": "2026-05-23"})
    client.post("/api/weight", json={"weight_kg": 78.2, "date": "2026-05-25"})

    response = client.get("/api/weight?days=30")

    assert response.status_code == 200
    entries = response.json()
    assert [e["date"] for e in entries] == [
        "2026-05-22",
        "2026-05-23",
        "2026-05-25",
    ]
    assert entries[0]["change_from_previous"] is None
    assert entries[1]["change_from_previous"] == pytest.approx(-0.5)
    assert entries[2]["change_from_previous"] == pytest.approx(-1.3)
