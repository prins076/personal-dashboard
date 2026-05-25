"""Meal logging CRUD endpoints.

Macros are always caller-supplied (ADR-0001) — this router never reaches
out to OFF or any other source to derive them. `meal_entries` stores
`quantity` + `unit` verbatim (ADR-0002); the server has no unit conversion.
"""

from __future__ import annotations

from datetime import date as _date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field

from db import get_connection

MealType = Literal["breakfast", "lunch", "dinner", "snack"]

MEAL_TYPES: tuple[MealType, ...] = ("breakfast", "lunch", "dinner", "snack")

COLUMNS = (
    "id",
    "logged_at",
    "date",
    "meal_type",
    "food_id",
    "food_name",
    "quantity",
    "unit",
    "calories",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "notes",
)


class MealCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_name: str = Field(min_length=1)
    meal_type: MealType
    quantity: float
    unit: str = Field(min_length=1)
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    fiber_g: float
    date: Optional[_date] = None
    food_id: Optional[int] = None
    notes: Optional[str] = None


class MealUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    food_name: Optional[str] = Field(default=None, min_length=1)
    meal_type: Optional[MealType] = None
    quantity: Optional[float] = None
    unit: Optional[str] = Field(default=None, min_length=1)
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    date: Optional[_date] = None
    food_id: Optional[int] = None
    notes: Optional[str] = None


class MealEntry(BaseModel):
    id: int
    logged_at: str
    date: str
    meal_type: MealType
    food_id: Optional[int] = None
    food_name: str
    quantity: float
    unit: str
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    fiber_g: Optional[float] = None
    notes: Optional[str] = None


router = APIRouter(prefix="/meals", tags=["meals"])


def _row_to_entry(row) -> MealEntry:
    return MealEntry(**{col: row[col] for col in COLUMNS})


def _select_for_date(conn, day: str) -> list[MealEntry]:
    rows = conn.execute(
        f"SELECT {', '.join(COLUMNS)} FROM meal_entries "
        "WHERE date = ? ORDER BY logged_at ASC, id ASC",
        (day,),
    ).fetchall()
    return [_row_to_entry(r) for r in rows]


def _group_by_meal_type(entries: list[MealEntry]) -> dict[str, list[MealEntry]]:
    grouped: dict[str, list[MealEntry]] = {mt: [] for mt in MEAL_TYPES}
    for entry in entries:
        grouped[entry.meal_type].append(entry)
    return grouped


@router.post("", response_model=MealEntry, status_code=status.HTTP_201_CREATED)
def create_meal(payload: MealCreate) -> MealEntry:
    entry_date = (payload.date or _date.today()).isoformat()
    with get_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO meal_entries
                (date, meal_type, food_id, food_name, quantity, unit,
                 calories, protein_g, carbs_g, fat_g, fiber_g, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_date,
                payload.meal_type,
                payload.food_id,
                payload.food_name,
                payload.quantity,
                payload.unit,
                payload.calories,
                payload.protein_g,
                payload.carbs_g,
                payload.fat_g,
                payload.fiber_g,
                payload.notes,
            ),
        )
        conn.commit()
        row = conn.execute(
            f"SELECT {', '.join(COLUMNS)} FROM meal_entries WHERE id = ?",
            (cursor.lastrowid,),
        ).fetchone()
    return _row_to_entry(row)


@router.get("", response_model=dict[str, list[MealEntry]])
def list_meals(date: Optional[_date] = Query(default=None)) -> dict[str, list[MealEntry]]:
    day = (date or _date.today()).isoformat()
    with get_connection() as conn:
        entries = _select_for_date(conn, day)
    return _group_by_meal_type(entries)


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal(entry_id: int) -> None:
    with get_connection() as conn:
        cursor = conn.execute(
            "DELETE FROM meal_entries WHERE id = ?", (entry_id,)
        )
        conn.commit()
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="meal entry not found")


@router.patch("/{entry_id}", response_model=MealEntry)
def update_meal(entry_id: int, payload: MealUpdate) -> MealEntry:
    updates = payload.model_dump(exclude_unset=True)
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT id FROM meal_entries WHERE id = ?", (entry_id,)
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="meal entry not found")

        if updates:
            if "date" in updates and updates["date"] is not None:
                updates["date"] = updates["date"].isoformat()
            assignments = ", ".join(f"{col} = ?" for col in updates)
            params = list(updates.values()) + [entry_id]
            conn.execute(
                f"UPDATE meal_entries SET {assignments} WHERE id = ?",
                params,
            )
            conn.commit()

        row = conn.execute(
            f"SELECT {', '.join(COLUMNS)} FROM meal_entries WHERE id = ?",
            (entry_id,),
        ).fetchone()
    return _row_to_entry(row)
