import assert from "node:assert/strict";
import test from "node:test";

import {
  buildOcrLines,
  getMedicineCandidates,
  getOcrReviewWords,
  hasWordsWithoutConfidence,
  joinOcrLines,
  LOW_CONFIDENCE_THRESHOLD,
} from "./prescriptionOcr.js";

test("flags low-confidence words and preserves word locations", () => {
  const lines = buildOcrLines([
    {
      paragraphs: [
        {
          lines: [
            {
              words: [
                { text: "Aspirin", confidence: 92, bbox: { x0: 1, y0: 2, x1: 3, y1: 4 } },
                { text: "10mg", confidence: LOW_CONFIDENCE_THRESHOLD - 1 },
              ],
            },
          ],
        },
      ],
    },
  ]);

  assert.equal(lines[0].words[0].needsReview, false);
  assert.equal(lines[0].words[1].needsReview, true);
  assert.deepEqual(getOcrReviewWords(lines).map((word) => word.text), ["10mg"]);
  assert.deepEqual(lines[0].words[0].bbox, { x0: 1, y0: 2, x1: 3, y1: 4 });
});

test("does not flag every word when confidence data is missing", () => {
  const lines = buildOcrLines([
    { paragraphs: [{ lines: [{ words: [{ text: "Take", confidence: 88 }, { text: "daily" }] }] }] },
    { paragraphs: [{ lines: [{ words: [{ text: "After", confidence: 90 }, { text: "food", confidence: 91 }] }] }] },
  ]);

  assert.deepEqual(getOcrReviewWords(lines), []);
  assert.equal(hasWordsWithoutConfidence(lines), true);
  assert.equal(joinOcrLines(lines), "Take daily\nAfter food");
});

test("does not turn punctuation or short fragments into review terms", () => {
  const lines = buildOcrLines([
    { paragraphs: [{ lines: [{ words: [
      { text: ",", confidence: 1 },
      { text: ".", confidence: 2 },
      { text: "x", confidence: 3 },
      { text: "5", confidence: 20 },
    ] }] }] },
  ]);

  assert.deepEqual(getOcrReviewWords(lines).map((word) => word.text), ["5"]);
});

test("fallback text stays readable without marking every word low-confidence", () => {
  const lines = buildOcrLines(null, "Drug name 20 mg");

  assert.equal(joinOcrLines(lines), "Drug name 20 mg");
  assert.deepEqual(getOcrReviewWords(lines), []);
  assert.equal(hasWordsWithoutConfidence(lines), true);
});

test("suggests a known medicine name found in OCR text", () => {
  const lines = buildOcrLines([
    { paragraphs: [{ lines: [{ words: [
      { text: "Metformin", confidence: 96 },
      { text: "500mg", confidence: 94 },
      { text: "tablet", confidence: 92 },
    ] }] }] },
  ]);

  assert.deepEqual(getMedicineCandidates(lines), [
    { name: "Metformin", source: "catalog" },
  ]);
});

test("suggests an unknown medicine only when it appears near dosage context", () => {
  const lines = buildOcrLines([
    { paragraphs: [{ lines: [{ words: [
      { text: "Zoryl", confidence: 84 },
      { text: "1mg", confidence: 90 },
      { text: "tablet", confidence: 92 },
    ] }] }] },
    { paragraphs: [{ lines: [{ words: [
      { text: "Dr.", confidence: 99 },
      { text: "Smith", confidence: 98 },
      { text: "500mg", confidence: 97 },
    ] }] }] },
  ]);

  assert.deepEqual(getMedicineCandidates(lines), [
    { name: "Zoryl", source: "dosage-context" },
  ]);
});