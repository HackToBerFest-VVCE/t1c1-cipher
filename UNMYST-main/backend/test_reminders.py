"""Run from the backend folder:  python -m pytest -q

Only needs fastapi, httpx and pytest (no Gemini key required).
"""

import json
from datetime import date, timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import reminders


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(reminders, "DATA_FILE", tmp_path / "data" / "reminders.json")
    app = FastAPI()
    app.include_router(reminders.router)
    return TestClient(app)


TODAY = date.today()


def payload(**overrides):
    base = {
        "name": "Metformin",
        "dosage": "500 mg",
        "frequency": "daily",
        "days": [],
        "times": ["08:00", "20:00"],
        "start_date": TODAY.isoformat(),
        "end_date": (TODAY + timedelta(days=30)).isoformat(),
        "instructions": "After food",
        "notifications_enabled": True,
    }
    base.update(overrides)
    return base


def create(client, **overrides):
    return client.post("/api/reminders", json=payload(**overrides))


def field_errors(response):
    return {e["loc"][-1]: e["msg"] for e in response.json()["detail"]}


# ---------------------------------------------------------------- create / list


def test_create_and_list(client):
    res = create(client)
    assert res.status_code == 201
    body = res.json()
    assert body["name"] == "Metformin"
    assert body["dosage"] == "500 mg"  # stored exactly as typed
    assert body["times"] == ["08:00", "20:00"]
    assert body["paused"] is False and body["id"]

    listing = client.get("/api/reminders").json()
    assert [r["id"] for r in listing["reminders"]] == [body["id"]]
    assert listing["doses"] == []


def test_multiple_medicines_and_times(client):
    create(client)
    create(client, name="Vitamin D", dosage="1000 IU", times=["09:30"])
    create(client, name="Aspirin", dosage="75 mg", times=["07:00", "13:00", "21:00"])
    assert len(client.get("/api/reminders").json()["reminders"]) == 3


def test_times_are_sorted_and_text_is_tidied(client):
    res = create(client, name="  Vitamin   D ", dosage=" 1000   IU ", times=["20:00", "08:00"])
    body = res.json()
    assert body["name"] == "Vitamin D"
    assert body["dosage"] == "1000 IU"
    assert body["times"] == ["08:00", "20:00"]


def test_optional_fields(client):
    res = create(client, end_date=None, instructions="")
    assert res.status_code == 201
    assert res.json()["end_date"] is None
    assert res.json()["instructions"] == ""


def test_weekly_reminder(client):
    res = create(client, frequency="weekly", days=[4, 0, 0])
    assert res.status_code == 201
    assert res.json()["days"] == [0, 4]


def test_daily_ignores_days(client):
    assert create(client, frequency="daily", days=[1, 2]).json()["days"] == []


# ---------------------------------------------------------------- validation


@pytest.mark.parametrize(
    "overrides, field",
    [
        ({"name": ""}, "name"),
        ({"name": "   "}, "name"),
        ({"name": "x" * 101}, "name"),
        ({"name": "!!!"}, "name"),
        ({"name": "Bad\x00name"}, "name"),
        ({"dosage": ""}, "dosage"),
        ({"dosage": "y" * 61}, "dosage"),
        ({"dosage": "---"}, "dosage"),
        ({"times": []}, "times"),
        ({"times": ["25:00"]}, "times"),
        ({"times": ["8:00"]}, "times"),
        ({"times": ["08:60"]}, "times"),
        ({"times": ["08:00", "08:00"]}, "times"),
        ({"times": [f"{h:02d}:00" for h in range(13)]}, "times"),
        ({"frequency": "weekly", "days": []}, "days"),
        ({"frequency": "weekly", "days": [7]}, "days"),
        ({"frequency": "weekly", "days": [-1]}, "days"),
        ({"frequency": "hourly"}, "frequency"),
        ({"start_date": "not-a-date"}, "start_date"),
        ({"start_date": "1999-12-31"}, "start_date"),
        ({"end_date": (TODAY - timedelta(days=1)).isoformat()}, "end_date"),
        ({"instructions": "z" * 301}, "instructions"),
    ],
)
def test_invalid_payloads_are_rejected(client, overrides, field):
    res = create(client, **overrides)
    assert res.status_code == 422, res.text
    assert field in field_errors(res)
    assert client.get("/api/reminders").json()["reminders"] == []


