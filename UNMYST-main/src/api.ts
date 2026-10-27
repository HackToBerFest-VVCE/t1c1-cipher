
const API_BASE_URL = "http://127.0.0.1:8000";

export async function checkBackend() {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error("Could not connect to the UNMYST backend.");
  }

  return response.json();
}

export async function uploadMedicalDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/documents/extract`,
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.detail || "Document upload failed.");
  }

  return result;
}

export async function explainMedicalDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(
    `${API_BASE_URL}/api/documents/explain`,
    {
      method: "POST",
      body: formData,
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.detail || "Could not generate the medical document explanation."
    );
  }

  return result;
}

export async function explainMedicalText(text: string) {
  const response = await fetch(
    `${API_BASE_URL}/api/gemma/explain`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    }
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result.detail || "Could not generate the explanation."
    );
  }

  return result;
}


/* ------------------------------------------------------------------ */
/* Medication reminders                                                */
/* ------------------------------------------------------------------ */

export type ReminderPayload = {
  name: string;
  dosage: string;
  frequency: "daily" | "weekly";
  days: number[];
  times: string[];
  start_date: string;
  end_date: string | null;
  instructions: string;
  notifications_enabled: boolean;
};

export class ApiError extends Error {
  status: number;
  fieldErrors: Record<string, string>;

  constructor(
    message: string,
    status = 0,
    fieldErrors: Record<string, string> = {}
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

// FastAPI returns either a string `detail` or a list of validation problems.
function parseDetail(detail: unknown, fallback: string) {
  if (typeof detail === "string") return { message: detail, fieldErrors: {} };

  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};

    for (const item of detail) {
      const field = String(item?.loc?.[item.loc.length - 1] ?? "form");
      const text = String(item?.msg ?? "Invalid value.").replace(
        /^Value error, /,
        ""
      );
      if (!fieldErrors[field]) fieldErrors[field] = text;
    }

    const first = Object.values(fieldErrors)[0];
    return { message: first || fallback, fieldErrors };
  }

  return { message: fallback, fieldErrors: {} };
}

async function reminderRequest(
  path: string,
  options: RequestInit = {},
  fallback = "Something went wrong with your reminders."
) {
  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}/api/reminders${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      "Could not reach the UNMYST backend. Check that it is running."
    );
  }

  let result: any = null;
  try {
    result = await response.json();
  } catch {
    // empty or non-JSON body
  }

  if (!response.ok) {
    const { message, fieldErrors } = parseDetail(result?.detail, fallback);
    throw new ApiError(message, response.status, fieldErrors);
  }

  return result;
}

export function listReminders() {
  return reminderRequest("", {}, "Could not load your reminders.");
}

export function createReminder(payload: ReminderPayload) {
  return reminderRequest(
    "",
    { method: "POST", body: JSON.stringify(payload) },
    "Could not save this reminder."
  );
}

export function updateReminder(id: string, payload: ReminderPayload) {
  return reminderRequest(
    `/${encodeURIComponent(id)}`,
    { method: "PUT", body: JSON.stringify(payload) },
    "Could not update this reminder."
  );
}

export function patchReminder(
  id: string,
  changes: { paused?: boolean; notifications_enabled?: boolean }
) {
  return reminderRequest(
    `/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(changes) },
    "Could not update this reminder."
  );
}

export function deleteReminder(id: string) {
  return reminderRequest(
    `/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "Could not delete this reminder."
  );
}

export function recordDose(
  id: string,
  dose: { date: string; time: string; status: "taken" | "skipped" }
) {
  return reminderRequest(
    `/${encodeURIComponent(id)}/doses`,
    { method: "PUT", body: JSON.stringify(dose) },
    "Could not record this dose."
  );
}

export function clearDose(id: string, date: string, time: string) {
  const query = new URLSearchParams({ date, time }).toString();

  return reminderRequest(
    `/${encodeURIComponent(id)}/doses?${query}`,
    { method: "DELETE" },
    "Could not undo this dose."
  );
}
