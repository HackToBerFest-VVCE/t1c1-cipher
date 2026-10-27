import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearDose,
  createReminder,
  deleteReminder,
  listReminders,
  patchReminder,
  recordDose,
  updateReminder,
} from "./api";
import {
  buildDoseMap,
  findDueSlots,
  formatTime,
  toDateKey,
} from "./reminderLogic";

const PREF_KEY = "unmyst.reminders.notifications"; // "on" | "off"
const FIRED_KEY = "unmyst.reminders.fired"; // { date, keys[] } so a refresh never re-alerts
const CHECK_EVERY_MS = 15000;

const supportsNotifications =
  typeof window !== "undefined" && "Notification" in window;

function readPreference() {
  try {
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

function writePreference(on) {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    // storage unavailable: the switch still works for this session
  }
}

function readFired(todayKey) {
  try {
    const saved = JSON.parse(localStorage.getItem(FIRED_KEY) || "{}");
    return saved.date === todayKey ? new Set(saved.keys) : new Set();
  } catch {
    return new Set();
  }
}

function writeFired(todayKey, keys) {
  try {
    localStorage.setItem(
      FIRED_KEY,
      JSON.stringify({ date: todayKey, keys: [...keys] })
    );
  } catch {
    // ignore
  }
}

function showSystemNotification(title, body, tag) {
  if (!supportsNotifications || Notification.permission !== "granted") {
    return false;
  }

  try {
    const notification = new Notification(title, {
      body,
      tag,
      icon: "/favicon.svg",
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

async function run(action) {
  try {
    return { ok: true, data: await action() };
  } catch (err) {
    return {
      ok: false,
      message: err?.message || "Something went wrong. Please try again.",
      fieldErrors: err?.fieldErrors || {},
    };
  }
}

export default function useMedicationReminders({ backendStatus, onAlert }) {
  const [reminders, setReminders] = useState([]);
  const [doses, setDoses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notificationsOn, setNotificationsOn] = useState(readPreference);
  const [permission, setPermission] = useState(
    supportsNotifications ? Notification.permission : "unsupported"
  );

  // ---------------------------------------------------------------- loading

  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    if (backendStatus !== "connected") return undefined;

    let active = true;

    listReminders()
      .then((data) => {
        if (!active) return;
        setReminders(data.reminders);
        setDoses(data.doses);
        setLoadError("");
        setLoaded(true);
      })
      .catch((err) => {
        if (active) setLoadError(err.message || "Could not load your reminders.");
      });

    return () => {
      active = false;
    };
  }, [backendStatus, reloadCount]);

  function reload() {
    setLoadError("");
    setReloadCount((count) => count + 1);
  }

  // ---------------------------------------------------------------- notifications

  const latest = useRef({ reminders, doses, notificationsOn, onAlert });
  useEffect(() => {
    latest.current = { reminders, doses, notificationsOn, onAlert };
  });

  const checkDue = useCallback(() => {
    const { reminders, doses, notificationsOn, onAlert } = latest.current;
    if (!notificationsOn || reminders.length === 0) return;

    const now = new Date();
    const todayKey = toDateKey(now);
    const fired = readFired(todayKey);
    const due = findDueSlots(reminders, buildDoseMap(doses), now).filter(
      (slot) => !fired.has(slot.key)
    );
    if (due.length === 0) return;

    due.forEach((slot) => fired.add(slot.key));
    writeFired(todayKey, fired);

    due.forEach(({ reminder, time, key }) => {
      const detail = reminder.instructions ? ` · ${reminder.instructions}` : "";
      showSystemNotification(
        `Time for ${reminder.name}`,
        `${reminder.dosage} at ${formatTime(time)}${detail}`,
        key
      );
    });

    // Always show an in-app message too (covers blocked/unsupported browsers).
    onAlert?.(
      "Medicine reminder: " +
        due
          .map(
            ({ reminder, time }) =>
              `${reminder.name} (${reminder.dosage}) at ${formatTime(time)}`
          )
          .join("; ")
    );
  }, []);

  // Run when the data changes, and on a timer / when the tab becomes visible.
  useEffect(() => {
    checkDue();
  }, [reminders, doses, notificationsOn, checkDue]);

  useEffect(() => {
    const refresh = () => {
      if (supportsNotifications) setPermission(Notification.permission);
      checkDue();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    const timer = setInterval(checkDue, CHECK_EVERY_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
    };
  }, [checkDue]);

  // A reminder saved a few minutes after its time should not alert straight away.
  function markCurrentlyDueAsFired(reminder) {
    const now = new Date();
    const todayKey = toDateKey(now);
    const fired = readFired(todayKey);
    findDueSlots([reminder], new Map(), now).forEach((slot) =>
      fired.add(slot.key)
    );
    writeFired(todayKey, fired);
  }

  async function requestPermission() {
    if (!supportsNotifications || Notification.permission !== "default") return;

    try {
      setPermission(await Notification.requestPermission());
    } catch {
      setPermission(Notification.permission);
    }
  }

  async function toggleNotifications() {
    if (notificationsOn) {
      setNotificationsOn(false);
      writePreference(false);
      return;
    }

    setNotificationsOn(true);
    writePreference(true);
    await requestPermission();
  }

  async function sendTestNotification() {
    await requestPermission();

    const shown = showSystemNotification(
      "UNMYST test notification",
      "This is how your medicine reminders will appear.",
      "unmyst-test"
    );

    onAlert?.(
      shown
        ? "Test notification sent."
        : "Test reminder: this is how alerts will appear inside UNMYST."
    );
  }

  // ---------------------------------------------------------------- actions
  // Every action resolves to { ok: true } or { ok: false, message, fieldErrors }.

  async function addReminder(payload) {
    const result = await run(() => createReminder(payload));
    if (result.ok) {
      markCurrentlyDueAsFired(result.data);
      setReminders((list) => [...list, result.data]);
    }
    return result;
  }

  async function editReminder(id, payload) {
    const result = await run(() => updateReminder(id, payload));
    if (result.ok) {
      markCurrentlyDueAsFired(result.data);
      setReminders((list) => list.map((r) => (r.id === id ? result.data : r)));
    }
    return result;
  }

  async function removeReminder(id) {
    const result = await run(() => deleteReminder(id));
    if (result.ok) {
      setReminders((list) => list.filter((r) => r.id !== id));
      setDoses((list) => list.filter((d) => d.reminder_id !== id));
    }
    return result;
  }

  async function changeReminder(id, changes) {
    const result = await run(() => patchReminder(id, changes));
    if (result.ok) {
      setReminders((list) => list.map((r) => (r.id === id ? result.data : r)));
    }
    return result;
  }

  const setPaused = (id, paused) => changeReminder(id, { paused });
  const setReminderNotifications = (id, enabled) =>
    changeReminder(id, { notifications_enabled: enabled });

  async function markDose(id, date, time, status) {
    const result = await run(() => recordDose(id, { date, time, status }));
    if (result.ok) {
      setDoses((list) => [
        ...list.filter(
          (d) => !(d.reminder_id === id && d.date === date && d.time === time)
        ),
        result.data,
      ]);
    }
    return result;
  }

  async function undoDose(id, date, time) {
    const result = await run(() => clearDose(id, date, time));
    if (result.ok) {
      setDoses((list) =>
        list.filter(
          (d) => !(d.reminder_id === id && d.date === date && d.time === time)
        )
      );
    }
    return result;
  }

  return {
    reminders,
    doses,
    loading: backendStatus === "connected" && !loaded && !loadError,
    loaded,
    loadError,
    reload,
    notificationsOn,
    permission,
    supportsNotifications,
    toggleNotifications,
    sendTestNotification,
    addReminder,
    editReminder,
    removeReminder,
    setPaused,
    setReminderNotifications,
    markDose,
    undoDose,
  };
}