def test_unknown_fields_rejected(client):
    body = payload()
    body["recommended_dose"] = "double it"
    assert client.post("/api/reminders", json=body).status_code == 422


def test_reminder_limit(client, monkeypatch):
    monkeypatch.setattr(reminders, "MAX_REMINDERS", 2)
    assert create(client, name="A1").status_code == 201
    assert create(client, name="B2").status_code == 201
    assert create(client, name="C3").status_code == 400


# ---------------------------------------------------------------- duplicates


def test_duplicate_is_blocked_case_and_space_insensitive(client):
    assert create(client).status_code == 201
    res = create(client, name="  metFORMIN", dosage="500mg", times=["20:00"])
    assert res.status_code == 409
    assert "already exists" in res.json()["detail"]


def test_not_duplicate_when_dose_time_dates_or_days_differ(client):
    assert create(client).status_code == 201
    assert create(client, dosage="850 mg").status_code == 201  # different strength
    assert create(client, times=["12:00"]).status_code == 201  # different time
    later = TODAY + timedelta(days=60)
    assert (
        create(client, start_date=later.isoformat(), end_date=None).status_code == 201
    )  # non-overlapping dates
    assert (
        create(
            client,
            name="Warfarin",
            dosage="2 mg",
            frequency="weekly",
            days=[0],
        ).status_code
        == 201
    )
    assert (
        create(
            client,
            name="Warfarin",
            dosage="2 mg",
            frequency="weekly",
            days=[1],
        ).status_code
        == 201
    )  # same medicine, different weekday
    assert (
        create(
            client,
            name="Warfarin",
            dosage="2 mg",
            frequency="weekly",
            days=[1, 2],
        ).status_code
        == 409
    )  # Tuesday overlaps


# ---------------------------------------------------------------- update


def test_update_and_duplicate_rules(client):
    first = create(client).json()
    other = create(client, name="Aspirin", dosage="75 mg", times=["09:00"]).json()

    res = client.put(
        f"/api/reminders/{first['id']}",
        json=payload(dosage="1000 mg", times=["07:30"], instructions=""),
    )
    assert res.status_code == 200
    assert res.json()["dosage"] == "1000 mg"
    assert res.json()["id"] == first["id"]
    assert res.json()["created_at"] == first["created_at"]

    # Saving a reminder without changes is not a duplicate of itself.
    assert client.put(f"/api/reminders/{other['id']}", json=payload(
        name="Aspirin", dosage="75 mg", times=["09:00"])).status_code == 200

    # Turning one reminder into a copy of another is blocked.
    clash = client.put(
        f"/api/reminders/{other['id']}",
        json=payload(dosage="1000 mg", times=["07:30"]),
    )
    assert clash.status_code == 409

    assert client.put("/api/reminders/missing", json=payload()).status_code == 404
    assert client.put(f"/api/reminders/{first['id']}", json=payload(name="")).status_code == 422


def test_update_keeps_paused_state(client):
    r = create(client).json()
    client.patch(f"/api/reminders/{r['id']}", json={"paused": True})
    res = client.put(f"/api/reminders/{r['id']}", json=payload(instructions="New note"))
    assert res.json()["paused"] is True


# ---------------------------------------------------------------- pause / notify


def test_pause_resume_and_notifications(client):
    r = create(client).json()
    url = f"/api/reminders/{r['id']}"

    assert client.patch(url, json={"paused": True}).json()["paused"] is True
    assert client.patch(url, json={"paused": False}).json()["paused"] is False
    assert client.patch(url, json={"notifications_enabled": False}).json()[
        "notifications_enabled"
    ] is False

    assert client.patch(url, json={}).status_code == 422
    assert client.patch(url, json={"name": "Changed"}).status_code == 422
    assert client.patch("/api/reminders/missing", json={"paused": True}).status_code == 404


# ---------------------------------------------------------------- doses


def test_mark_taken_skipped_change_and_undo(client):
    r = create(client).json()
    url = f"/api/reminders/{r['id']}/doses"
    day = TODAY.isoformat()

    taken = client.put(url, json={"date": day, "time": "08:00", "status": "taken"})
    assert taken.status_code == 200 and taken.json()["status"] == "taken"

    client.put(url, json={"date": day, "time": "20:00", "status": "skipped"})
    doses = client.get("/api/reminders").json()["doses"]
    assert {(d["time"], d["status"]) for d in doses} == {("08:00", "taken"), ("20:00", "skipped")}

    # Changing your mind replaces the entry rather than adding a second one.
    client.put(url, json={"date": day, "time": "08:00", "status": "skipped"})
    doses = client.get("/api/reminders").json()["doses"]
    assert len(doses) == 2
    assert [d["status"] for d in doses if d["time"] == "08:00"] == ["skipped"]

    assert client.delete(url, params={"date": day, "time": "08:00"}).status_code == 200
    assert len(client.get("/api/reminders").json()["doses"]) == 1
    assert client.delete(url, params={"date": day, "time": "08:00"}).status_code == 404


