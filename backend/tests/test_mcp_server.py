"""Tests for the MCP stdio server.

Covers the contract spelled out in issue #10:
- All 9 tools are registered and reachable via ``mcp.list_tools()``.
- ``log_meal`` requires explicit macros (ADR-0001) — calling it without
  ``calories`` raises a tool validation error and does not write a row.
- ``log_weight`` honours the first-write-wins invariant on a real
  SQLite DB (no mocks): the second call for the same date returns an
  error payload that surfaces the existing ``weight_kg``.
"""

from __future__ import annotations

import asyncio

import pytest

from db import get_connection, init_db


EXPECTED_TOOLS = {
    "search_food",
    "log_meal",
    "create_food",
    "log_water",
    "log_weight",
    "log_exercise",
    "get_today_summary",
    "get_weight_trend",
    "update_goals",
}


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setenv("FITNESS_DB_PATH", str(tmp_path / "mcp.db"))
    init_db()
    return tmp_path / "mcp.db"


def _load_server():
    import importlib

    import fitness.mcp_server as module

    return importlib.reload(module)


def test_all_nine_tools_are_registered(db):
    server = _load_server()
    tools = asyncio.run(server.mcp.list_tools())
    names = {t.name for t in tools}
    assert names == EXPECTED_TOOLS


def test_log_meal_without_calories_returns_validation_error(db):
    from mcp.server.fastmcp.exceptions import ToolError

    server = _load_server()

    with pytest.raises(ToolError) as exc_info:
        asyncio.run(
            server.mcp.call_tool(
                "log_meal",
                {
                    "food_name": "oats",
                    "meal_type": "breakfast",
                    "quantity": 100,
                    "unit": "g",
                    "protein_g": 13.5,
                    "carbs_g": 67.7,
                    "fat_g": 6.9,
                    "fiber_g": 10.6,
                },
            )
        )
    assert "calories" in str(exc_info.value).lower()

    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) FROM meal_entries").fetchone()
    assert row[0] == 0


def test_log_weight_duplicate_date_returns_error_with_existing_value(db):
    server = _load_server()

    first = asyncio.run(
        server.mcp.call_tool(
            "log_weight",
            {"weight_kg": 78.2, "date": "2026-05-25"},
        )
    )
    # call_tool returns (content_blocks, structured_result) in FastMCP
    first_payload = first[1] if isinstance(first, tuple) else first
    assert first_payload["weight_kg"] == 78.2

    second = asyncio.run(
        server.mcp.call_tool(
            "log_weight",
            {"weight_kg": 80.0, "date": "2026-05-25"},
        )
    )
    second_payload = second[1] if isinstance(second, tuple) else second
    assert second_payload.get("error") == "DATE_ALREADY_LOGGED"
    assert second_payload["existing"]["weight_kg"] == 78.2
    assert second_payload["existing"]["date"] == "2026-05-25"


def test_create_food_inserts_custom_food_with_null_off_id(db):
    server = _load_server()

    result = asyncio.run(
        server.mcp.call_tool(
            "create_food",
            {
                "name": "Mom's Lasagna",
                "brand": "Home",
                "calories": 175.0,
                "protein_g": 9.0,
                "carbs_g": 18.0,
                "fat_g": 7.5,
                "fiber_g": 1.5,
                "serving_g": 200.0,
            },
        )
    )
    payload = result[1] if isinstance(result, tuple) else result

    assert payload["off_id"] is None
    assert payload["name"] == "Mom's Lasagna"
    assert payload["brand"] == "Home"
    assert payload["calories"] == 175.0
    assert payload["serving_g"] == 200.0
    assert isinstance(payload["id"], int)

    with get_connection() as conn:
        row = conn.execute(
            "SELECT off_id, name, brand FROM foods WHERE id = ?",
            (payload["id"],),
        ).fetchone()
    assert row["off_id"] is None
    assert row["name"] == "Mom's Lasagna"
    assert row["brand"] == "Home"


def test_custom_food_can_be_searched_and_logged_end_to_end(db):
    """Round-trip: create_food → search_food returns it first → log_meal references it."""
    server = _load_server()

    created = asyncio.run(
        server.mcp.call_tool(
            "create_food",
            {
                "name": "Homemade Granola",
                "calories": 450.0,
                "protein_g": 10.0,
                "carbs_g": 60.0,
                "fat_g": 18.0,
                "fiber_g": 7.0,
            },
        )
    )
    created_payload = created[1] if isinstance(created, tuple) else created
    food_id = created_payload["id"]

    # limit=1 ensures the local result fills the result set and OFF is
    # not consulted (no network in tests). The "before OFF results"
    # ordering invariant has its own coverage in test_food_search.py.
    searched = asyncio.run(
        server.mcp.call_tool("search_food", {"query": "granola", "limit": 1})
    )
    search_payload = searched[1] if isinstance(searched, tuple) else searched
    results = search_payload["results"]
    assert len(results) == 1
    assert results[0]["name"] == "Homemade Granola"
    assert results[0]["source"] == "local"
    assert results[0]["off_id"] is None

    logged = asyncio.run(
        server.mcp.call_tool(
            "log_meal",
            {
                "food_name": "Homemade Granola",
                "meal_type": "breakfast",
                "quantity": 50,
                "unit": "g",
                "calories": 225.0,
                "protein_g": 5.0,
                "carbs_g": 30.0,
                "fat_g": 9.0,
                "fiber_g": 3.5,
                "food_id": food_id,
            },
        )
    )
    logged_payload = logged[1] if isinstance(logged, tuple) else logged
    assert logged_payload["food_id"] == food_id
    assert logged_payload["food_name"] == "Homemade Granola"
    assert logged_payload["calories"] == 225.0
