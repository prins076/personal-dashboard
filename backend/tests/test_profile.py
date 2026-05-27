import pytest
from fastapi.testclient import TestClient

from db import init_db
from main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FITNESS_DB_PATH", str(tmp_path / "test.db"))
    init_db()
    return TestClient(app)


def test_get_profile_on_fresh_db_returns_all_nulls(client):
    response = client.get("/api/profile")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == 1
    assert body["age"] is None
    assert body["sex"] is None
    assert body["height_cm"] is None
    assert body["activity_level"] is None
    assert "updated_at" in body


def test_patch_profile_updates_and_returns_supplied_fields(client):
    response = client.patch(
        "/api/profile",
        json={
            "age": 32,
            "sex": "male",
            "height_cm": 180.5,
            "activity_level": "moderately_active",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["age"] == 32
    assert body["sex"] == "male"
    assert body["height_cm"] == 180.5
    assert body["activity_level"] == "moderately_active"


def test_patch_profile_rejects_unknown_field(client):
    response = client.patch("/api/profile", json={"bogus_field": 123})
    assert response.status_code == 422


def test_sequential_patches_accumulate(client):
    first = client.patch("/api/profile", json={"age": 40})
    assert first.status_code == 200
    assert first.json()["age"] == 40

    second = client.patch("/api/profile", json={"height_cm": 175.0})
    assert second.status_code == 200
    body = second.json()
    # New field applied, earlier field preserved
    assert body["height_cm"] == 175.0
    assert body["age"] == 40

    after = client.get("/api/profile").json()
    assert after["age"] == 40
    assert after["height_cm"] == 175.0


def test_patch_profile_bumps_updated_at(client):
    before = client.get("/api/profile").json()
    response = client.patch("/api/profile", json={"age": 25})
    assert response.status_code == 200
    assert response.json()["updated_at"] >= before["updated_at"]
