"""Water intake logging API."""

from __future__ import annotations

from datetime import date as _date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, Field

from db import get_connection

router = APIRouter(prefix="/water", tags=["water"])


class WaterCreate(BaseModel):
    amount_ml: float = Field(gt=0)
    date: Optional[_date] = None
    notes: Optional[str] = None


class WaterEntry(BaseModel):
    id: int
    date: str
    amount_ml: float
    notes: Optional[str] = None
    logged_at: Optional[str] = None


class WaterCreateResponse(BaseModel):
    entry: WaterEntry
    daily_total_ml: float


class WaterDayResponse(BaseModel):
    date: str
    entries: list[WaterEntry]
    daily_total_ml: float
    water_goal_ml: float
    goal_percentage: float


def _daily_total(conn, day: str) -> float:
    row = conn.execute(
        "SELECT COALESCE(SUM(amount_ml), 0) FROM water_entries WHERE date = ?",
        (day,),
    ).fetchone()
    return float(row[0])


def _water_goal(conn) -> float:
    row = conn.execute(
        "SELECT water_goal_ml FROM user_goals WHERE id = 1"
    ).fetchone()
    return float(row[0]) if row and row[0] is not None else 0.0


@router.post("", status_code=status.HTTP_201_CREATED, response_model=WaterCreateResponse)
def create_water(payload: WaterCreate) -> WaterCreateResponse:
    day = (payload.date or _date.today()).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO water_entries (date, amount_ml, notes) VALUES (?, ?, ?)",
            (day, payload.amount_ml, payload.notes),
        )
        conn.commit()
        entry_id = cursor.lastrowid
        row = conn.execute(
            "SELECT id, date, amount_ml, notes, logged_at FROM water_entries WHERE id = ?",
            (entry_id,),
        ).fetchone()
        total = _daily_total(conn, day)

    return WaterCreateResponse(
        entry=WaterEntry(
            id=row["id"],
            date=row["date"],
            amount_ml=row["amount_ml"],
            notes=row["notes"],
            logged_at=row["logged_at"],
        ),
        daily_total_ml=total,
    )


@router.get("")
def list_water(
    date: Optional[_date] = Query(default=None),
    start: Optional[_date] = Query(default=None),
    end: Optional[_date] = Query(default=None),
):
    if start is not None or end is not None:
        clauses: list[str] = []
        params: list[str] = []
        if start is not None:
            clauses.append("date >= ?")
            params.append(start.isoformat())
        if end is not None:
            clauses.append("date <= ?")
            params.append(end.isoformat())
        where = "WHERE " + " AND ".join(clauses)
        with get_connection() as conn:
            rows = conn.execute(
                f"SELECT id, date, amount_ml, notes, logged_at FROM water_entries "
                f"{where} ORDER BY date DESC, logged_at DESC, id DESC",
                params,
            ).fetchall()
        return [
            WaterEntry(
                id=r["id"],
                date=r["date"],
                amount_ml=r["amount_ml"],
                notes=r["notes"],
                logged_at=r["logged_at"],
            ).model_dump()
            for r in rows
        ]

    day = (date or _date.today()).isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, date, amount_ml, notes, logged_at FROM water_entries "
            "WHERE date = ? ORDER BY logged_at, id",
            (day,),
        ).fetchall()
        total = _daily_total(conn, day)
        goal = _water_goal(conn)

    percentage = (total / goal * 100.0) if goal > 0 else 0.0
    return WaterDayResponse(
        date=day,
        entries=[
            WaterEntry(
                id=r["id"],
                date=r["date"],
                amount_ml=r["amount_ml"],
                notes=r["notes"],
                logged_at=r["logged_at"],
            )
            for r in rows
        ],
        daily_total_ml=total,
        water_goal_ml=goal,
        goal_percentage=percentage,
    )


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_water(entry_id: int) -> Response:
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM water_entries WHERE id = ?", (entry_id,)
        )
        conn.commit()
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Water entry not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
