import { useEffect, useId, useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  LoaderCircle,
  Pause,
  Pencil,
  Pill,
  Play,
  Plus,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import PrescriptionScanner from "./PrescriptionScanner.jsx";
import {
  DAY_LABELS,
  DAY_NAMES,
  MAX_TIMES,
  buildDoseMap,
  describeSchedule,
  emptyForm,
  formFromReminder,
  formatDate,
  formatTime,
  reminderState,
  todaysSlots,
  toDateKey,
  validateReminderForm,
} from "./reminderLogic";

const STATE_LABEL = {
  active: "Active",
  paused: "Paused",
  upcoming: "Starts soon",
  ended: "Ended",
};

const STATE_ORDER = { active: 0, upcoming: 1, paused: 2, ended: 3 };

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return now;
}

/* ------------------------------------------------------------------ */
/* Add / edit form                                                     */
/* ------------------------------------------------------------------ */

function Field({ id, label, optional, error, hint, children, t }) {
  return (
    <div className="rem-field">
      <label htmlFor={id}>
        {label}
        {optional && <span className="rem-optional"> ({t("optional")})</span>}
      </label>
      {children}
      {hint && !error && <p className="rem-hint">{hint}</p>}
      {error && (
        <p className="rem-error" id={`${id}-error`} role="alert">
          {t(error)}
        </p>
      )}
    </div>
  );
}

