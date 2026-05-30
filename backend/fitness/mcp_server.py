"""MCP stdio server exposing the 9 fitness tracker tools.

This server runs as a standalone process — it opens the SQLite DB
directly (path from ``FITNESS_DB_PATH``) and is independent of the
FastAPI app. ``init_db()`` is called at import time so launching the
MCP server against a fresh DB still gets the schema + goals singleton.

Tool surface mirrors the natural-language flows in PRD §"MCP Server".
``log_meal`` requires explicit macros (ADR-0001) and never reaches out
to ``search_food`` internally — caller-supplied macros only.
"""

from __future__ import annotations

import sqlite3
from datetime import date as _date
from typing import Any, Literal, Optional

from mcp.server.fastmcp import FastMCP

from db import get_connection, init_db
from off_client import NoResultsError, OFFUnreachableError, search_sync


MealType = Literal["breakfast", "lunch", "dinner", "snack"]
ExerciseCategory = Literal["cardio", "strength", "flexibility", "other"]


init_db()


mcp = FastMCP("fitness")


def _today_iso(date: Optional[str]) -> str:
    return date or _date.today().isoformat()


def _row_to_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {key: row[key] for key in row.keys()}


@mcp.tool()
def search_food(query: str, limit: int = 5) -> dict[str, Any]:
    """Search Custom Foods (local) then Open Food Facts.

    Local custom foods (``off_id IS NULL``) always appear first.
    Returns ``{"results": [...]}`` on success or an ``error`` payload
    on OFF failure / no results — stale cache is never served.
    """
    pattern = f"%{query.lower()}%"
    with get_connection() as conn:
        local_rows = conn.execute(
            """
            SELECT id, off_id, name, brand, serving_g, calories,
                   protein_g, carbs_g, fat_g, fiber_g
            FROM foods
            WHERE off_id IS NULL
              AND (LOWER(name) LIKE ? OR LOWER(IFNULL(brand, '')) LIKE ?)
            ORDER BY name COLLATE NOCASE
            LIMIT ?
            """,
            (pattern, pattern, limit),
        ).fetchall()

    results: list[dict[str, Any]] = [
        {**_row_to_dict(r), "source": "local"} for r in local_rows
    ]
    remaining = limit - len(results)
    if remaining > 0:
        try:
            off_results = search_sync(query, limit=remaining)
        except OFFUnreachableError as e:
            return {"error": "OFF_UNREACHABLE", "message": str(e)}
        except NoResultsError as e:
            if results:
                return {"results": results}
            return {"error": "NO_RESULTS", "message": str(e)}

        seen_off_ids = {r.get("off_id") for r in results if r.get("off_id")}
        for f in off_results:
            if f.get("off_id") in seen_off_ids:
                continue
            results.append({**f, "source": "off"})
            if len(results) >= limit:
                break

    return {"results": results}


