// Run with:  npm test      (uses Node's built-in test runner, no extra packages)
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDoseMap,
  describeSchedule,
  doseKey,
  emptyForm,
  findDueSlots,
  formatTime,
  isScheduledOn,
  reminderState,
  todaysSlots,
  toDateKey,
  validateReminderForm,
  weekdayIndex,
} from "./reminderLogic.js";

// Wed 28 Oct 2026, local time
const at = (h, m, day = 28) => new Date(2026, 9, day, h, m, 0);

const base = {
  id: "r1",
  name: "Metformin",
  dosage: "500 mg",
  frequency: "daily",
  days: [],
  times: ["08:00", "20:00"],
  start_date: "2026-10-01",
  end_date: null,
  instructions: "",
  notifications_enabled: true,
  paused: false,
};

test("weekday index is Monday-based", () => {
  assert.equal(weekdayIndex("2026-10-26"), 0); // Monday
  assert.equal(weekdayIndex("2026-10-28"), 2); // Wednesday
  assert.equal(weekdayIndex("2026-11-01"), 6); // Sunday
});

test("toDateKey uses local date", () => {
  assert.equal(toDateKey(at(23, 59)), "2026-10-28");
  assert.equal(toDateKey(at(0, 1)), "2026-10-28");
});

test("12-hour time formatting", () => {
  assert.equal(formatTime("00:05"), "12:05 AM");
  assert.equal(formatTime("08:00"), "8:00 AM");
  assert.equal(formatTime("12:00"), "12:00 PM");
  assert.equal(formatTime("20:30"), "8:30 PM");
});

test("schedule rules: dates and weekdays", () => {
  assert.equal(isScheduledOn(base, "2026-09-30"), false);
  assert.equal(isScheduledOn(base, "2026-10-01"), true);
  const ended = { ...base, end_date: "2026-10-10" };
  assert.equal(isScheduledOn(ended, "2026-10-10"), true);
  assert.equal(isScheduledOn(ended, "2026-10-11"), false);

  const weekly = { ...base, frequency: "weekly", days: [0, 2] }; // Mon, Wed
  assert.equal(isScheduledOn(weekly, "2026-10-28"), true);
  assert.equal(isScheduledOn(weekly, "2026-10-29"), false);
});

test("reminder state", () => {
  assert.equal(reminderState(base, "2026-10-28"), "active");
  assert.equal(reminderState({ ...base, paused: true }, "2026-10-28"), "paused");
  assert.equal(reminderState({ ...base, start_date: "2026-11-01" }, "2026-10-28"), "upcoming");
  assert.equal(reminderState({ ...base, end_date: "2026-10-27" }, "2026-10-28"), "ended");
});

test("describeSchedule", () => {
  assert.equal(describeSchedule(base), "Every day · 8:00 AM, 8:00 PM");
  assert.equal(
    describeSchedule({ ...base, frequency: "weekly", days: [0, 4], times: ["09:30"] }),
    "Mon, Fri · 9:30 AM"
  );
});

test("today's slots: pending, overdue, taken, skipped", () => {
  const map = buildDoseMap([
    { reminder_id: "r1", date: "2026-10-28", time: "08:00", status: "taken" },
  ]);
  assert.deepEqual(todaysSlots(base, map, at(7, 0)), [
    { time: "08:00", status: "taken" },
    { time: "20:00", status: "pending" },
  ]);
  assert.deepEqual(todaysSlots(base, new Map(), at(21, 0)), [
    { time: "08:00", status: "overdue" },
    { time: "20:00", status: "overdue" },
  ]);
  const skipped = buildDoseMap([
    { reminder_id: "r1", date: "2026-10-28", time: "20:00", status: "skipped" },
  ]);
  assert.equal(todaysSlots(base, skipped, at(21, 0))[1].status, "skipped");
});

test("no slots when paused, ended, not started or not scheduled today", () => {
  const now = at(7, 0);
  assert.deepEqual(todaysSlots({ ...base, paused: true }, new Map(), now), []);
  assert.deepEqual(todaysSlots({ ...base, end_date: "2026-10-20" }, new Map(), now), []);
  assert.deepEqual(todaysSlots({ ...base, start_date: "2026-11-02" }, new Map(), now), []);
  assert.deepEqual(todaysSlots({ ...base, frequency: "weekly", days: [4] }, new Map(), now), []);
});

