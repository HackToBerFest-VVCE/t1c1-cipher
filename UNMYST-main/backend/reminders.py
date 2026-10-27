"""Medication reminders API for UNMYST.

Design rules
------------
* UNMYST never suggests, prescribes, or adjusts medicines or dosages. Every
  value stored here is typed in by the user and returned exactly as entered
  (only whitespace is tidied).
* Reminders and the taken/skipped history are saved to a small JSON file so
  they survive page refreshes and server restarts. The file is written
  atomically (temp file + rename) so a crash cannot leave it half-written.
* Times are wall-clock "HH:MM" values in the user's own local time. Notifications
  are delivered by the frontend while the app is open.
"""

from __future__ import annotations

import json
import os
import re
import tempfile
import threading
import uuid
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import (
    BaseModel,
    ConfigDict,
    ValidationInfo,
    field_validator,
    model_validator,
)

BACKEND_DIR = Path(__file__).resolve().parent
# Override with UNMYST_REMINDERS_FILE if you want the data stored elsewhere.
DATA_FILE = Path(
    os.getenv("UNMYST_REMINDERS_FILE", BACKEND_DIR / "data" / "reminders.json")
)

MAX_REMINDERS = 50
MAX_TIMES_PER_REMINDER = 12
DOSE_HISTORY_DAYS = 120
MIN_DATE = date(2000, 1, 1)
MAX_DATE = date(2100, 12, 31)

TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")

router = APIRouter(prefix="/api/reminders", tags=["medication reminders"])
_lock = threading.RLock()


# --------------------------------------------------------------------------
# Text helpers
# --------------------------------------------------------------------------


def _tidy(value: str) -> str:
    """Collapse runs of whitespace and trim."""
    return re.sub(r"\s+", " ", value).strip()


def _compare_key(value: str) -> str:
    """Case- and whitespace-insensitive key used for duplicate detection."""
    return re.sub(r"\s+", "", value).casefold()


def _has_control_chars(value: str, allow_newline: bool = False) -> bool:
    return any(
        (ord(ch) < 32 and not (allow_newline and ch in "\n\r\t")) or ord(ch) == 127
        for ch in value
    )


# --------------------------------------------------------------------------
# Request models (validation lives here)
# --------------------------------------------------------------------------


class ReminderIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    dosage: str
    frequency: Literal["daily", "weekly"] = "daily"
    days: list[int] = []  # 0 = Monday ... 6 = Sunday (only used for "weekly")
    times: list[str]
    start_date: date
    end_date: Optional[date] = None
    instructions: str = ""
    notifications_enabled: bool = True

    @field_validator("name")
    @classmethod
    def _name(cls, value: str) -> str:
        if _has_control_chars(value):
            raise ValueError("Medicine name contains invalid characters.")
        value = _tidy(value)
        if not value:
            raise ValueError("Medicine name is required.")
        if len(value) > 100:
            raise ValueError("Medicine name must be 100 characters or fewer.")
        if not any(ch.isalnum() for ch in value):
            raise ValueError("Medicine name must include letters or numbers.")
        return value

    @field_validator("dosage")
    @classmethod
    def _dosage(cls, value: str) -> str:
        if _has_control_chars(value):
            raise ValueError("Dosage contains invalid characters.")
        value = _tidy(value)
        if not value:
            raise ValueError("Dosage is required (for example: 500 mg, 1 tablet).")
        if len(value) > 60:
            raise ValueError("Dosage must be 60 characters or fewer.")
        if not any(ch.isalnum() for ch in value):
            raise ValueError("Dosage must include letters or numbers.")
        return value

    @field_validator("days")
    @classmethod
    def _days(cls, value: list[int], info: ValidationInfo) -> list[int]:
        if info.data.get("frequency") != "weekly":
            return []
        if not value:
            raise ValueError("Choose at least one day of the week.")
        if any(isinstance(d, bool) or d < 0 or d > 6 for d in value):
            raise ValueError("Days must be between Monday and Sunday.")
        return sorted(set(value))

    @field_validator("times")
    @classmethod
    def _times(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("Add at least one reminder time.")
        if len(value) > MAX_TIMES_PER_REMINDER:
            raise ValueError(
                f"You can add up to {MAX_TIMES_PER_REMINDER} times per medicine."
            )
        for item in value:
            if not TIME_RE.match(item):
                raise ValueError("Times must look like 08:30 (24-hour HH:MM).")
        if len(set(value)) != len(value):
            raise ValueError("The same time was added more than once.")
        return sorted(value)

    @field_validator("start_date")
    @classmethod
    def _start(cls, value: date) -> date:
        if not MIN_DATE <= value <= MAX_DATE:
            raise ValueError("Start date is out of range.")
        return value

    @field_validator("end_date")
    @classmethod
    def _end(cls, value: Optional[date], info: ValidationInfo) -> Optional[date]:
        if value is None:
            return None
        if not MIN_DATE <= value <= MAX_DATE:
            raise ValueError("End date is out of range.")
        start = info.data.get("start_date")
        if start and value < start:
            raise ValueError("End date cannot be before the start date.")
        return value

    @field_validator("instructions")
    @classmethod
    def _instructions(cls, value: str) -> str:
        if _has_control_chars(value, allow_newline=True):
            raise ValueError("Instructions contain invalid characters.")
        value = value.replace("\r\n", "\n").strip()
        if len(value) > 300:
            raise ValueError("Instructions must be 300 characters or fewer.")
        return value


class ReminderPatch(BaseModel):
    """Small partial update: pause/resume and notification switch only."""

    model_config = ConfigDict(extra="forbid")

    paused: Optional[bool] = None
    notifications_enabled: Optional[bool] = None

    @model_validator(mode="after")
    def _at_least_one(self):
        if self.paused is None and self.notifications_enabled is None:
            raise ValueError("Nothing to update.")
        return self


class DoseIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: date
    time: str
    status: Literal["taken", "skipped"]

    @field_validator("time")
    @classmethod
    def _time(cls, value: str) -> str:
        if not TIME_RE.match(value):
            raise ValueError("Time must look like 08:30 (24-hour HH:MM).")
        return value


# --------------------------------------------------------------------------
# Storage
# --------------------------------------------------------------------------


def _empty_store() -> dict:
    return {"reminders": [], "doses": []}


def _load() -> dict:
    if not DATA_FILE.exists():
        return _empty_store()
    try:
        data = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        if not isinstance(data, dict):
            raise ValueError("unexpected structure")
        data.setdefault("reminders", [])
        data.setdefault("doses", [])
        return data
    except (OSError, ValueError) as exc:
        # Never overwrite a file we cannot read; that would destroy user data.
        raise HTTPException(
            status_code=500,
            detail="Saved reminders could not be read. Check backend/data/reminders.json.",
        ) from exc


def _prune_doses(doses: list[dict]) -> list[dict]:
    cutoff = (date.today() - timedelta(days=DOSE_HISTORY_DAYS)).isoformat()
    return [d for d in doses if d.get("date", "") >= cutoff]


def _save(data: dict) -> None:
    data["doses"] = _prune_doses(data["doses"])
    tmp_name = None
    try:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_name = tempfile.mkstemp(
            dir=DATA_FILE.parent, prefix=".reminders-", suffix=".tmp"
        )
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(data, handle, indent=2, ensure_ascii=False)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(tmp_name, DATA_FILE)
    except OSError as exc:
        if tmp_name and os.path.exists(tmp_name):
            try:
                os.unlink(tmp_name)
            except OSError:
                pass
        raise HTTPException(
            status_code=500, detail="Reminders could not be saved. Please try again."
        ) from exc


# --------------------------------------------------------------------------
# Domain helpers
# --------------------------------------------------------------------------


def _find(data: dict, reminder_id: str) -> dict:
    for item in data["reminders"]:
        if item["id"] == reminder_id:
            return item
    raise HTTPException(status_code=404, detail="Reminder not found.")


def _find_duplicate(candidate: dict, data: dict, ignore_id: str | None = None):
    """Same medicine + dosage, sharing a time, on overlapping dates and days."""
    c_start = date.fromisoformat(candidate["start_date"])
    c_end = (
        date.fromisoformat(candidate["end_date"]) if candidate["end_date"] else date.max
    )
    c_days = set(candidate["days"]) if candidate["frequency"] == "weekly" else set(range(7))

    for other in data["reminders"]:
        if other["id"] == ignore_id:
            continue
        if _compare_key(other["name"]) != _compare_key(candidate["name"]):
            continue
        if _compare_key(other["dosage"]) != _compare_key(candidate["dosage"]):
            continue
        shared_times = sorted(set(other["times"]) & set(candidate["times"]))
        if not shared_times:
            continue
        o_start = date.fromisoformat(other["start_date"])
        o_end = date.fromisoformat(other["end_date"]) if other["end_date"] else date.max
        if c_start > o_end or o_start > c_end:
            continue
        o_days = set(other["days"]) if other["frequency"] == "weekly" else set(range(7))
        if not (c_days & o_days):
            continue
        return other, shared_times[0]
    return None


def _scheduled_on(reminder: dict, day: date) -> bool:
    if day < date.fromisoformat(reminder["start_date"]):
        return False
    if reminder["end_date"] and day > date.fromisoformat(reminder["end_date"]):
        return False
    if reminder["frequency"] == "weekly":
        return day.weekday() in reminder["days"]
    return True


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# --------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------


@router.get("")
def list_reminders():
    with _lock:
        data = _load()
        return {
            "reminders": data["reminders"],
            "doses": _prune_doses(data["doses"]),
        }


@router.post("", status_code=201)
def create_reminder(payload: ReminderIn):
    with _lock:
        data = _load()

        if len(data["reminders"]) >= MAX_REMINDERS:
            raise HTTPException(
                status_code=400,
                detail=f"You can keep up to {MAX_REMINDERS} medicine reminders.",
            )

        record = {
            "id": uuid.uuid4().hex,
            **payload.model_dump(mode="json"),
            "paused": False,
            "created_at": _now(),
            "updated_at": _now(),
        }

        duplicate = _find_duplicate(record, data)
        if duplicate:
            _, time_ = duplicate
            raise HTTPException(
                status_code=409,
                detail=(
                    f"A reminder for {record['name']} ({record['dosage']}) at {time_} "
                    "already exists for these dates. Edit that reminder instead."
                ),
            )

        data["reminders"].append(record)
        _save(data)
        return record


@router.put("/{reminder_id}")
def update_reminder(reminder_id: str, payload: ReminderIn):
    with _lock:
        data = _load()
        existing = _find(data, reminder_id)

        updated = {
            **existing,
            **payload.model_dump(mode="json"),
            "updated_at": _now(),
        }

        duplicate = _find_duplicate(updated, data, ignore_id=reminder_id)
        if duplicate:
            _, time_ = duplicate
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Another reminder for {updated['name']} ({updated['dosage']}) "
                    f"at {time_} already exists for these dates."
                ),
            )

        existing.update(updated)
        _save(data)
        return existing


