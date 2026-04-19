import { z } from "zod";

const str = z
  .union([
    z.string(),
    z.array(z.string()).transform(v => v.join(" ")),
    z.null(),
    z.undefined(),
  ])
  .transform(v => v ?? "");

const LlmOutputSchema = z.object({
  overview:             str,
  research_insights:    str,
  conflicting_evidence: str,
  clinical_trials:      str,
  personalized_insight: str,
}).catchall(z.unknown());

export async function runLlm({ ollama, prompt }) {
  const raw = await ollama.generateJson(prompt);
  const parsed = LlmOutputSchema.safeParse(raw);
  if (parsed.success) return parsed.data;
  return {
    overview:             String(raw?.overview || ""),
    research_insights:    String(raw?.research_insights || ""),
    conflicting_evidence: String(raw?.conflicting_evidence || ""),
    clinical_trials:      String(raw?.clinical_trials || ""),
    personalized_insight: String(raw?.personalized_insight || ""),
  };
}
