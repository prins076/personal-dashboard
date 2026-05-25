"""Goals router — singleton row CRUD for nutritional targets.

The `user_goals` table is seeded with a single row (id=1) at DB init.
- `GET /api/goals` always returns it.
- `PATCH /api/goals` partial-updates only supplied fields and bumps `updated_at`.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from db import get_connection

router = APIRouter(prefix="/goals", tags=["goals"])

_UPDATABLE_FIELDS = (
    "calorie_goal",
    "protein_goal_g",
    "carbs_goal_g",
    "fat_goal_g",
    "fiber_goal_g",
    "water_goal_ml",
    "weight_goal_kg",
)


class GoalsOut(BaseModel):
    id: int
    calorie_goal: Optional[float]
    protein_goal_g: Optional[float]
    carbs_goal_g: Optional[float]
    fat_goal_g: Optional[float]
    fiber_goal_g: Optional[float]
    water_goal_ml: Optional[float]
    weight_goal_kg: Optional[float]
    updated_at: str


class GoalsPatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    calorie_goal: Optional[float] = None
    protein_goal_g: Optional[float] = None
    carbs_goal_g: Optional[float] = None
    fat_goal_g: Optional[float] = None
    fiber_goal_g: Optional[float] = None
    water_goal_ml: Optional[float] = None
    weight_goal_kg: Optional[float] = None


def _fetch_singleton() -> GoalsOut:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM user_goals WHERE id = 1").fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="user_goals singleton row missing")
    return GoalsOut(**dict(row))


@router.get("", response_model=GoalsOut)
def get_goals() -> GoalsOut:
    return _fetch_singleton()


@router.patch("", response_model=GoalsOut)
def patch_goals(patch: GoalsPatch) -> GoalsOut:
    supplied = patch.model_dump(exclude_unset=True)
    if supplied:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        assignments = ", ".join(f"{key} = ?" for key in supplied)
        params = list(supplied.values()) + [now]
        with get_connection() as conn:
            conn.execute(
                f"UPDATE user_goals SET {assignments}, updated_at = ? WHERE id = 1",
                params,
            )
            conn.commit()
    return _fetch_singleton()
