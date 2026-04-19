import {
  keywordDensityScore,
  keywordOverlapScore,
  normalizeWhitespace,
  stableIdFrom,
} from "../../utils/text.js";
import { assignEvidenceScores } from "./evidenceEngine.js";

/**
 * Utility
 */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Source credibility (tuned)
 */
function credibilityScore(source) {
  switch (source) {
    case "PubMed":
      return 1.0;
    case "ClinicalTrials.gov":
      return 0.9;
    case "OpenAlex":
      return 0.7;
    default:
      return 0.5;
  }
}

/**
 * Recency score (stronger decay)
 */
function recencyScore(year) {
  const now = new Date().getFullYear();
  if (!year) return 0.4;

  const age = Math.max(0, now - year);

  if (age <= 2) return 1.0;
  if (age <= 5) return 0.8;
  if (age <= 10) return 0.5;
  return 0.2;
}

/**
 * Study type boost (VERY IMPORTANT)
 */
function studyTypeBoost(type = "") {
  const t = type.toLowerCase();

  if (t.includes("meta")) return 1.0;
  if (t.includes("systematic")) return 0.95;
  if (t.includes("randomized")) return 0.9;
  if (t.includes("clinical trial")) return 0.85;
  if (t.includes("cohort")) return 0.7;
  if (t.includes("case")) return 0.5;

  return 0.4;
}

/**
 * Main scoring function
 */
function scoreDoc(doc, query, { intent } = {}) {
  const text = normalizeWhitespace(`${doc.title} ${doc.abstract || ""}`);

  const relevance = keywordOverlapScore(query, text);
  const density = keywordDensityScore(query, text);
  const recency = recencyScore(doc.year);
  const credibility = credibilityScore(doc.source);
  const evidence = clamp((doc.evidenceScore || 0) / 100, 0, 1);
  const studyBoost = studyTypeBoost(doc.studyType);

  /**
   * Smart weighting based on intent
   */
  let weights;

  if (intent === "treatment") {
    weights = {
      relevance: 0.4,
      recency: 0.2,
      credibility: 0.15,
      density: 0.05,
      evidence: 0.1,
      study: 0.1,
    };
  } else if (intent === "clinical_trials") {
    weights = {
      relevance: 0.45,
      recency: 0.15,
      credibility: 0.15,
      density: 0.05,
      evidence: 0.1,
      study: 0.1,
    };
  } else {
    weights = {
      relevance: 0.4,
      recency: 0.2,
      credibility: 0.15,
      density: 0.1,
      evidence: 0.1,
      study: 0.05,
    };
  }

  const score =
    relevance * weights.relevance +
    recency * weights.recency +
    credibility * weights.credibility +
    density * weights.density +
    evidence * weights.evidence +
    studyBoost * weights.study;

  return {
    ...doc,
    _ranking: {
      score,
      relevance,
      recency,
      credibility,
      density,
      evidence,
      studyBoost,
      intent,
    },
  };
}

/**
 * Deduplicate (keep best version)
 */
function dedupe(docs) {
  const seen = new Map();

  for (const d of docs) {
    const id = stableIdFrom(d.title, d.year, d.source);
    const prev = seen.get(id);

    if (!prev) {
      seen.set(id, { ...d, id });
      continue;
    }

    // Prefer richer abstract
    const prevLen = (prev.abstract || "").length;
    const curLen = (d.abstract || "").length;

    if (curLen > prevLen) {
      seen.set(id, { ...d, id });
    }
  }

  return Array.from(seen.values());
}

/**
 * Diversity booster (VERY IMPORTANT)
 * Prevents all sources being same type (e.g., only NCI)
 */
function diversify(docs, limit) {
  const selected = [];
  const seenPlatforms = new Set();

  for (const doc of docs) {
    if (selected.length >= limit) break;

    if (!seenPlatforms.has(doc.source)) {
      selected.push(doc);
      seenPlatforms.add(doc.source);
    }
  }

  // Fill remaining slots
  for (const doc of docs) {
    if (selected.length >= limit) break;
    if (!selected.includes(doc)) {
      selected.push(doc);
    }
  }

  return selected;
}

/**
 * MAIN FUNCTION
 */
export function rankAndSelect({
  publications = [],
  clinicalTrials = [],
  query = "",
  topPublications = 8,
  topTrials = 6,
  intent,
} = {}) {
  // 🔹 Publications
  const rankedPubs = assignEvidenceScores(dedupe(publications))
    .map((d) => scoreDoc(d, query, { intent }))
    .sort((a, b) => b._ranking.score - a._ranking.score);

  const pubs = diversify(rankedPubs, topPublications);

  // 🔹 Clinical Trials
  const rankedTrials = assignEvidenceScores(dedupe(clinicalTrials))
    .map((d) => scoreDoc(d, query, { intent }))
    .sort((a, b) => b._ranking.score - a._ranking.score);

  const trials = diversify(rankedTrials, topTrials);

  return { pubs, trials };
}