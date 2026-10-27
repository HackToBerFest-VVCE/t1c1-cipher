import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Download,
  LoaderCircle,
  Mic,
  Square,
  Trash2,
} from "lucide-react";

const DATABASE_NAME = "unmyst-doctor-visit-recordings";
const STORE_NAME = "recordings";
const VISIT_COUNT_KEY = "unmyst-hospital-visit-count";

function openDatabase() {
  if (!("indexedDB" in window)) {
    return Promise.reject(new Error("Recording storage is unavailable in this browser."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Could not open local recording storage."));
  });
}

async function getRecordings() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => {
      database.close();
      resolve(request.result.sort((first, second) => second.createdAt - first.createdAt));
    };
    request.onerror = () => {
      database.close();
      reject(new Error("Could not load saved recordings."));
    };
  });
}

async function saveRecording(recording) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(recording);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error("Could not save this recording in the browser."));
    };
  });
}

async function removeRecording(id) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(new Error("Could not delete this recording."));
    };
  });
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function createRecordingId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function DoctorVisitNotes({ t, language }) {
  const [visitCount, setVisitCount] = useState(() => {
    const savedCount = Number(localStorage.getItem(VISIT_COUNT_KEY));
    return Number.isSafeInteger(savedCount) && savedCount >= 0 ? savedCount : 0;
  });
  const [recordings, setRecordings] = useState([]);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState("");
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedAtRef = useRef(0);
  const audioUrlsRef = useRef({});

  function syncRecordings(nextRecordings) {
    const previousUrls = audioUrlsRef.current;
    const nextUrls = {};
    const recordingsWithUrls = nextRecordings.map((item) => {
      const audioUrl = previousUrls[item.id] || URL.createObjectURL(item.blob);
      nextUrls[item.id] = audioUrl;
      return { ...item, audioUrl };
    });
    Object.entries(previousUrls).forEach(([id, url]) => {
      if (!nextUrls[id]) URL.revokeObjectURL(url);
    });
    audioUrlsRef.current = nextUrls;
    setRecordings(recordingsWithUrls);
  }

  useEffect(() => {
    let mounted = true;
    getRecordings()
      .then((savedRecordings) => {
        if (mounted) syncRecordings(savedRecordings);
      })
      .catch((loadError) => {
        if (mounted) setError(loadError.message);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(VISIT_COUNT_KEY, String(visitCount));
  }, [visitCount]);

  useEffect(() => {
    if (!recording) return undefined;
    const timer = window.setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 500);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    Object.values(audioUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
  }, []);

  async function startRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Audio recording is not supported by this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new window.MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();
      setElapsedSeconds(0);

      mediaRecorder.addEventListener("dataavailable", (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      });
      mediaRecorder.addEventListener("error", () => {
        setError("The recording stopped unexpectedly.");
      });
      mediaRecorder.addEventListener("stop", async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        setSaving(true);
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        if (!blob.size) {
          setError("No audio was captured. Please try recording again.");
          setSaving(false);
          return;
        }
        const newRecording = {
          id: createRecordingId(),
          createdAt: Date.now(),
          durationSeconds: Math.max(1, Math.floor((Date.now() - startedAtRef.current) / 1000)),
          blob,
        };

        try {
          await saveRecording(newRecording);
          syncRecordings(await getRecordings());
        } catch (saveError) {
          setError(saveError.message);
        } finally {
          setSaving(false);
        }
      });

      mediaRecorder.start();
      setRecording(true);
    } catch (recordingError) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      setError(
        recordingError.name === "NotAllowedError"
          ? "Microphone permission was denied. Allow microphone access to record."
          : "Could not start recording. Check that a microphone is available."
      );
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function handleDelete(id) {
    setError("");
    try {
      await removeRecording(id);
      syncRecordings(await getRecordings());
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  const dateLocale = language === "hi" ? "hi-IN" : language === "te" ? "te-IN" : "en-GB";

  return (
    <section className="workspace-card visit-notes-card">
      <div className="visit-overview">
        <div className="visit-overview-copy">
          <span className="eyebrow">{t("CARE HISTORY")}</span>
          <h2>{t("Doctor Visit Notes")}</h2>
          <p>{t("Record your visit conversation and keep the audio on this device.")}</p>
        </div>
        <label className="visit-count-control">
          <span>{t("Hospital visits")}</span>
          <input
            aria-label={t("Hospital visits")}
            type="number"
            min="0"
            max="9999"
            step="1"
            value={visitCount}
            onChange={(event) => {
              const nextCount = Number(event.target.value);
              setVisitCount(Number.isSafeInteger(nextCount) && nextCount >= 0
                ? Math.min(nextCount, 9999)
                : 0);
            }}
          />
        </label>
      </div>

      <section className="visit-recorder" aria-labelledby="visit-recorder-title">
        <div className="visit-recorder-copy">
          <span className="visit-recorder-icon"><Mic size={22} /></span>
          <div>
            <h3 id="visit-recorder-title">{t("Record a visit")}</h3>
            <p>{t("Ask everyone in the conversation for permission before recording.")}</p>
          </div>
        </div>
        <div className="visit-recorder-actions">
          {recording ? (
            <button className="button button-danger" type="button" onClick={stopRecording}>
              <Square size={17} /> {t("Stop recording")}
            </button>
          ) : (
            <button
              className="button button-primary"
              type="button"
              onClick={startRecording}
              disabled={saving}
            >
              {saving ? <LoaderCircle size={18} className="spin" /> : <Mic size={18} />}
              {saving ? t("Saving recording...") : t("Start recording")}
            </button>
          )}
          {recording && (
            <span className="recording-timer" role="timer" aria-live="off">
              <span className="recording-indicator" />
              <Clock3 size={15} /> {formatDuration(elapsedSeconds)}
            </span>
          )}
        </div>
        <p className="visit-privacy-note">
          {t("Recordings stay in this browser and are not uploaded. Automatic transcription is not included.")}
        </p>
      </section>

      {error && <p className="inline-error" role="alert">{t(error)}</p>}

      <div className="visit-recordings-heading">
        <div>
          <h3>{t("Saved recordings")}</h3>
          <p>{t("{count} recordings saved on this device.").replace("{count}", String(recordings.length))}</p>
        </div>
        {recordings.length > 0 && (
          <span className="visit-recording-count">
            <CheckCircle2 size={16} /> {recordings.length}
          </span>
        )}
      </div>

      {recordings.length === 0 ? (
        <div className="visit-empty-state">
          <Mic size={22} />
          <p>{t("Your saved audio recordings will appear here.")}</p>
        </div>
      ) : (
        <div className="visit-recordings-list">
          {recordings.map((item) => {
            const extension = item.blob.type.includes("mp4")
              ? "mp4"
              : item.blob.type.includes("ogg")
                ? "ogg"
                : "webm";
            const fileName = `doctor-visit-${new Date(item.createdAt).toISOString().slice(0, 10)}.${extension}`;
            const recordedDate = new Date(item.createdAt).toLocaleString(dateLocale);
            return (
              <article className="visit-recording" key={item.id}>
                <div className="visit-recording-meta">
                  <strong>{recordedDate}</strong>
                  <span><Clock3 size={14} /> {formatDuration(item.durationSeconds)}</span>
                </div>
                <audio
                  controls
                  preload="none"
                  src={item.audioUrl}
                  aria-label={`${t("Recording from")} ${recordedDate}`}
                >
                  {t("Your browser cannot play this recording.")}
                </audio>
                <div className="visit-recording-actions">
                  {item.audioUrl && (
                    <a className="small-action" href={item.audioUrl} download={fileName}>
                      <Download size={15} /> {t("Download audio")}
                    </a>
                  )}
                  <button
                    className="small-action rem-danger"
                    type="button"
                    onClick={() => handleDelete(item.id)}
                    aria-label={`${t("Delete recording")} ${new Date(item.createdAt).toLocaleDateString(dateLocale)}`}
                  >
                    <Trash2 size={15} /> {t("Delete")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
