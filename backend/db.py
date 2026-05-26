"""SQLite connection helpers and schema initialisation for the fitness tracker."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

DEFAULT_DB_PATH = Path(__file__).resolve().parent / "data" / "fitness.db"

EXPECTED_TABLES = (
    "foods",
    "meal_entries",
    "water_entries",
    "weight_entries",
    "exercise_entries",
    "user_goals",
    "user_profile",
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS foods (
    id INTEGER PRIMARY KEY,
    off_id TEXT UNIQUE,
    name TEXT NOT NULL,
    brand TEXT,
    serving_g REAL,
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    fiber_g REAL,
    cached_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS meal_entries (
    id INTEGER PRIMARY KEY,
    logged_at TEXT DEFAULT (datetime('now')),
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast','lunch','dinner','snack')),
    food_id INTEGER REFERENCES foods(id) ON DELETE SET NULL,
    food_name TEXT NOT NULL,
    quantity REAL NOT NULL,
    unit TEXT NOT NULL,
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    fiber_g REAL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS water_entries (
    id INTEGER PRIMARY KEY,
    logged_at TEXT DEFAULT (datetime('now')),
    date TEXT NOT NULL,
    amount_ml REAL NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS weight_entries (
    id INTEGER PRIMARY KEY,
    logged_at TEXT DEFAULT (datetime('now')),
    date TEXT NOT NULL UNIQUE,
    weight_kg REAL NOT NULL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS exercise_entries (
    id INTEGER PRIMARY KEY,
    logged_at TEXT DEFAULT (datetime('now')),
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('cardio','strength','flexibility','other')),
    duration_min INTEGER,
    sets INTEGER,
    reps INTEGER,
    weight_kg REAL,
    distance_km REAL,
    calories_burned REAL,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS user_goals (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    calorie_goal REAL DEFAULT 2000,
    protein_goal_g REAL DEFAULT 150,
    carbs_goal_g REAL DEFAULT 200,
    fat_goal_g REAL DEFAULT 65,
    fiber_goal_g REAL DEFAULT 30,
    water_goal_ml REAL DEFAULT 2500,
    weight_goal_kg REAL,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    age INTEGER,
    sex TEXT CHECK (sex IN ('male', 'female')),
    height_cm REAL,
    activity_level TEXT CHECK (activity_level IN (
        'sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'
    )),
    updated_at TEXT DEFAULT (datetime('now'))
);
"""


def get_db_path() -> Path:
    override = os.environ.get("FITNESS_DB_PATH")
    return Path(override) if override else DEFAULT_DB_PATH


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    try:
        conn.execute("PRAGMA journal_mode = WAL")
        conn.execute("PRAGMA foreign_keys = ON")
        conn.row_factory = sqlite3.Row
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(SCHEMA)
        conn.execute("INSERT OR IGNORE INTO user_goals (id) VALUES (1)")
        conn.execute("INSERT OR IGNORE INTO user_profile (id) VALUES (1)")
        conn.commit()


if __name__ == "__main__":
    init_db()
    print(f"Initialised database at {get_db_path()}")
