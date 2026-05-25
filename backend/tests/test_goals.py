import pytest
from fastapi.testclient import TestClient

from db import init_db
from main import app


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FITNESS_DB_PATH", str(tmp_path / "test.db"))
    init_db()
    return TestClient(app)


def test_get_goals_returns_singleton_with_defaults(client):
    response = client.get("/api/goals")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == 1
    assert body["calorie_goal"] == 2000
    assert body["protein_goal_g"] == 150
    assert body["carbs_goal_g"] == 200
    assert body["fat_goal_g"] == 65
    assert body["fiber_goal_g"] == 30
    assert body["water_goal_ml"] == 2500
    assert body["weight_goal_kg"] is None
    assert "updated_at" in body


def test_patch_goals_partial_update_changes_only_supplied_fields(client):
    before = client.get("/api/goals").json()

    response = client.patch("/api/goals", json={"calorie_goal": 2200, "protein_goal_g": 180})
    assert response.status_code == 200
    body = response.json()

    assert body["calorie_goal"] == 2200
    assert body["protein_goal_g"] == 180
    # Unchanged fields preserved
    assert body["carbs_goal_g"] == before["carbs_goal_g"]
    assert body["fat_goal_g"] == before["fat_goal_g"]
    assert body["fiber_goal_g"] == before["fiber_goal_g"]
    assert body["water_goal_ml"] == before["water_goal_ml"]
    assert body["weight_goal_kg"] == before["weight_goal_kg"]


def test_patch_goals_sets_updated_at_to_now(client):
    before = client.get("/api/goals").json()
    response = client.patch("/api/goals", json={"calorie_goal": 1800})
    assert response.status_code == 200
    body = response.json()
    assert body["updated_at"] >= before["updated_at"]
    # And it must reflect the latest write on subsequent GET
    after = client.get("/api/goals").json()
    assert after["calorie_goal"] == 1800
    assert after["updated_at"] == body["updated_at"]


def test_patch_goals_can_set_weight_goal_kg(client):
    response = client.patch("/api/goals", json={"weight_goal_kg": 75.5})
    assert response.status_code == 200
    body = response.json()
    assert body["weight_goal_kg"] == 75.5


def test_patch_goals_with_empty_body_is_noop_and_returns_current(client):
    before = client.get("/api/goals").json()
    response = client.patch("/api/goals", json={})
    assert response.status_code == 200
    body = response.json()
    # Values unchanged
    for key in (
        "calorie_goal",
        "protein_goal_g",
        "carbs_goal_g",
        "fat_goal_g",
        "fiber_goal_g",
        "water_goal_ml",
        "weight_goal_kg",
    ):
        assert body[key] == before[key]


def test_patch_goals_rejects_unknown_field(client):
    response = client.patch("/api/goals", json={"bogus_field": 123})
    assert response.status_code == 422
