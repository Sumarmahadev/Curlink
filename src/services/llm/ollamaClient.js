import { fetchJson } from "../../utils/fetch.js";

function safeExtractJsonObject(text) {
  if (!text) return null;

  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) return null;

  // ✅ Trim everything after the last closing brace
  const candidate = text.slice(first, last + 1);

  try {
    return JSON.parse(candidate);
  } catch (err) {
    console.error("JSON parse failed:", err.message);
    return null;
  }
}

export function createOllamaClient({ baseUrl, model, timeoutMs, logger } = {}) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/generate`;

  async function generateJson({ system, user }) {
    const prompt = `SYSTEM:\n${system}\n\nUSER_JSON:\n${JSON.stringify(user)}\n\nReturn ONLY valid JSON. Do not include any text before or after the JSON object.`;

    const payload = {
      model,
      prompt,
      stream: false, // flip to true if you want streaming
      format: "json",
      options: {
        temperature: 0.1,
        num_predict: 300, // ✅ lowered from 800
        top_k: 20,
        top_p: 0.8,
      },
    };

    try {
      const res = await fetchJson(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        timeoutMs: timeoutMs || 120000, // shorter timeout
      });

      const text = res?.response || "";
      const parsed = safeExtractJsonObject(text);

      if (parsed) return parsed;

      throw new Error("INVALID_JSON");
    } catch (err) {
      logger?.error?.("Ollama failed:", err.message);

      const sources = user?.evidence_sources || [];
      const trials = user?.clinical_trials || [];

      return {
        overview: `Recent research on ${user?.disease || "this condition"} highlights multiple treatment strategies depending on disease progression.`,

        research_insights:
          sources.length > 0
            ? sources.slice(0, 3).map((s, i) => `${i + 1}. ${s.title}`).join("\n")
            : "Limited research insights available.",

        conflicting_evidence:
          "Some studies report varying outcomes due to differences in study design, population, and methodology.",

        // ✅ Expanded clinical trials section
        clinical_trials:
          trials.length > 0
            ? trials.slice(0, 2).map((t, i) => {
                const title = t.title || "Untitled Trial";
                const status = t.trial?.status || "unknown";
                const eligibility = t.trial?.eligibility || "Eligibility not specified";
                const location = t.trial?.location || "Location not provided";
                const contact = t.trial?.contact || "Contact info not available";

                return `${i + 1}. ${title} — Status: ${status}; Eligibility: ${eligibility}; Location: ${location}; Contact: ${contact}`;
              }).join("\n")
            : "No significant clinical trials identified in the selected data.",

        personalized_insight:
          "Treatment decisions should be based on patient-specific factors and consultation with healthcare professionals.",

        selection_rationale: "",

        sources: sources.map((s) => ({
          id: s.id || "src",
          title: s.title || "Untitled",
          authors: s.authors || "",
          year: s.year || null,
          platform: s.platform || "",
          url: s.url || "",
          evidence_score: isNaN(s.evidence_score) ? 50 : (s.evidence_score || 50),
          evidence_reason: s.evidence_reason || "",
          study_type: s.study_type || "article",
          supporting_snippet: s.supporting_snippet || "No abstract available.",
        })),

        fallback: true,
      };
    }
  }

  return { generateJson };
}


