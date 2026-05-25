"""Dashboard aggregation endpoints.

`GET /api/dashboard/today` returns calorie/macro totals for the given date
alongside the user_goals row and the grouped meal entries. Used by the
home Dashboard and the Nutrition page header to render progress rings
without a second round-trip.
"""

from __future__ import annotations

from datetime import date as _date
from typing import Optional

from fastapi import APIRouter, Query

from db import get_connection

from .meals import MEAL_TYPES, _group_by_meal_type, _select_for_date

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

_MACRO_KEYS = ("calories", "protein_g", "carbs_g", "fat_g", "fiber_g")


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
