"""Exercise logging CRUD endpoints."""

from __future__ import annotations

from datetime import date as _date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from db import get_connection

ExerciseCategory = Literal["cardio", "strength", "flexibility", "other"]

COLUMNS = (
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


class ExerciseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    category: ExerciseCategory
    date: Optional[_date] = None
    duration_min: Optional[int] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    distance_km: Optional[float] = None
    calories_burned: Optional[float] = None
    notes: Optional[str] = None


class ExerciseUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(default=None, min_length=1)
    category: Optional[ExerciseCategory] = None
    date: Optional[_date] = None
    duration_min: Optional[int] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    distance_km: Optional[float] = None
    calories_burned: Optional[float] = None
    notes: Optional[str] = None


class ExerciseEntry(BaseModel):
    id: int
    logged_at: str
    date: str
    name: str
    category: ExerciseCategory
    duration_min: Optional[int] = None
    sets: Optional[int] = None
    reps: Optional[int] = None
    weight_kg: Optional[float] = None
    distance_km: Optional[float] = None
    calories_burned: Optional[float] = None
    notes: Optional[str] = None


router = APIRouter(prefix="/exercise", tags=["exercise"])


def _row_to_entry(row) -> ExerciseEntry:
    return ExerciseEntry(**{col: row[col] for col in COLUMNS})


@router.post("", response_model=ExerciseEntry, status_code=status.HTTP_201_CREATED)
def create_exercise(payload: ExerciseCreate) -> ExerciseEntry:
    entry_date = (payload.date or _date.today()).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO exercise_entries
                (date, name, category, duration_min, sets, reps,
                 weight_kg, distance_km, calories_burned, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_date,
                payload.name,
                payload.category,
                payload.duration_min,
                payload.sets,
                payload.reps,
                payload.weight_kg,
                payload.distance_km,
                payload.calories_burned,
                payload.notes,
            ),
        )
        conn.commit()
        new_id = cursor.lastrowid
        row = conn.execute(
            f"SELECT {', '.join(COLUMNS)} FROM exercise_entries WHERE id = ?",
            (new_id,),
        ).fetchone()
    return _row_to_entry(row)


@router.get("", response_model=list[ExerciseEntry])
def list_exercise(
    date: Optional[_date] = Query(default=None),
    start: Optional[_date] = Query(default=None),
    end: Optional[_date] = Query(default=None),
) -> list[ExerciseEntry]:
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
                f"SELECT {', '.join(COLUMNS)} FROM exercise_entries "
                f"{where} ORDER BY date DESC, logged_at DESC, id DESC",
                params,
            ).fetchall()
        return [_row_to_entry(r) for r in rows]

    day = (date or _date.today()).isoformat()
    with get_connection() as conn:
        rows = conn.execute(
            f"SELECT {', '.join(COLUMNS)} FROM exercise_entries "
            "WHERE date = ? ORDER BY logged_at ASC, id ASC",
            (day,),
        ).fetchall()
    return [_row_to_entry(r) for r in rows]


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exercise(entry_id: int) -> None:
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM exercise_entries WHERE id = ?", (entry_id,)
        )
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="exercise entry not found")


@router.patch("/{entry_id}", response_model=ExerciseEntry)
def update_exercise(entry_id: int, payload: ExerciseUpdate) -> ExerciseEntry:
    updates = payload.model_dump(exclude_unset=True)
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM exercise_entries WHERE id = ?", (entry_id,)
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="exercise entry not found")

        if updates:
            if "date" in updates and updates["date"] is not None:
                updates["date"] = updates["date"].isoformat()
            assignments = ", ".join(f"{col} = ?" for col in updates)
            params = list(updates.values()) + [entry_id]
            conn.execute(
                f"UPDATE exercise_entries SET {assignments} WHERE id = ?",
                params,
            )
            conn.commit()

        row = conn.execute(
            f"SELECT {', '.join(COLUMNS)} FROM exercise_entries WHERE id = ?",
            (entry_id,),
        ).fetchone()
    return _row_to_entry(row)
