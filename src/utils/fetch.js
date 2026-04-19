import { HttpError } from "./http.js";

export async function fetchJson(
  url,
  { method = "GET", headers, body, timeoutMs = 15000, retries = 1 } = {}
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new HttpError(
        res.status,
        `HTTP ${res.status} from ${url}`,
        text?.slice?.(0, 300)
      );
    }

    return await res.json();
  } catch (err) {
    // 🔥 TIMEOUT HANDLING
    if (err.name === "AbortError") {
      if (retries > 0) {
        return fetchJson(url, {
          method,
          headers,
          body,
          timeoutMs: timeoutMs - 2000, // reduce next attempt
          retries: retries - 1,
        });
      }
      throw new Error("REQUEST_TIMEOUT");
    }

    // 🔥 NETWORK ERROR (very common in Ollama)
    if (err.message?.includes("fetch failed")) {
      throw new Error("NETWORK_ERROR");
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// ✅ REQUIRED for PubMed / APIs
export function toQueryString(params) {
  const sp = new URLSearchParams();

  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null) continue;
    sp.set(k, String(v));
  }

  return sp.toString();
}