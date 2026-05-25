"""Dashboard aggregation endpoints.

`GET /api/dashboard/today` is the single source of truth for the home
Dashboard. In addition to the meal totals + goals it returns water,
weight and exercise summaries so the page loads from one request.

`GET /api/dashboard/week` returns calorie/macro totals for each day of the
current calendar week (Monday–Sunday). Future days are null per the PRD
invariant; past days with no meals are 0.
"""

from __future__ import annotations

from datetime import date as _date, timedelta
from typing import Optional

from fastapi import APIRouter, Query

from db import get_connection

from .meals import MEAL_TYPES, _group_by_meal_type, _select_for_date

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_MACRO_KEYS = ("calories", "protein_g", "carbs_g", "fat_g", "fiber_g")
_WEEK_MACRO_KEYS = ("calories", "protein_g", "carbs_g", "fat_g")

_EXERCISE_COLUMNS = (
    "id",
    "logged_at",
    "date",
    "name",
    "category",
    "duration_min",
    "sets",
    "reps",
    "weight_kg",
    "distance_km",
    "calories_burned",
    "notes",
)


def _water_summary(conn, day: str) -> dict:
    total_row = conn.execute(
        "SELECT COALESCE(SUM(amount_ml), 0) FROM water_entries WHERE date = ?",
        (day,),
    ).fetchone()
    goal_row = conn.execute(
        "SELECT water_goal_ml FROM user_goals WHERE id = 1"
    ).fetchone()
    total = float(total_row[0])
    goal = float(goal_row[0]) if goal_row and goal_row[0] is not None else 0.0
    percentage = (total / goal * 100.0) if goal > 0 else 0.0
    return {
        "date": day,
        "daily_total_ml": total,
        "water_goal_ml": goal,
        "goal_percentage": percentage,
    }


def _weight_summary(conn) -> dict:
    rows = conn.execute(
        "SELECT id, date, weight_kg, notes, logged_at FROM weight_entries "
        "ORDER BY date DESC LIMIT 2"
    ).fetchall()
    if not rows:
        return {"latest": None, "change_from_previous": None}
    latest = rows[0]
    change = None
    if len(rows) > 1:
        change = round(latest["weight_kg"] - rows[1]["weight_kg"], 4)
    return {
        "latest": {
            "id": latest["id"],
            "date": latest["date"],
            "weight_kg": latest["weight_kg"],
            "notes": latest["notes"],
            "logged_at": latest["logged_at"],
        },
        "change_from_previous": change,
    }


def _exercise_summary(conn, day: str) -> dict:
    rows = conn.execute(
        f"SELECT {', '.join(_EXERCISE_COLUMNS)} FROM exercise_entries "
        "WHERE date = ? ORDER BY logged_at ASC, id ASC",
        (day,),
    ).fetchall()
    entries = [{col: row[col] for col in _EXERCISE_COLUMNS} for row in rows]
    total_duration = sum(e["duration_min"] or 0 for e in entries)
    total_calories = sum(e["calories_burned"] or 0 for e in entries)
    return {
        "date": day,
        "total_duration_min": total_duration,
        "total_calories_burned": total_calories,
        "entries": entries,
    }


@router.get("/today")
def dashboard_today(date: Optional[_date] = Query(default=None)) -> dict:
    day = (date or _date.today()).isoformat()
    with get_connection() as conn:
        entries = _select_for_date(conn, day)
        goals_row = conn.execute("SELECT * FROM user_goals WHERE id = 1").fetchone()
        water = _water_summary(conn, day)
        weight = _weight_summary(conn)
        exercise = _exercise_summary(conn, day)

    totals = {key: 0.0 for key in _MACRO_KEYS}
    for entry in entries:
        for key in _MACRO_KEYS:
            value = getattr(entry, key)
            if value is not None:
                totals[key] += value

    grouped = _group_by_meal_type(entries)
    return {
        "date": day,
        "totals": totals,
        "goals": dict(goals_row) if goals_row is not None else None,
        "meals": {mt: [e.model_dump() for e in grouped[mt]] for mt in MEAL_TYPES},
        "water": water,
        "weight": weight,
        "exercise": exercise,
    }


@router.get("/week")
def dashboard_week() -> list[dict]:
    today = _date.today()
    monday = today - timedelta(days=today.weekday())
    days = [monday + timedelta(days=i) for i in range(7)]

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT date,
                   SUM(calories) AS calories,
                   SUM(protein_g) AS protein_g,
                   SUM(carbs_g) AS carbs_g,
                   SUM(fat_g) AS fat_g
              FROM meal_entries
             WHERE date BETWEEN ? AND ?
             GROUP BY date
            """,
            (monday.isoformat(), days[-1].isoformat()),
        ).fetchall()

    totals_by_date = {row["date"]: row for row in rows}
    result: list[dict] = []
    for day in days:
        iso = day.isoformat()
        if day > today:
            entry = {"date": iso}
            for key in _WEEK_MACRO_KEYS:
                entry[key] = None
            result.append(entry)
            continue

        row = totals_by_date.get(iso)
        entry = {"date": iso}
        for key in _WEEK_MACRO_KEYS:
            value = row[key] if row is not None else None
            entry[key] = value if value is not None else 0
        result.append(entry)
    return result
