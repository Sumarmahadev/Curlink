import { fetchJson } from "../../utils/fetch.js";

function safeExtractJsonObject(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch (err) {
    console.error("JSON parse failed:", err.message);
    return null;
  }
}

export function createOllamaClient({ baseUrl, model, timeoutMs, logger } = {}) {
  const url = `${baseUrl.replace(/\/$/, "")}/api/generate`;

  async function generateJson({ system, user }) {
    const prompt = `${system}\n\nDATA:\n${JSON.stringify(user, null, 2)}\n\nReturn ONLY valid JSON with keys: overview, research_insights, conflicting_evidence, clinical_trials, personalized_insight.`;

    const res = await fetchJson(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: "json",
        options: {
          temperature: 0.1,
          num_predict: 600,
          top_k: 20,
          top_p: 0.8,
        },
      }),
      timeoutMs: timeoutMs || 300000,
    });

    const text = res?.response || "";
    logger?.debug?.("Ollama response length:", text.length);

    const parsed = safeExtractJsonObject(text);
    if (parsed) return parsed;

    throw new Error(`Ollama returned non-JSON: ${text.slice(0, 200)}`);
  }

  return { generateJson };
}