test("notifications fire at the scheduled minute and shortly after", () => {
  const map = new Map();
  assert.equal(findDueSlots([base], map, at(7, 59)).length, 0);
  assert.equal(findDueSlots([base], map, at(8, 0)).length, 1);
  assert.equal(findDueSlots([base], map, at(8, 9)).length, 1);
  assert.equal(findDueSlots([base], map, at(8, 10)).length, 0); // window passed
  const due = findDueSlots([base], map, at(20, 3));
  assert.equal(due[0].time, "20:00");
  assert.equal(due[0].key, doseKey("r1", "2026-10-28", "20:00"));
});

test("notifications respect paused, per-reminder switch, dates, weekdays and logged doses", () => {
  const now = at(8, 0);
  assert.equal(findDueSlots([{ ...base, paused: true }], new Map(), now).length, 0);
  assert.equal(findDueSlots([{ ...base, notifications_enabled: false }], new Map(), now).length, 0);
  assert.equal(findDueSlots([{ ...base, end_date: "2026-10-27" }], new Map(), now).length, 0);
  assert.equal(findDueSlots([{ ...base, start_date: "2026-10-29" }], new Map(), now).length, 0);
  assert.equal(findDueSlots([{ ...base, frequency: "weekly", days: [3] }], new Map(), now).length, 0);

  const answered = buildDoseMap([
    { reminder_id: "r1", date: "2026-10-28", time: "08:00", status: "taken" },
  ]);
  assert.equal(findDueSlots([base], answered, now).length, 0);
});

test("several medicines due at the same time are all reported", () => {
  const second = { ...base, id: "r2", name: "Aspirin", times: ["08:00"] };
  assert.equal(findDueSlots([base, second], new Map(), at(8, 0)).length, 2);
});

// ------------------------------------------------------------- form validation

const filled = () => ({
  ...emptyForm("2026-10-28"),
  name: "  Vitamin   D ",
  dosage: " 1000  IU ",
  times: ["20:00", "08:00"],
  instructions: " With food ",
});

test("valid form produces a tidy payload", () => {
  const { errors, payload } = validateReminderForm(filled(), "2026-10-28");
  assert.deepEqual(errors, {});
  assert.deepEqual(payload, {
    name: "Vitamin D",
    dosage: "1000 IU",
    frequency: "daily",
    days: [],
    times: ["08:00", "20:00"],
    start_date: "2026-10-28",
    end_date: null,
    instructions: "With food",
    notifications_enabled: true,
  });
});

test("form validation catches invalid input", () => {
  const check = (changes, field, today = "2026-10-28", originalEnd = null) => {
    const { errors, payload } = validateReminderForm({ ...filled(), ...changes }, today, originalEnd);
    assert.equal(payload, null, `${field} should block saving`);
    assert.ok(errors[field], `expected an error for ${field}`);
  };

  check({ name: "   " }, "name");
  check({ name: "x".repeat(101) }, "name");
  check({ name: "***" }, "name");
  check({ dosage: "" }, "dosage");
  check({ dosage: "y".repeat(61) }, "dosage");
  check({ frequency: "weekly", days: [] }, "days");
  check({ times: [] }, "times");
  check({ times: ["08:00", ""] }, "times");
  check({ times: ["08:00", "08:00"] }, "times");
  check({ times: Array.from({ length: 13 }, (_, i) => `${String(i).padStart(2, "0")}:00`) }, "times");
  check({ start_date: "" }, "start_date");
  check({ end_date: "2026-10-01" }, "end_date"); // before start
  check({ start_date: "2026-10-01", end_date: "2026-10-20" }, "end_date"); // already passed
  check({ instructions: "z".repeat(301) }, "instructions");
});

test("an already-ended reminder can be edited without changing its end date", () => {
  const form = { ...filled(), start_date: "2026-10-01", end_date: "2026-10-20" };
  const { errors } = validateReminderForm(form, "2026-10-28", "2026-10-20");
  assert.deepEqual(errors, {});
});

test("weekly payload sorts days; daily payload has none", () => {
  const weekly = { ...filled(), frequency: "weekly", days: [4, 0, 2] };
  assert.deepEqual(validateReminderForm(weekly, "2026-10-28").payload.days, [0, 2, 4]);
  const daily = { ...filled(), frequency: "daily", days: [1] };
  assert.deepEqual(validateReminderForm(daily, "2026-10-28").payload.days, []);
});
