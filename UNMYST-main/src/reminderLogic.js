// Pure helpers for medication reminders (no React, no network) so they are
// easy to test. Dates are local "YYYY-MM-DD" strings, times are "HH:MM".

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const MAX_TIMES = 12;
export const NOTIFY_WINDOW_MINUTES = 10;

const pad = (n) => String(n).padStart(2, "0");

export function toDateKey(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeKey(date = new Date()) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseDateKey(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Monday = 0 ... Sunday = 6 (matches the backend).
export function weekdayIndex(dateKey) {
  return (parseDateKey(dateKey).getDay() + 6) % 7;
}

export function minutesOf(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(time) {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${pad(m)} ${suffix}`;
}

export function formatDate(dateKey, language = "en") {
  const locale = language === "hi" ? "hi-IN" : language === "te" ? "te-IN" : "en-GB";
  return parseDateKey(dateKey).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isScheduledOn(reminder, dateKey) {
  if (dateKey < reminder.start_date) return false;
  if (reminder.end_date && dateKey > reminder.end_date) return false;
  if (reminder.frequency === "weekly") {
    return reminder.days.includes(weekdayIndex(dateKey));
  }
  return true;
}

// "paused" | "upcoming" | "ended" | "active"
export function reminderState(reminder, todayKey) {
  if (reminder.paused) return "paused";
  if (reminder.end_date && todayKey > reminder.end_date) return "ended";
  if (todayKey < reminder.start_date) return "upcoming";
  return "active";
}

export function describeSchedule(reminder, language = "en") {
  const times = reminder.times.map(formatTime).join(", ");
  const locale = language === "hi" ? "hi-IN" : language === "te" ? "te-IN" : "en-GB";

  if (reminder.frequency === "weekly") {
    const monday = new Date(2024, 0, 1);
    const days = reminder.days
      .map((day) => new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + day)
        .toLocaleDateString(locale, { weekday: "short" }))
      .join(", ");
    return `${days} · ${times}`;
  }
  const everyDay = language === "hi" ? "हर दिन" : language === "te" ? "ప్రతి రోజు" : "Every day";
  return `${everyDay} · ${times}`;
}

export function doseKey(reminderId, dateKey, time) {
  return `${reminderId}|${dateKey}|${time}`;
}

export function buildDoseMap(doses) {
  const map = new Map();
  for (const dose of doses) {
    map.set(doseKey(dose.reminder_id, dose.date, dose.time), dose.status);
  }
  return map;
}

// Today's doses for one reminder: status is taken | skipped | pending | overdue.
// Returns [] when the reminder is paused, ended, not started, or not due today.
export function todaysSlots(reminder, doseMap, now = new Date()) {
  const todayKey = toDateKey(now);
  if (reminderState(reminder, todayKey) !== "active") return [];
  if (!isScheduledOn(reminder, todayKey)) return [];

  const nowMinutes = minutesOf(toTimeKey(now));

  return reminder.times.map((time) => {
    const logged = doseMap.get(doseKey(reminder.id, todayKey, time));
    let status = logged;
    if (!status) status = minutesOf(time) < nowMinutes ? "overdue" : "pending";
    return { time, status };
  });
}

// Doses whose time has arrived (within the last few minutes), that still need
// an answer, for reminders that have notifications switched on.
export function findDueSlots(
  reminders,
  doseMap,
  now = new Date(),
  windowMinutes = NOTIFY_WINDOW_MINUTES
) {
  const todayKey = toDateKey(now);
  const nowMinutes = minutesOf(toTimeKey(now));
  const due = [];

  for (const reminder of reminders) {
    if (!reminder.notifications_enabled) continue;
    if (reminderState(reminder, todayKey) !== "active") continue;
    if (!isScheduledOn(reminder, todayKey)) continue;

    for (const time of reminder.times) {
      const late = nowMinutes - minutesOf(time);
      if (late < 0 || late >= windowMinutes) continue;
      if (doseMap.has(doseKey(reminder.id, todayKey, time))) continue;

      due.push({
        reminder,
        time,
        key: doseKey(reminder.id, todayKey, time),
      });
    }
  }

  return due;
}

export function emptyForm(todayKey = toDateKey()) {
  return {
    name: "",
    dosage: "",
    frequency: "daily",
    days: [],
    times: ["08:00"],
    start_date: todayKey,
    end_date: "",
    instructions: "",
    notifications_enabled: true,
  };
}

export function formFromReminder(reminder) {
  return {
    name: reminder.name,
    dosage: reminder.dosage,
    frequency: reminder.frequency,
    days: [...reminder.days],
    times: [...reminder.times],
    start_date: reminder.start_date,
    end_date: reminder.end_date || "",
    instructions: reminder.instructions || "",
    notifications_enabled: reminder.notifications_enabled,
  };
}

const tidy = (value) => value.replace(/\s+/g, " ").trim();

// Returns { errors, payload }. `payload` is only set when there are no errors.
// `originalEnd` lets an old (already ended) reminder be edited without being
// forced to move its end date.
export function validateReminderForm(form, todayKey = toDateKey(), originalEnd = null) {
  const errors = {};
  const name = tidy(form.name);
  const dosage = tidy(form.dosage);
  const instructions = form.instructions.trim();

  if (!name) errors.name = "Medicine name is required.";
  else if (name.length > 100) errors.name = "Medicine name must be 100 characters or fewer.";
  else if (!/[\p{L}\p{N}]/u.test(name)) errors.name = "Medicine name must include letters or numbers.";

  if (!dosage) errors.dosage = "Dosage is required (for example: 500 mg, 1 tablet).";
  else if (dosage.length > 60) errors.dosage = "Dosage must be 60 characters or fewer.";
  else if (!/[\p{L}\p{N}]/u.test(dosage)) errors.dosage = "Dosage must include letters or numbers.";

  if (form.frequency === "weekly" && form.days.length === 0) {
    errors.days = "Choose at least one day of the week.";
  }

  const times = form.times;
  if (times.length === 0) {
    errors.times = "Add at least one reminder time.";
  } else if (times.length > MAX_TIMES) {
    errors.times = `You can add up to ${MAX_TIMES} times per medicine.`;
  } else if (times.some((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t))) {
    errors.times = "Fill in every reminder time (or remove the empty one).";
  } else if (new Set(times).size !== times.length) {
    errors.times = "The same time was added more than once.";
  }

  if (!form.start_date) {
    errors.start_date = "Choose a start date.";
  }

  if (form.end_date) {
    if (form.start_date && form.end_date < form.start_date) {
      errors.end_date = "End date cannot be before the start date.";
    } else if (form.end_date < todayKey && form.end_date !== originalEnd) {
      errors.end_date = "End date has already passed.";
    }
  }

  if (instructions.length > 300) {
    errors.instructions = "Instructions must be 300 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) return { errors, payload: null };

  return {
    errors,
    payload: {
      name,
      dosage,
      frequency: form.frequency,
      days: form.frequency === "weekly" ? [...form.days].sort((a, b) => a - b) : [],
      times: [...times].sort(),
      start_date: form.start_date,
      end_date: form.end_date || null,
      instructions,
      notifications_enabled: form.notifications_enabled,
    },
  };
}
