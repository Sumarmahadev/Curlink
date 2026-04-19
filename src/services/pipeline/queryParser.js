import { normalizeWhitespace } from "../../utils/text.js";

/**
 * Lightweight, deterministic parser.
 * For hackathon demos, this is safer than using the LLM to parse (avoids hallucinated fields).
 */
export function parseUserInput({ patientName, disease, query, location }) {
  const cleanPatientName = normalizeWhitespace(patientName || "");
  const cleanDisease = normalizeWhitespace(disease || "");
  const cleanQuery = normalizeWhitespace(query || "");
  const cleanLocation = normalizeWhitespace(location || "");

  // Very small intent heuristic (extend as you like).
  const q = cleanQuery.toLowerCase();
  const intent =
    q.includes("trial") || q.includes("clinical trial")
      ? "clinical_trials"
      : q.includes("treatment") || q.includes("therapy") || q.includes("drug")
        ? "treatment"
        : q.includes("diagnos") || q.includes("screen") || q.includes("test")
          ? "diagnosis"
          : "general_research";

  return {
    patientName: cleanPatientName,
    disease: cleanDisease,
    query: cleanQuery,
    location: cleanLocation,
    intent,
  };
}

