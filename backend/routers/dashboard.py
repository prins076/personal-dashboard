"""Dashboard aggregation endpoints.

`GET /api/dashboard/today` returns calorie/macro totals for the given date
alongside the user_goals row and the grouped meal entries. Used by the
home Dashboard and the Nutrition page header to render progress rings
without a second round-trip.

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


@router.get("/today")
def dashboard_today(date: Optional[_date] = Query(default=None)) -> dict:
    day = (date or _date.today()).isoformat()
    with get_connection() as conn:
        entries = _select_for_date(conn, day)
        goals_row = conn.execute("SELECT * FROM user_goals WHERE id = 1").fetchone()

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
