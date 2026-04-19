import { z } from "zod";

const LlmOutputSchema = z.object({
  overview: z.string(),
  research_insights: z.string(),
  conflicting_evidence: z.string(),
  clinical_trials: z.string(),
  personalized_insight: z.string(),
  selection_rationale: z.string().optional().default(""),
  sources: z.array(z.any()).optional().default([]),
  fallback: z.boolean().optional(),
});

export async function runLlm({ ollama, prompt }) {
  try {
    const raw = await ollama.generateJson(prompt);
    const parsed = LlmOutputSchema.safeParse(raw);

    if (!parsed.success) {
      throw new Error("Invalid LLM format");
    }

    return parsed.data;
  } catch (err) {
    return {
      overview: "Fast fallback summary.",
      research_insights: "Using ranked sources only.",
      conflicting_evidence: "Limited comparison available.",
      clinical_trials: "Some trials exist but not fully analyzed.",
      personalized_insight: "Consult a doctor.",
      selection_rationale: "Fallback triggered.",
      sources: [],
      fallback: true,
    };
  }
}