function ReminderForm({ reminder, todayKey, onSubmit, onCancel, t }) {
  const uid = useId();
  const [form, setForm] = useState(() =>
    reminder ? formFromReminder(reminder) : emptyForm(todayKey)
  );
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const editing = Boolean(reminder);

  const id = (field) => `${uid}-${field}`;
  const update = (changes) => setForm((current) => ({ ...current, ...changes }));

  function setTime(index, value) {
    update({ times: form.times.map((t, i) => (i === index ? value : t)) });
  }

  function toggleDay(day) {
    update({
      days: form.days.includes(day)
        ? form.days.filter((d) => d !== day)
        : [...form.days, day],
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const { errors: found, payload } = validateReminderForm(
      form,
      todayKey,
      reminder?.end_date ?? null
    );
    setErrors(found);
    setFormError("");

    if (!payload) {
      setFormError(t("Please fix the highlighted fields."));
      return;
    }

    setSaving(true);
    const result = await onSubmit(payload);
    setSaving(false);

    if (!result.ok) {
      setErrors(result.fieldErrors || {});
      setFormError(result.message);
    }
  }

  return (
    <form
      className="rem-form"
      onSubmit={handleSubmit}
      noValidate
      aria-label={t(editing ? "Edit medicine reminder" : "Add medicine reminder")}
    >
      <div className="rem-form-heading">
        <h3>{t(editing ? "Edit medicine" : "Add a medicine")}</h3>
        <button
          type="button"
          className="icon-button"
          aria-label={t("Close form")}
          onClick={onCancel}
        >
          <X size={19} />
        </button>
      </div>

      <div className="rem-grid">
        <Field id={id("name")} label={t("Medicine name")} error={errors.name} t={t}>
          <input
            id={id("name")}
            className="rem-input"
            type="text"
            value={form.name}
            maxLength={120}
            autoComplete="off"
            placeholder={t("As written on your prescription")}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${id("name")}-error` : undefined}
            onChange={(e) => update({ name: e.target.value })}
          />
        </Field>

        <Field
          id={id("dosage")}
          label={t("Dosage")}
          error={errors.dosage}
          hint={t("Type exactly what your doctor prescribed, e.g. 500 mg or 1 tablet.")}
          t={t}
        >
          <input
            id={id("dosage")}
            className="rem-input"
            type="text"
            value={form.dosage}
            maxLength={80}
            autoComplete="off"
            aria-invalid={Boolean(errors.dosage)}
            aria-describedby={errors.dosage ? `${id("dosage")}-error` : undefined}
            onChange={(e) => update({ dosage: e.target.value })}
          />
        </Field>
      </div>

      <div className="rem-grid">
        <Field id={id("frequency")} label={t("How often")} error={errors.frequency} t={t}>
          <select
            id={id("frequency")}
            className="rem-input"
            value={form.frequency}
            onChange={(e) => update({ frequency: e.target.value })}
          >
            <option value="daily">{t("Every day")}</option>
            <option value="weekly">{t("On specific days of the week")}</option>
          </select>
        </Field>

        {form.frequency === "weekly" && (
          <Field id={id("days")} label={t("Which days")} error={errors.days} t={t}>
            <div className="rem-days" role="group" aria-label={t("Days of the week")}>
              {DAY_LABELS.map((label, day) => (
                <button
                  key={label}
                  type="button"
                  id={day === 0 ? id("days") : undefined}
                  className={`setting-chip ${
                    form.days.includes(day) ? "setting-active" : ""
                  }`}
                  aria-pressed={form.days.includes(day)}
                  aria-label={t(DAY_NAMES[day])}
                  onClick={() => toggleDay(day)}
                >
                  {t(label)}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>

      <Field
        id={id("time-0")}
        label={t("Reminder times")}
        error={errors.times}
        hint={t("Add one time for each dose you take in a day.")}
        t={t}
      >
        <div className="rem-times">
          {form.times.map((time, index) => (
            <div className="rem-time-row" key={index}>
              <input
                id={id(`time-${index}`)}
                className="rem-input"
                type="time"
                value={time}
                aria-label={`${t("Reminder time")} ${index + 1}`}
                aria-invalid={Boolean(errors.times)}
                onChange={(e) => setTime(index, e.target.value)}
              />
              {form.times.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`${t("Remove reminder time")} ${index + 1}`}
                  onClick={() =>
                    update({ times: form.times.filter((_, i) => i !== index) })
                  }
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
          {form.times.length < MAX_TIMES && (
            <button
              type="button"
              className="small-action"
              onClick={() => update({ times: [...form.times, ""] })}
            >
              <Plus size={15} /> {t("Add another time")}
            </button>
          )}
        </div>
      </Field>

      <div className="rem-grid">
        <Field id={id("start")} label={t("Start date")} error={errors.start_date} t={t}>
          <input
            id={id("start")}
            className="rem-input"
            type="date"
            value={form.start_date}
            aria-invalid={Boolean(errors.start_date)}
            onChange={(e) => update({ start_date: e.target.value })}
          />
        </Field>

        <Field
          id={id("end")}
          label={t("End date")}
          optional
          error={errors.end_date}
          hint={t("Leave empty if there is no end date.")}
          t={t}
        >
          <input
            id={id("end")}
            className="rem-input"
            type="date"
            value={form.end_date}
            min={form.start_date || undefined}
            aria-invalid={Boolean(errors.end_date)}
            onChange={(e) => update({ end_date: e.target.value })}
          />
        </Field>
      </div>

      <Field
        id={id("instructions")}
        label={t("Instructions")}
        optional
        error={errors.instructions}
        t={t}
      >
        <textarea
          id={id("instructions")}
          className="rem-input rem-textarea"
          rows={3}
          maxLength={320}
          value={form.instructions}
          placeholder={t("For example: take after food")}
          onChange={(e) => update({ instructions: e.target.value })}
        />
      </Field>

      <label className="rem-check">
        <input
          type="checkbox"
          checked={form.notifications_enabled}
          onChange={(e) => update({ notifications_enabled: e.target.checked })}
        />
        <span>{t("Notify me at these times")}</span>
      </label>

      {formError && (
        <div className="inline-error" role="alert">
          {t(formError)}
        </div>
      )}

      <div className="rem-form-actions">
        <button type="button" className="button button-secondary" onClick={onCancel}>
          {t("Cancel")}
        </button>
        <button type="submit" className="button button-primary" disabled={saving}>
          {saving ? (
            <>
              <LoaderCircle size={18} className="spin" /> {t("Saving...")}
            </>
          ) : (
            <>
              <Check size={18} /> {t(editing ? "Save changes" : "Save reminder")}
            </>
          )}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Reminder card                                                       */
/* ------------------------------------------------------------------ */

const DOSE_LABEL = {
  taken: "Taken",
  skipped: "Skipped",
  pending: "Upcoming",
  overdue: "Not marked yet",
};

function ReminderCard({
  reminder,
  now,
  doseMap,
  busy,
  confirmingDelete,
  onEdit,
  onPause,
  onNotify,
  onAskDelete,
  onCancelDelete,
  onDelete,
  onDose,
  onUndo,
  t,
  language,
}) {
  const todayKey = toDateKey(now);
  const state = reminderState(reminder, todayKey);
  const slots = todaysSlots(reminder, doseMap, now);
  const paused = reminder.paused;

  return (
    <article className={`rem-card rem-${state}`} aria-label={`${reminder.name} ${t("reminder")}`}>
      <div className="rem-card-top">
        <div className="feature-icon lavender rem-pill-icon">
          <Pill size={22} strokeWidth={1.9} />
        </div>
        <div className="rem-card-title">
          <h3>{reminder.name}</h3>
          <p>{reminder.dosage}</p>
        </div>
        <span className={`rem-badge rem-badge-${state}`}>{t(STATE_LABEL[state])}</span>
      </div>

      <ul className="rem-meta">
        <li>
          <Clock3 size={15} /> {describeSchedule(reminder, language)}
        </li>
        <li>
          <CalendarDays size={15} />
          {formatDate(reminder.start_date, language)}
          {reminder.end_date ? ` – ${formatDate(reminder.end_date, language)}` : ` · ${t("no end date")}`}
        </li>
        <li>
          {reminder.notifications_enabled ? <Bell size={15} /> : <BellOff size={15} />}
          {t(reminder.notifications_enabled ? "Notifications on" : "Notifications off")}
        </li>
      </ul>

      {reminder.instructions && (
        <p className="rem-instructions">
          <strong>{t("Instructions:")}</strong> {reminder.instructions}
        </p>
      )}

      {paused && (
        <p className="rem-note">{t("Paused: no notifications or dose checks until you resume.")}</p>
      )}

      {slots.length > 0 && (
        <div className="rem-doses">
          <span className="rem-doses-label">{t("TODAY")}</span>
          {slots.map(({ time, status }) => (
            <div className={`rem-dose rem-dose-${status}`} key={time}>
              <span className="rem-dose-time">{formatTime(time)}</span>
              <span className="rem-dose-status">
                {status === "taken" && <CheckCircle2 size={15} />}
                {t(DOSE_LABEL[status])}
              </span>

              <div className="rem-dose-actions">
                {status === "taken" || status === "skipped" ? (
                  <button
                    className="small-action"
                    disabled={busy}
                    aria-label={`Undo ${status} for ${reminder.name} at ${formatTime(time)}`}
                    onClick={() => onUndo(time)}
                  >
                    <Undo2 size={15} /> {t("Undo")}
                  </button>
                ) : (
                  <>
                    <button
                      className="small-action rem-taken"
                      disabled={busy}
                      aria-label={`Mark ${reminder.name} at ${formatTime(time)} as taken`}
                      onClick={() => onDose(time, "taken")}
                    >
                      <Check size={15} /> {t("Taken")}
                    </button>
                    <button
                      className="small-action"
                      disabled={busy}
                      aria-label={`Mark ${reminder.name} at ${formatTime(time)} as skipped`}
                      onClick={() => onDose(time, "skipped")}
                    >
                      <X size={15} /> {t("Skipped")}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {state === "active" && slots.length === 0 && (
        <p className="rem-note">{t("No dose is scheduled for today.")}</p>
      )}

      {confirmingDelete ? (
        <div className="rem-confirm" role="alertdialog" aria-label={t("Confirm delete")}>
          <span>{t("Delete reminder confirmation")}</span>
          <div className="rem-confirm-actions">
            <button className="small-action rem-danger" disabled={busy} onClick={onDelete}>
              <Trash2 size={15} /> {t("Yes, delete")}
            </button>
            <button className="small-action" onClick={onCancelDelete}>
              {t("Keep it")}
            </button>
          </div>
        </div>
      ) : (
        <div className="rem-card-actions">
          <button className="small-action" disabled={busy} onClick={onEdit}>
            <Pencil size={15} /> {t("Edit")}
          </button>
          <button className="small-action" disabled={busy} onClick={onPause}>
            {paused ? <Play size={15} /> : <Pause size={15} />}
            {t(paused ? "Resume" : "Pause")}
          </button>
          <button
            className="small-action"
            disabled={busy}
            aria-pressed={reminder.notifications_enabled}
            onClick={onNotify}
          >
            {reminder.notifications_enabled ? <BellOff size={15} /> : <Bell size={15} />}
            {t(reminder.notifications_enabled ? "Mute" : "Unmute")}
          </button>
          <button className="small-action rem-danger-outline" disabled={busy} onClick={onAskDelete}>
            <Trash2 size={15} /> {t("Delete")}
          </button>
        </div>
      )}
    </article>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Reminders({ medication, backendStatus, t, language }) {
  const {
    reminders,
    doses,
    loading,
    loaded,
    loadError,
    reload,
    notificationsOn,
    permission,
    toggleNotifications,
    sendTestNotification,
    addReminder,
    editReminder,
    removeReminder,
    setPaused,
    setReminderNotifications,
    markDose,
    undoDose,
  } = medication;

  const now = useNow();
  const todayKey = toDateKey(now);
  const [editor, setEditor] = useState(null); // null | { reminder?: object }
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [actionError, setActionError] = useState("");

  const doseMap = useMemo(() => buildDoseMap(doses), [doses]);

  const sorted = useMemo(() => {
    const today = toDateKey(now);
    return [...reminders].sort((a, b) => {
      const byState =
        STATE_ORDER[reminderState(a, today)] - STATE_ORDER[reminderState(b, today)];
      return byState || a.times[0].localeCompare(b.times[0]) || a.name.localeCompare(b.name);
    });
  }, [reminders, now]);

  const summary = useMemo(() => {
    let total = 0;
    let taken = 0;
    let waiting = 0;
    for (const reminder of reminders) {
      for (const slot of todaysSlots(reminder, doseMap, now)) {
        total += 1;
        if (slot.status === "taken") taken += 1;
        else if (slot.status !== "skipped") waiting += 1;
      }
    }
    return { total, taken, waiting };
  }, [reminders, doseMap, now]);

  const offline = backendStatus !== "connected";

  async function perform(id, action) {
    setBusyId(id);
    setActionError("");
    const result = await action();
    setBusyId(null);
    if (!result.ok) setActionError(result.message);
    return result;
  }

  async function submitForm(payload) {
    const result = editor?.reminder
      ? await editReminder(editor.reminder.id, payload)
      : await addReminder(payload);
    if (result.ok) setEditor(null);
    return result;
  }

  return (
    <section className="workspace-card rem-workspace" id="reminders-workspace">
      <div className="workspace-heading rem-heading">
        <div className="workspace-icon">
          <Bell size={25} />
        </div>
        <div className="rem-heading-text">
          <span className="eyebrow">{t("DAILY CARE")}</span>
          <h2>{t("Medication Reminders")}</h2>
          <p>{t("Add the medicines you take and get a reminder at the right time.")}</p>
        </div>
        <button
          className="button button-primary"
          disabled={offline || Boolean(editor)}
          onClick={() => setEditor({})}
        >
          <Plus size={18} /> {t("Add medicine")}
        </button>
      </div>

      <div className="rem-safety" role="note">
        <Info size={18} />
        <p>
          {t("UNMYST only reminds you about medicines you add yourself. It never suggests medicines or changes dosages. Follow your doctor's or pharmacist's instructions.")}
        </p>
      </div>

      <PrescriptionScanner t={t} />

      <div className="rem-notify-panel">
        <div className="rem-notify-text">
            <strong>{t("Notifications")}</strong>
          <p>
            {!notificationsOn && t("Notifications are switched off. You will not be alerted.")}
            {notificationsOn &&
              permission === "granted" &&
              t("You will be alerted at each scheduled time while UNMYST is open in your browser.")}
            {notificationsOn &&
              permission === "default" &&
              t("Allow notifications when your browser asks. Until then, alerts appear inside UNMYST.")}
            {notificationsOn &&
              permission === "denied" &&
              t("Browser notifications are blocked for this site. Alerts will appear inside UNMYST while it is open.")}
            {notificationsOn &&
              permission === "unsupported" &&
              t("This browser cannot show system notifications. Alerts will appear inside UNMYST while it is open.")}
          </p>
        </div>
        <div className="rem-notify-actions">
          <button
            className={`setting-chip ${notificationsOn ? "setting-active" : ""}`}
            aria-pressed={notificationsOn}
            onClick={toggleNotifications}
          >
            {notificationsOn ? <Bell size={16} /> : <BellOff size={16} />}
            {t(notificationsOn ? "Notifications on" : "Notifications off")}
          </button>
          <button className="setting-chip" onClick={sendTestNotification}>
            {t("Send test")}
          </button>
        </div>
      </div>

      {offline && (
        <div className="inline-warning">
          {backendStatus === "checking"
            ? t("Connecting to the UNMYST backend...")
            : t("The backend is not connected. Start your FastAPI server on port 8000 to view and save reminders.")}
        </div>
      )}

      {loadError && !offline && (
        <div className="inline-error" role="alert">
          {t(loadError)}{" "}
          <button className="rem-link" onClick={reload}>
            {t("Try again")}
          </button>
        </div>
      )}

      {actionError && (
        <div className="inline-error" role="alert">
          {t(actionError)}
        </div>
      )}

      {editor && (
        <ReminderForm
          key={editor.reminder?.id || "new"}
          reminder={editor.reminder}
          todayKey={todayKey}
          onSubmit={submitForm}
          onCancel={() => setEditor(null)}
          t={t}
        />
      )}

      {summary.total > 0 && (
        <div className="rem-summary" aria-live="polite">
          <CheckCircle2 size={18} />
          <span>
            {t("Today:")} <strong>{summary.taken}</strong> {t("of")} <strong>{summary.total}</strong> {t("doses taken")}
            {summary.waiting > 0 && ` · ${summary.waiting} ${t("still to mark")}`}
          </span>
        </div>
      )}

      {loading && !loaded && (
        <p className="rem-empty">
          <LoaderCircle size={18} className="spin" /> {t("Loading your reminders...")}
        </p>
      )}

      {loaded && reminders.length === 0 && !editor && (
        <div className="rem-empty-card">
          <div className="feature-icon blue">
            <Pill size={24} />
          </div>
          <h3>{t("No medicines added yet")}</h3>
          <p>{t("Choose “Add medicine” to set up your first reminder.")}</p>
        </div>
      )}

      <div className="rem-list">
        {sorted.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            now={now}
            doseMap={doseMap}
            busy={busyId === reminder.id}
            confirmingDelete={confirmId === reminder.id}
            onEdit={() => {
              setConfirmId(null);
              setEditor({ reminder });
              document
                .getElementById("reminders-workspace")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onPause={() => perform(reminder.id, () => setPaused(reminder.id, !reminder.paused))}
            onNotify={() =>
              perform(reminder.id, () =>
                setReminderNotifications(reminder.id, !reminder.notifications_enabled)
              )
            }
            onAskDelete={() => setConfirmId(reminder.id)}
            onCancelDelete={() => setConfirmId(null)}
            onDelete={async () => {
              const result = await perform(reminder.id, () => removeReminder(reminder.id));
              if (result.ok) {
                setConfirmId(null);
                if (editor?.reminder?.id === reminder.id) setEditor(null);
              }
            }}
            onDose={(time, status) =>
              perform(reminder.id, () => markDose(reminder.id, todayKey, time, status))
            }
            onUndo={(time) => perform(reminder.id, () => undoDose(reminder.id, todayKey, time))}
            t={t}
            language={language}
          />
        ))}
      </div>
    </section>
  );
}