@router.patch("/{reminder_id}")
def patch_reminder(reminder_id: str, payload: ReminderPatch):
    with _lock:
        data = _load()
        reminder = _find(data, reminder_id)

        if payload.paused is not None:
            reminder["paused"] = payload.paused
        if payload.notifications_enabled is not None:
            reminder["notifications_enabled"] = payload.notifications_enabled
        reminder["updated_at"] = _now()

        _save(data)
        return reminder


@router.delete("/{reminder_id}")
def delete_reminder(reminder_id: str):
    with _lock:
        data = _load()
        _find(data, reminder_id)
        data["reminders"] = [r for r in data["reminders"] if r["id"] != reminder_id]
        data["doses"] = [d for d in data["doses"] if d["reminder_id"] != reminder_id]
        _save(data)
        return {"status": "deleted", "id": reminder_id}


@router.put("/{reminder_id}/doses")
def record_dose(reminder_id: str, payload: DoseIn):
    """Mark one scheduled dose as taken or skipped (can be changed later)."""
    with _lock:
        data = _load()
        reminder = _find(data, reminder_id)

        if payload.time not in reminder["times"]:
            raise HTTPException(
                status_code=400,
                detail=f"This reminder has no dose scheduled at {payload.time}.",
            )
        if not _scheduled_on(reminder, payload.date):
            raise HTTPException(
                status_code=400,
                detail="No dose of this medicine is scheduled on that date.",
            )
        # One day of slack so users ahead of the server's timezone are not blocked.
        if payload.date > date.today() + timedelta(days=1):
            raise HTTPException(
                status_code=400, detail="You cannot log a dose for a future date."
            )

        entry = {
            "reminder_id": reminder_id,
            "date": payload.date.isoformat(),
            "time": payload.time,
            "status": payload.status,
            "logged_at": _now(),
        }
        data["doses"] = [
            d
            for d in data["doses"]
            if not (
                d["reminder_id"] == reminder_id
                and d["date"] == entry["date"]
                and d["time"] == entry["time"]
            )
        ]
        data["doses"].append(entry)
        _save(data)
        return entry


@router.delete("/{reminder_id}/doses")
def clear_dose(
    reminder_id: str,
    date: date = Query(...),  # noqa: A002 - query parameter name is part of the API
    time: str = Query(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$"),
):
    """Undo a taken/skipped mark."""
    with _lock:
        data = _load()
        _find(data, reminder_id)
        day = date.isoformat()
        before = len(data["doses"])
        data["doses"] = [
            d
            for d in data["doses"]
            if not (
                d["reminder_id"] == reminder_id and d["date"] == day and d["time"] == time
            )
        ]
        if len(data["doses"]) == before:
            raise HTTPException(status_code=404, detail="No logged dose to undo.")
        _save(data)
        return {"status": "cleared", "reminder_id": reminder_id, "date": day, "time": time}
