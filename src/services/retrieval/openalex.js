import { fetchJson, toQueryString } from "../../utils/fetch.js";
import { normalizeWhitespace } from "../../utils/text.js";

const BASE = "https://api.openalex.org";

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== "object") return "";
  const positions = [];
  for (const [word, idxs] of Object.entries(invertedIndex)) {
    for (const i of idxs) positions.push([i, word]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  return normalizeWhitespace(positions.map(([, w]) => w).join(" "));
}

export async function retrieveOpenAlexCandidates(
  queries,
  { perPage = 200, timeoutMs = 30000, logger } = {}
) {
  const works = new Map(); // id -> work

  for (const q of queries) {
    const qs = toQueryString({
      search: q,
      per_page: Math.min(perPage, 200),
      sort: "relevance_score:desc",
      select:
        "id,display_name,publication_year,authorships,abstract_inverted_index,primary_location,host_venue,type",
    });
    const url = `${BASE}/works?${qs}`;
    const data = await fetchJson(url, { timeoutMs });
    for (const w of data?.results || []) {
      if (w?.id) works.set(w.id, w);
    }
  }

  logger?.info?.(`OpenAlex candidates: ${works.size}`);

  const results = [];
  for (const w of works.values()) {
    const title = normalizeWhitespace(w?.display_name || "");
    if (!title) continue;
    const year = Number(w?.publication_year) || undefined;
    const authors = (w?.authorships || [])
      .map((a) => normalizeWhitespace(a?.author?.display_name || ""))
      .filter(Boolean)
      .slice(0, 20);
    const abstract = reconstructAbstract(w?.abstract_inverted_index);
    const url =
      w?.primary_location?.landing_page_url ||
      w?.primary_location?.source?.homepage_url ||
      w?.id ||
      "";

    results.push({
      type: "publication",
      title,
      abstract,
      authors,
      year,
      source: "OpenAlex",
      url,
      raw: { openAlexId: w?.id, type: w?.type, hostVenue: w?.host_venue?.display_name },
    });
  }

  return results;
}

