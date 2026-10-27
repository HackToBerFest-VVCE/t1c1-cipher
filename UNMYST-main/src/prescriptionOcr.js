export const LOW_CONFIDENCE_THRESHOLD = 60;

const COMMON_MEDICINE_NAMES = [
  "Acetaminophen", "Acyclovir", "Amlodipine", "Amoxicillin", "Aspirin",
  "Atorvastatin", "Azithromycin", "Cetirizine", "Ciprofloxacin", "Clopidogrel",
  "Dexamethasone", "Diclofenac", "Doxycycline", "Esomeprazole", "Fluconazole",
  "Furosemide", "Glimepiride", "Ibuprofen", "Levocetirizine", "Levothyroxine",
  "Losartan", "Metformin", "Metoprolol", "Montelukast", "Omeprazole",
  "Ondansetron", "Pantoprazole", "Paracetamol", "Prednisolone", "Rosuvastatin",
  "Telmisartan", "Tramadol", "Vitamin D3",
];

const DOSAGE_CONTEXT_PATTERN = /\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|μg|g|ml|iu|units?)\b|\b(?:tablets?|tabs?|capsules?|caps?|syrup|drops?)\b/i;
const PERSONAL_OR_ADMIN_PATTERN = /\b(?:patient|doctor|dr\.?|prescriber|signature|address|phone|age|gender|diagnosis|hospital|clinic)\b/i;
const DOSAGE_NOISE = new Set([
  "rx", "medicine", "medication", "drug", "tablet", "tablets", "tab", "tabs",
  "capsule", "capsules", "cap", "caps", "syrup", "drops", "drop", "mg", "mcg",
  "ug", "g", "ml", "iu", "unit", "units", "take", "oral", "by", "mouth", "po",
  "once", "twice", "one", "two", "of", "and", "daily", "nightly", "morning", "evening", "bedtime", "after",
  "before", "food", "meals", "every", "day", "days", "week", "weeks", "for",
  "as", "needed", "prn",
]);

function isReviewableTerm(text) {
  if (!/[\p{L}\p{N}]/u.test(text)) return false;
  return text.length > 1 || /^\d$/.test(text);
}

export function buildOcrLines(blocks, fallbackText = "") {
  const lines = [];

  blocks?.forEach((block, blockIndex) => {
    block.paragraphs?.forEach((paragraph, paragraphIndex) => {
      paragraph.lines?.forEach((line, lineIndex) => {
        const words = (line.words || []).filter((word) => word.text?.trim()).map((word, wordIndex) => {
          const confidence = Number.isFinite(word.confidence) ? word.confidence : null;
          return {
            id: `${blockIndex}-${paragraphIndex}-${lineIndex}-${wordIndex}`,
            text: word.text,
            confidence,
            bbox: word.bbox || null,
            needsReview: confidence !== null && confidence < LOW_CONFIDENCE_THRESHOLD && isReviewableTerm(word.text),
            resolved: false,
            confidenceUnavailable: confidence === null,
          };
        });

        if (words.length > 0) {
          lines.push({ id: `${blockIndex}-${paragraphIndex}-${lineIndex}`, words });
        }
      });
    });
  });

  if (lines.length > 0 || !fallbackText.trim()) return lines;

  const words = fallbackText.split(/(\s+)/).filter(Boolean).map((text, index) => {
    const isWhitespace = /^\s+$/.test(text);
    return {
      id: `fallback-${index}`,
      text,
      confidence: null,
      bbox: null,
      needsReview: false,
      resolved: false,
      confidenceUnavailable: !isWhitespace,
      isWhitespace,
    };
  });

  return [{ id: "fallback-line", words, preserveSpacing: true }];
}

export function getOcrReviewWords(lines) {
  return lines.flatMap((line) => line.words).filter((word) => word.needsReview);
}

export function hasWordsWithoutConfidence(lines) {
  return lines.some((line) => line.words.some((word) => word.confidenceUnavailable));
}

function normalizedWords(text) {
  return text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).filter(Boolean);
}

export function getMedicineCandidates(lines) {
  const candidates = new Map();
  const normalizedDocument = ` ${normalizedWords(joinOcrLines(lines)).join(" ")} `;

  COMMON_MEDICINE_NAMES.forEach((name) => {
    const normalizedName = normalizedWords(name).join(" ");
    if (normalizedDocument.includes(` ${normalizedName} `)) {
      candidates.set(normalizedName, { name, source: "catalog" });
    }
  });

  lines.forEach((line) => {
    const lineText = line.words.map((word) => word.text).join(" ").trim();
    if (!lineText || !DOSAGE_CONTEXT_PATTERN.test(lineText) || PERSONAL_OR_ADMIN_PATTERN.test(lineText)) {
      return;
    }

    const candidateWords = (lineText.match(/[\p{L}\p{N}]+/gu) || []).filter((word) =>
      !DOSAGE_NOISE.has(word.toLocaleLowerCase()) &&
      !/^\d+(?:\.\d+)?(?:mg|mcg|µg|μg|g|ml|iu|units?)?$/i.test(word)
    );
    if (candidateWords.length === 0 || candidateWords.length > 4) return;

    const candidateName = candidateWords.join(" ");
    const normalizedName = candidateWords.map((word) => word.toLocaleLowerCase()).join(" ");
    if (!candidates.has(normalizedName)) {
      candidates.set(normalizedName, { name: candidateName, source: "dosage-context" });
    }
  });

  return [...candidates.values()].slice(0, 5);
}

export function joinOcrLines(lines) {
  return lines
    .map((line) => line.preserveSpacing
      ? line.words.map((word) => word.text).join("")
      : line.words.map((word) => word.text).join(" "))
    .join("\n");
}