"""Weight logging router.

Enforces the first-write-wins invariant per calendar date via a plain
INSERT against the `UNIQUE(date)` constraint on `weight_entries` — a
duplicate returns HTTP 409 carrying the existing record. Deletion is a
hard delete so users can re-log after a mistake.
"""

from __future__ import annotations

import sqlite3
from datetime import date as date_type
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

from db import get_connection

router = APIRouter(prefix="/weight", tags=["weight"])


class WeightCreate(BaseModel):
    weight_kg: float = Field(gt=0)
    date: Optional[str] = None
    notes: Optional[str] = None


def _row_to_entry(row: sqlite3.Row) -> dict:
    return {
        "id": row["id"],
        "date": row["date"],
        "weight_kg": row["weight_kg"],
        "notes": row["notes"],
        "logged_at": row["logged_at"],
    }


@router.post("")
def create_weight(payload: WeightCreate):
    entry_date = payload.date or date_type.today().isoformat()

    with get_connection() as conn:
        try:
            cursor = conn.execute(
                "INSERT INTO weight_entries (date, weight_kg, notes) VALUES (?, ?, ?)",
                (entry_date, payload.weight_kg, payload.notes),
            )
            conn.commit()
        except sqlite3.IntegrityError:
            existing = conn.execute(
                "SELECT * FROM weight_entries WHERE date = ?", (entry_date,)
            ).fetchone()
            return JSONResponse(
                status_code=409,
                content={
                    "error": "DATE_ALREADY_LOGGED",
                    "existing": _row_to_entry(existing),
                },
            )

        row = conn.execute(
            "SELECT * FROM weight_entries WHERE id = ?", (cursor.lastrowid,)
        ).fetchone()

    return JSONResponse(status_code=201, content=_row_to_entry(row))


@router.get("")
def list_weight(days: int = 30):
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM weight_entries "
            "WHERE date >= date('now', ?) "
            "ORDER BY date ASC",
            (f"-{days} days",),
        ).fetchall()

    entries = []
    previous: Optional[float] = None
    for row in rows:
        entry = _row_to_entry(row)
        entry["change_from_previous"] = (
            None if previous is None else round(row["weight_kg"] - previous, 4)
        )
        previous = row["weight_kg"]
        entries.append(entry)

    return entries


@router.delete("/{entry_id}")
def delete_weight(entry_id: int):
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM weight_entries WHERE id = ?", (entry_id,)
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="not found")

    return Response(status_code=204)
