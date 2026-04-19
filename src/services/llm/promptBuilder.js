import { normalizeWhitespace } from "../../utils/text.js";

// 🔥 VERY SMALL SNIPPET (LLM SPEED BOOST)
function snippet(text, max = 100) {
  const t = normalizeWhitespace(text || "");
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

// 🔥 CLEAN + SAFE SOURCE FORMAT
function formatSource(doc) {
  const authors = (doc.authors || []).slice(0, 2).join(", "); // reduce tokens

  const fallbackText =
    doc.abstract || doc.summary || doc.title || "";

  return {
    id: doc.id,
    title: doc.title,
    authors,
    year: doc.year || null,
    platform: doc.source || "Unknown",
    url: doc.url || "",

    // ✅ FIX NaN ISSUE COMPLETELY
    evidence_score:
      typeof doc.evidenceScore === "number" &&
      !isNaN(doc.evidenceScore)
        ? Math.round(doc.evidenceScore)
        : 5,

    evidence_reason: doc?.evidence?.reason || "",
    study_type: doc.studyType || "unknown",

    supporting_snippet: snippet(fallbackText),
  };
}

export function buildPrompt({
  patientName,
  disease,
  userQuery,
  rankedPublications,
  trials,
  conflictGroups,
}) {
  // 🔥 HARD LIMIT (VERY IMPORTANT)
  const sources = (rankedPublications || [])
    .slice(0, 2)
    .map(formatSource);

  const trialSources = (trials || [])
    .slice(0, 1)
    .map((t) => ({
      id: t.id,
      title: t.title,
      year: t.year || null,
      platform: t.source || "ClinicalTrials",
      url: t.url || "",
      evidence_score:
        typeof t.evidenceScore === "number"
          ? Math.round(t.evidenceScore)
          : 5,
      study_type: t.studyType || "trial",
      recruiting_status: t.trial?.status || "",
      supporting_snippet: snippet(t.abstract || ""),
    }));

  // 🔥 ULTRA OPTIMIZED PROMPT (SMALL LLM FRIENDLY)
  const system = normalizeWhitespace(`
You are CuraLink, a medical research assistant.

STRICT RULES:
- Use ONLY provided sources
- Do NOT hallucinate
- Avoid generic statements

TASK:
- Identify key treatments (chemo, immunotherapy, etc.)
- Mention drugs if available
- Highlight strongest evidence (high scores)
- Explain conflicts briefly (if any)
- Summarize clinical trials

STYLE:
- "Recent studies indicate..."
- "High-evidence studies show..."

OUTPUT:
- JSON only
- Follow schema exactly
`);

  const schema = {
    overview: "string",
    research_insights: "string",
    conflicting_evidence: "string",
    clinical_trials: "string",
    personalized_insight: "string",
    selection_rationale: "string",
    sources: [
      {
        id: "string",
        title: "string",
        authors: "string",
        year: "number|null",
        platform: "string",
        url: "string",
        evidence_score: "number",
        evidence_reason: "string",
        study_type: "string",
        supporting_snippet: "string",
      },
    ],
  };

  const user = {
    patient_name: patientName || "",
    disease: disease || "",
    query: userQuery,

    evidence_sources: sources,
    clinical_trials: trialSources,

    // ✅ SAFE CONFLICT HANDLING
    conflict_groups: {
      positive: conflictGroups?.positive?.map((d) => d.id) || [],
      negative: conflictGroups?.negative?.map((d) => d.id) || [],
      neutral: conflictGroups?.neutral?.map((d) => d.id) || [],
    },

    // 🔥 GUIDE LLM BETTER
    selection_hint:
      "Prefer higher evidence_score, recent studies, and credible sources.",

    required_json_schema: schema,
  };

  return { system, user };
} 