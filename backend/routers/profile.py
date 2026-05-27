"""Profile router — singleton row CRUD for biometric stats.

The `user_profile` table is seeded with a single row (id=1) at DB init.
- `GET /api/profile` always returns it (all fields nullable).
- `PATCH /api/profile` partial-updates only supplied fields and bumps `updated_at`.

These stats (age, sex, height, activity level) feed the Mifflin-St Jeor
calorie goal calculator.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, ConfigDict

from db import get_connection

router = APIRouter(prefix="/profile", tags=["profile"])

Sex = Literal["male", "female"]
ActivityLevel = Literal[
    "sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"
]


class ProfileOut(BaseModel):
    id: int
    age: Optional[int]
    sex: Optional[Sex]
    height_cm: Optional[float]
    activity_level: Optional[ActivityLevel]
    updated_at: str


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    age: Optional[int] = None
    sex: Optional[Sex] = None
    height_cm: Optional[float] = None
    activity_level: Optional[ActivityLevel] = None


def _fetch_singleton() -> ProfileOut:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM user_profile WHERE id = 1").fetchone()
    if row is None:
        raise HTTPException(status_code=500, detail="user_profile singleton row missing")
    return ProfileOut(**dict(row))


@router.get("", response_model=ProfileOut)
def get_profile() -> ProfileOut:
    return _fetch_singleton()


@router.patch("", response_model=ProfileOut)
def patch_profile(patch: ProfilePatch) -> ProfileOut:
    supplied = patch.model_dump(exclude_unset=True)
    if supplied:
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        assignments = ", ".join(f"{key} = ?" for key in supplied)
        params = list(supplied.values()) + [now]
        with get_connection() as conn:
            conn.execute(
                f"UPDATE user_profile SET {assignments}, updated_at = ? WHERE id = 1",
                params,
            )
            conn.commit()
    return _fetch_singleton()
