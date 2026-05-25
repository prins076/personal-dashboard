import os
import sqlite3

import pytest

from db import EXPECTED_TABLES, get_connection, init_db


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "fitness.db"
    monkeypatch.setenv("FITNESS_DB_PATH", str(path))
    return path


def test_init_db_creates_all_six_tables(db_path):
    init_db()

    with get_connection() as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        ).fetchall()
    tables = {r[0] for r in rows}

    for expected in EXPECTED_TABLES:
        assert expected in tables, f"expected table {expected!r} to be created"


def test_init_db_seeds_singleton_goals_row(db_path):
    init_db()

    with get_connection() as conn:
        row = conn.execute("SELECT id FROM user_goals WHERE id = 1").fetchone()

    assert row is not None, "user_goals singleton row (id=1) must be seeded"
    assert row[0] == 1


def test_init_db_is_idempotent(db_path):
    init_db()
    init_db()  # second call should not raise or duplicate the goals row

    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM user_goals").fetchone()[0]

    assert count == 1


def test_connection_has_wal_and_foreign_keys(db_path):
    init_db()

    with get_connection() as conn:
        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        fk = conn.execute("PRAGMA foreign_keys").fetchone()[0]

    assert journal_mode.lower() == "wal"
    assert fk == 1


def test_meal_entries_check_constraint_rejects_bad_meal_type(db_path):
    init_db()

    with get_connection() as conn, pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO meal_entries (date, meal_type, food_name, quantity, unit) "
            "VALUES (?, ?, ?, ?, ?)",
            ("2026-05-25", "midnight-snack", "x", 1, "g"),
        )
        conn.commit()


def test_weight_entries_date_is_unique(db_path):
    init_db()

    with get_connection() as conn:
        conn.execute(
            "INSERT INTO weight_entries (date, weight_kg) VALUES (?, ?)",
            ("2026-05-25", 78.2),
        )
        conn.commit()
        with pytest.raises(sqlite3.IntegrityError):
            conn.execute(
                "INSERT INTO weight_entries (date, weight_kg) VALUES (?, ?)",
                ("2026-05-25", 78.5),
            )
            conn.commit()
