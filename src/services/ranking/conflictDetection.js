import { tokenize } from "../../utils/text.js";

const POSITIVE = new Set([
  "effective",
  "efficacy",
  "improved",
  "improvement",
  "reduced",
  "reduction",
  "benefit",
  "beneficial",
  "associated",
  "significant",
]);

const NEGATIVE = new Set([
  "no",
  "not",
  "ineffective",
  "worsened",
  "worse",
  "null",
  "failed",
  "adverse",
  "risk",
  "harm",
  "insignificant",
]);

function stanceScore(text) {
  const t = tokenize(text);
  let p = 0;
  let n = 0;
  for (const w of t) {
    if (POSITIVE.has(w)) p++;
    if (NEGATIVE.has(w)) n++;
  }
  return p - n;
}

function weightFromEvidence(doc) {
  const raw = typeof doc?.evidenceScore === "number" ? doc.evidenceScore : typeof doc?.evidence?.score === "number" ? doc.evidence.score : 50;
  // 0.6–1.4 weight range to avoid overpowering text stance.
  const w = 0.6 + (Math.max(0, Math.min(100, raw)) / 100) * 0.8;
  return w;
}

export function groupByConflict(docs) {
  const positive = [];
  const negative = [];
  const neutral = [];

  for (const d of docs) {
    const s = stanceScore(`${d.title} ${d.abstract || ""}`);
    const weighted = s * weightFromEvidence(d);
    if (weighted >= 2.5) positive.push({ ...d, _conflict: { stance: s, weighted } });
    else if (weighted <= -2.5) negative.push({ ...d, _conflict: { stance: s, weighted } });
    else neutral.push({ ...d, _conflict: { stance: s, weighted } });
  }

  return { positive, negative, neutral };
}