def test_dose_validation(client):
    r = create(client, frequency="weekly", days=[(TODAY.weekday() + 1) % 7]).json()
    url = f"/api/reminders/{r['id']}/doses"
    day = TODAY.isoformat()

    # Not a scheduled weekday
    assert client.put(url, json={"date": day, "time": "08:00", "status": "taken"}).status_code == 400

    r2 = create(client, name="Other", times=["08:00"]).json()
    url2 = f"/api/reminders/{r2['id']}/doses"
    # Time not on this reminder
    assert client.put(url2, json={"date": day, "time": "09:00", "status": "taken"}).status_code == 400
    # Before start date
    yesterday = (TODAY - timedelta(days=1)).isoformat()
    assert client.put(url2, json={"date": yesterday, "time": "08:00", "status": "taken"}).status_code == 400
    # Far future
    future = (TODAY + timedelta(days=10)).isoformat()
    assert client.put(url2, json={"date": future, "time": "08:00", "status": "taken"}).status_code == 400
    # Bad status / bad time
    assert client.put(url2, json={"date": day, "time": "08:00", "status": "done"}).status_code == 422
    assert client.put(url2, json={"date": day, "time": "8am", "status": "taken"}).status_code == 422
    # Unknown reminder
    assert client.put("/api/reminders/nope/doses", json={"date": day, "time": "08:00", "status": "taken"}).status_code == 404


# ---------------------------------------------------------------- delete / persistence


def test_delete_removes_reminder_and_its_history(client):
    r = create(client).json()
    keep = create(client, name="Aspirin", dosage="75 mg", times=["09:00"]).json()
    day = TODAY.isoformat()
    client.put(f"/api/reminders/{r['id']}/doses", json={"date": day, "time": "08:00", "status": "taken"})
    client.put(f"/api/reminders/{keep['id']}/doses", json={"date": day, "time": "09:00", "status": "taken"})

    assert client.delete(f"/api/reminders/{r['id']}").status_code == 200
    data = client.get("/api/reminders").json()
    assert [x["id"] for x in data["reminders"]] == [keep["id"]]
    assert [d["reminder_id"] for d in data["doses"]] == [keep["id"]]
    assert client.delete(f"/api/reminders/{r['id']}").status_code == 404


def test_data_persists_to_disk_and_survives_a_new_client(client, tmp_path):
    r = create(client).json()
    client.put(
        f"/api/reminders/{r['id']}/doses",
        json={"date": TODAY.isoformat(), "time": "08:00", "status": "taken"},
    )
    saved = json.loads((tmp_path / "data" / "reminders.json").read_text())
    assert saved["reminders"][0]["id"] == r["id"]
    assert saved["doses"][0]["status"] == "taken"

    app = FastAPI()
    app.include_router(reminders.router)
    fresh = TestClient(app)  # simulates a server restart
    again = fresh.get("/api/reminders").json()
    assert again["reminders"][0]["name"] == "Metformin"
    assert again["doses"][0]["time"] == "08:00"


def test_corrupt_file_is_not_overwritten(client, tmp_path):
    path = tmp_path / "data" / "reminders.json"
    path.parent.mkdir(parents=True)
    path.write_text("{ this is not json")
    assert client.get("/api/reminders").status_code == 500
    assert create(client).status_code == 500
    assert path.read_text() == "{ this is not json"


def test_old_doses_are_pruned(client, tmp_path):
    r = create(client, start_date="2020-01-01", end_date=None).json()
    path = tmp_path / "data" / "reminders.json"
    data = json.loads(path.read_text())
    data["doses"].append(
        {"reminder_id": r["id"], "date": "2020-02-01", "time": "08:00", "status": "taken", "logged_at": "x"}
    )
    path.write_text(json.dumps(data))
    client.patch(f"/api/reminders/{r['id']}", json={"paused": True})  # any save prunes
    assert client.get("/api/reminders").json()["doses"] == []