@mcp.tool()
def log_meal(
    food_name: str,
    meal_type: MealType,
    quantity: float,
    unit: str,
    calories: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    fiber_g: float,
    date: Optional[str] = None,
    food_id: Optional[int] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    """Insert a Meal Entry with caller-supplied macros (ADR-0001).

    Never calls ``search_food`` internally — Claude is expected to
    resolve macros (via ``search_food`` + user confirmation) before
    calling this tool. Unit-to-gram conversion is also Claude's
    responsibility (ADR-0002).
    """
    entry_date = _today_iso(date)
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO meal_entries
                (date, meal_type, food_id, food_name, quantity, unit,
                 calories, protein_g, carbs_g, fat_g, fiber_g, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_date, meal_type, food_id, food_name, quantity, unit,
                calories, protein_g, carbs_g, fat_g, fiber_g, notes,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM meal_entries WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _row_to_dict(row)


@mcp.tool()
def create_food(
    name: str,
    calories: float,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    fiber_g: float,
    brand: Optional[str] = None,
    serving_g: Optional[float] = None,
) -> dict[str, Any]:
    """Insert a Custom Food (``off_id = NULL``)."""
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO foods
                (off_id, name, brand, serving_g, calories,
                 protein_g, carbs_g, fat_g, fiber_g)
            VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (name, brand, serving_g, calories, protein_g, carbs_g, fat_g, fiber_g),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM foods WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _row_to_dict(row)


@mcp.tool()
def log_water(
    amount_ml: float,
    date: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    """Log a water intake entry and return today's running total vs goal."""
    if amount_ml <= 0:
        return {"error": "INVALID_AMOUNT", "message": "amount_ml must be > 0"}

    day = _today_iso(date)
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO water_entries (date, amount_ml, notes) VALUES (?, ?, ?)",
            (day, amount_ml, notes),
        )
        conn.commit()
        entry = conn.execute(
            "SELECT * FROM water_entries WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
        total = conn.execute(
            "SELECT COALESCE(SUM(amount_ml), 0) FROM water_entries WHERE date = ?",
            (day,),
        ).fetchone()[0]
        goal_row = conn.execute(
            "SELECT water_goal_ml FROM user_goals WHERE id = 1"
        ).fetchone()

    goal = float(goal_row[0]) if goal_row and goal_row[0] is not None else 0.0
    percentage = (float(total) / goal * 100.0) if goal > 0 else 0.0
    return {
        "entry": _row_to_dict(entry),
        "daily_total_ml": float(total),
        "water_goal_ml": goal,
        "goal_percentage": percentage,
    }


@mcp.tool()
def log_weight(
    weight_kg: float,
    date: Optional[str] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    """Log today's weight. First-write-wins: a duplicate date returns
    an error payload containing the existing entry (HTTP 409 analogue).
    """
    entry_date = _today_iso(date)
    with get_connection() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO weight_entries (date, weight_kg, notes) VALUES (?, ?, ?)",
                (entry_date, weight_kg, notes),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            existing = conn.execute(
                "SELECT * FROM weight_entries WHERE date = ?", (entry_date,)
            ).fetchone()
            return {
                "error": "DATE_ALREADY_LOGGED",
                "existing": _row_to_dict(existing),
            }
        row = conn.execute(
            "SELECT * FROM weight_entries WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _row_to_dict(row)


@mcp.tool()
def log_exercise(
    name: str,
    category: ExerciseCategory,
    date: Optional[str] = None,
    duration_min: Optional[int] = None,
    sets: Optional[int] = None,
    reps: Optional[int] = None,
    weight_kg: Optional[float] = None,
    distance_km: Optional[float] = None,
    calories_burned: Optional[float] = None,
    notes: Optional[str] = None,
) -> dict[str, Any]:
    """Log an exercise entry."""
    entry_date = _today_iso(date)
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO exercise_entries
                (date, name, category, duration_min, sets, reps,
                 weight_kg, distance_km, calories_burned, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (entry_date, name, category, duration_min, sets, reps,
             weight_kg, distance_km, calories_burned, notes),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM exercise_entries WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _row_to_dict(row)


@mcp.tool()
def get_today_summary(date: Optional[str] = None) -> dict[str, Any]:
    """Return a full snapshot for ``date`` (default: today).

    Includes calorie/macro totals, goals, and all logged entries
    (meals grouped by meal_type, water, weight for the date, exercise).
    """
    day = _today_iso(date)
    macro_keys = ("calories", "protein_g", "carbs_g", "fat_g", "fiber_g")
    with get_connection() as conn:
        meal_rows = conn.execute(
            "SELECT * FROM meal_entries WHERE date = ? "
            "ORDER BY logged_at ASC, id ASC",
            (day,),
        ).fetchall()
        water_rows = conn.execute(
            "SELECT * FROM water_entries WHERE date = ? "
            "ORDER BY logged_at ASC, id ASC",
            (day,),
        ).fetchall()
        exercise_rows = conn.execute(
            "SELECT * FROM exercise_entries WHERE date = ? "
            "ORDER BY logged_at ASC, id ASC",
            (day,),
        ).fetchall()
        weight_row = conn.execute(
            "SELECT * FROM weight_entries WHERE date = ?",
            (day,),
        ).fetchone()
        goals_row = conn.execute(
            "SELECT * FROM user_goals WHERE id = 1"
        ).fetchone()

    meals = [_row_to_dict(r) for r in meal_rows]
    grouped: dict[str, list[dict[str, Any]]] = {
        mt: [] for mt in ("breakfast", "lunch", "dinner", "snack")
    }
    for entry in meals:
        grouped[entry["meal_type"]].append(entry)

    totals = {key: 0.0 for key in macro_keys}
    for entry in meals:
        for key in macro_keys:
            value = entry.get(key)
            if value is not None:
                totals[key] += value

    water_total = sum(float(r["amount_ml"]) for r in water_rows)

    return {
        "date": day,
        "totals": totals,
        "water_total_ml": water_total,
        "goals": _row_to_dict(goals_row) if goals_row is not None else None,
        "meals": grouped,
        "water": [_row_to_dict(r) for r in water_rows],
        "exercise": [_row_to_dict(r) for r in exercise_rows],
        "weight": _row_to_dict(weight_row) if weight_row is not None else None,
    }


@mcp.tool()
def get_weight_trend(days: int = 30) -> dict[str, Any]:
    """Return weight entries over the last ``days`` plus min/max/avg/trend."""
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM weight_entries WHERE date >= date('now', ?) "
            "ORDER BY date ASC",
            (f"-{days} days",),
        ).fetchall()

    entries = [_row_to_dict(r) for r in rows]
    if not entries:
        return {
            "days": days,
            "entries": [],
            "min": None,
            "max": None,
            "avg": None,
            "trend": "flat",
        }

    weights = [float(e["weight_kg"]) for e in entries]
    minimum = min(weights)
    maximum = max(weights)
    avg = round(sum(weights) / len(weights), 4)

    if len(weights) < 2 or weights[-1] == weights[0]:
        trend = "flat"
    elif weights[-1] > weights[0]:
        trend = "up"
    else:
        trend = "down"

    return {
        "days": days,
        "entries": entries,
        "min": minimum,
        "max": maximum,
        "avg": avg,
        "trend": trend,
    }


@mcp.tool()
def delete_meal(id: int) -> dict[str, Any]:
    """Hard-delete a meal entry by ID. Returns an error payload if not found."""
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM meal_entries WHERE id = ?", (id,))
        conn.commit()
        if cursor.rowcount == 0:
            return {"error": "NOT_FOUND", "message": f"No meal entry with id {id}"}
    return {"deleted": id}


@mcp.tool()
def delete_exercise(id: int) -> dict[str, Any]:
    """Hard-delete an exercise entry by ID. Returns an error payload if not found."""
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM exercise_entries WHERE id = ?", (id,))
        conn.commit()
        if cursor.rowcount == 0:
            return {"error": "NOT_FOUND", "message": f"No exercise entry with id {id}"}
    return {"deleted": id}


@mcp.tool()
def delete_weight(id: int) -> dict[str, Any]:
    """Hard-delete a weight entry by ID. Returns an error payload if not found."""
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM weight_entries WHERE id = ?", (id,))
        conn.commit()
        if cursor.rowcount == 0:
            return {"error": "NOT_FOUND", "message": f"No weight entry with id {id}"}
    return {"deleted": id}


@mcp.tool()
def delete_water(id: int) -> dict[str, Any]:
    """Hard-delete a water entry by ID. Returns an error payload if not found."""
    with get_connection() as conn:
        cursor = conn.execute("DELETE FROM water_entries WHERE id = ?", (id,))
        conn.commit()
        if cursor.rowcount == 0:
            return {"error": "NOT_FOUND", "message": f"No water entry with id {id}"}
    return {"deleted": id}


@mcp.tool()
def update_goals(
    calorie_goal: Optional[float] = None,
    protein_goal_g: Optional[float] = None,
    carbs_goal_g: Optional[float] = None,
    fat_goal_g: Optional[float] = None,
    fiber_goal_g: Optional[float] = None,
    water_goal_ml: Optional[float] = None,
    weight_goal_kg: Optional[float] = None,
) -> dict[str, Any]:
    """Partial update of the singleton ``user_goals`` row.

    Only fields supplied (non-None) are written. ``updated_at`` is
    bumped on any write. Returns the resulting row.
    """
    supplied = {
        key: value
        for key, value in {
            "calorie_goal": calorie_goal,
            "protein_goal_g": protein_goal_g,
            "carbs_goal_g": carbs_goal_g,
            "fat_goal_g": fat_goal_g,
            "fiber_goal_g": fiber_goal_g,
            "water_goal_ml": water_goal_ml,
            "weight_goal_kg": weight_goal_kg,
        }.items()
        if value is not None
    }
    with get_connection() as conn:
        if supplied:
            assignments = ", ".join(f"{key} = ?" for key in supplied)
            params = list(supplied.values())
            conn.execute(
                f"UPDATE user_goals SET {assignments}, "
                "updated_at = datetime('now') WHERE id = 1",
                params,
            )
            conn.commit()
        row = conn.execute(
            "SELECT * FROM user_goals WHERE id = 1"
        ).fetchone()
    return _row_to_dict(row)


def main() -> None:
    mcp.run(transport="stdio")


if __name__ == "__main__":
    main()
