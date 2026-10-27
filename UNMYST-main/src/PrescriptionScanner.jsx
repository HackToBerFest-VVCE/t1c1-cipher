import { Fragment, useEffect, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { CheckCircle2, FileImage, LoaderCircle, ScanText, Upload } from "lucide-react";
import {
  buildOcrLines,
  getMedicineCandidates,
  getOcrReviewWords,
  hasWordsWithoutConfidence,
  joinOcrLines,
} from "./prescriptionOcr.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

async function prepareOcrImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(2, 2000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    bitmap.close();
    throw new Error("Image processing is unavailable.");
  }

  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const grayscale = pixels.data[index] * 0.299
      + pixels.data[index + 1] * 0.587
      + pixels.data[index + 2] * 0.114;
    const contrast = Math.max(0, Math.min(255, (grayscale - 128) * 1.18 + 128));
    pixels.data[index] = contrast;
    pixels.data[index + 1] = contrast;
    pixels.data[index + 2] = contrast;
  }
  context.putImageData(pixels, 0, 0);
  return canvas;
}

export default function PrescriptionScanner({ t }) {
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [ocrLines, setOcrLines] = useState([]);
  const [medicineCandidates, setMedicineCandidates] = useState([]);
  const [progress, setProgress] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const previewUrlRef = useRef("");

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  function replaceImage(file) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = file ? URL.createObjectURL(file) : "";
    setPreviewUrl(previewUrlRef.current);
    setImage(file);
  }

  function selectImage(file) {
    if (!file) return;
    setError("");
    setOcrLines([]);
    setMedicineCandidates([]);
    setProgress(0);

    if (!file.type.startsWith("image/")) {
      replaceImage(null);
      setError("Choose a photo file such as JPG, PNG, or WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      replaceImage(null);
      setError("The photo must be 10 MB or smaller.");
      return;
    }

    replaceImage(file);
  }

  async function scanPrescription() {
    if (!image || scanning) return;

    setScanning(true);
    setError("");
    setProgress(0);
    let worker;

    try {
      const processedImage = await prepareOcrImage(image);
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(Math.round(message.progress * 100));
          }
        },
      });
      const { data } = await worker.recognize(processedImage, {}, { text: true, blocks: true });
      const text = data.text.trim();
      const lines = buildOcrLines(data.blocks, text);
      setOcrLines(lines);
      setMedicineCandidates(getMedicineCandidates(lines));
      if (!text) setError("No text was recognized. Try a clearer, well-lit photo.");
    } catch {
      setError("OCR could not read this photo. Try another image with clearer print.");
    } finally {
      await worker?.terminate();
      setScanning(false);
    }
  }

  function updateOcrWord(wordId, changes) {
    const updatedLines = ocrLines.map((line) => ({
      ...line,
      words: line.words.map((word) => word.id === wordId ? { ...word, ...changes } : word),
    }));
    setOcrLines(updatedLines);
  }

  const recognizedText = joinOcrLines(ocrLines);
  const reviewWords = getOcrReviewWords(ocrLines);
  const confidenceUnavailable = hasWordsWithoutConfidence(ocrLines);
  const wordsNeedingReview = reviewWords.filter((word) => !word.resolved);
  const resolvedWords = reviewWords.filter((word) => word.resolved);

  return (
    <section className="rx-scan-panel" aria-labelledby="rx-scan-heading">
      <div className="rx-scan-heading">
        <span className="rx-scan-icon"><ScanText size={20} /></span>
        <div>
          <h3 id="rx-scan-heading">{t("Scan a prescription")}</h3>
          <p>{t("Choose a clear photo to extract printed medicine text on this device.")}</p>
        </div>
      </div>

      <div className="rx-scan-controls">
        <label className="rx-photo-button">
          <Upload size={17} />
          <span>{t(image ? "Choose a different photo" : "Take or choose a photo")}</span>
          <input
            className="visually-hidden"
            type="file"
            accept="image/*"
            capture="environment"
            disabled={scanning}
            onChange={(event) => selectImage(event.target.files?.[0])}
          />
        </label>
        <button
          className="button button-primary"
          type="button"
          onClick={scanPrescription}
          disabled={!image || scanning}
        >
          {scanning ? <LoaderCircle size={17} className="spin" /> : <ScanText size={17} />}
          {scanning ? t("Scanning...") : t("Extract text")}
        </button>
      </div>

      <p className="rx-scan-privacy">{t("The photo is processed in your browser and is not uploaded. OCR may misread medicine names; verify everything before saving.")}</p>

      {scanning && (
        <div className="rx-progress" role="status" aria-live="polite">
          <span>{t("Reading prescription")}</span>
          <progress max="100" value={progress} aria-label={t("OCR progress")} />
          <span>{progress}%</span>
        </div>
      )}

      {error && <p className="inline-error" role="alert">{t(error)}</p>}

      {previewUrl && (
        <div className="rx-preview">
          <img src={previewUrl} alt={t("Selected prescription photo")} />
          {!recognizedText && <span><FileImage size={15} /> {image.name}</span>}
        </div>
      )}

      {recognizedText && (
        <div className="rx-results">
          <div className="rem-field rx-document-view">
            <span>{t("Extracted prescription text")}</span>
            <div className="rx-recognized-document" aria-label={t("Extracted prescription text")}>
              {ocrLines.map((line) => (
                <p key={line.id}>
                  {line.words.map((word, wordIndex) => (
                    <Fragment key={word.id}>
                      {!line.preserveSpacing && wordIndex > 0 && " "}
                      {word.isWhitespace ? word.text : (
                        <span className={word.needsReview ? word.resolved ? "rx-ocr-resolved" : "rx-ocr-low" : ""}>
                          {word.text}
                        </span>
                      )}
                    </Fragment>
                  ))}
                </p>
              ))}
            </div>
          </div>

          <section className="rx-candidate-panel" aria-labelledby="rx-candidate-heading">
            <div className="rx-candidate-heading">
              <h4 id="rx-candidate-heading">{t("Possible medicine names")}</h4>
              <span>{medicineCandidates.length}</span>
            </div>
            <p className="rx-candidate-note">
              {t("Suggestions only. Verify each name against the prescription photo before using it.")}
            </p>
            {medicineCandidates.length > 0 ? (
              <ul className="rx-candidate-list">
                {medicineCandidates.map((candidate) => (
                  <li className="rx-candidate-item" key={`${candidate.source}-${candidate.name}`}>
                    <strong>{candidate.name}</strong>
                    <small>{t(candidate.source === "catalog"
                      ? "Matched a common medicine-name list"
                      : "Found near a strength or dosage form")}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rx-review-empty">{t("No possible medicine names found. Enter the medicine manually in the reminder form.")}</p>
            )}
          </section>

          <section className="rx-review-section" aria-labelledby="rx-needs-review-heading">
            <div className="rx-review-heading">
              <h4 id="rx-needs-review-heading">{t("Needs review")}</h4>
              <span>{wordsNeedingReview.length}</span>
            </div>
            <p className="rx-review-help">
              {t("Check the photo and correct each red term. Check the box after verifying it.")}
            </p>
            {confidenceUnavailable && (
              <p className="rx-confidence-notice" role="note">
                {t("Some word confidence scores are unavailable. Compare the entire extracted text with the photo before using it.")}
              </p>
            )}
            {wordsNeedingReview.length === 0 && !confidenceUnavailable ? (
              <p className="rx-review-empty">{t("No uncertain terms need review.")}</p>
            ) : wordsNeedingReview.length > 0 ? (
              <div className="rx-review-list">
                {wordsNeedingReview.map((word) => (
                  <div className="rx-review-item" key={word.id}>
                    <input
                      type="checkbox"
                      checked={false}
                      aria-label={`${t("Mark term as resolved")}: ${word.text}`}
                      onChange={() => updateOcrWord(word.id, { resolved: true })}
                    />
                    <div className="rx-review-term">
                      <input
                        className="rem-input rx-review-term-input"
                        value={word.text}
                        aria-label={t("Correct uncertain term")}
                        onChange={(event) => updateOcrWord(word.id, { text: event.target.value })}
                      />
                      <small>
                        {word.confidence === null
                          ? t("Confidence unavailable")
                          : `${t("Confidence")}: ${Math.round(word.confidence)}%`}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          {resolvedWords.length > 0 && (
            <section className="rx-review-section rx-resolved-section" aria-labelledby="rx-resolved-heading">
              <div className="rx-review-heading">
                <h4 id="rx-resolved-heading">{t("Resolved")}</h4>
                <span><CheckCircle2 size={15} /> {resolvedWords.length}</span>
              </div>
              <div className="rx-review-list">
                {resolvedWords.map((word) => (
                  <label className="rx-resolved-item" key={word.id}>
                    <input
                      type="checkbox"
                      checked
                      aria-label={`${t("Return term to review")}: ${word.text}`}
                      onChange={() => updateOcrWord(word.id, { resolved: false })}
                    />
                    <span>{word.text}</span>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
