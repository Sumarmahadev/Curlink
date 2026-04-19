import { normalizeWhitespace } from "../../utils/text.js";

function combineDiseaseQuery(disease, query) {
  if (!disease) return query;
  const q = query.toLowerCase();
  const d = disease.toLowerCase();
  if (q.includes(d)) return query;
  return `${query} ${disease}`;
}

function addSynonymExpansions(expansions, withDisease) {
  // Deterministic, lightweight synonyming (bounded later).
  const q = withDisease;
  expansions.add(q.replaceAll(/\btreatment\b/gi, "therapy"));
  expansions.add(q.replaceAll(/\btreatment\b/gi, "intervention"));
  expansions.add(q.replaceAll(/\bdrug\b/gi, "medication"));
  expansions.add(q.replaceAll(/\bdiagnosis\b/gi, "screening"));
}

/**
 * Deterministic query expansion.
 * Generates multiple enriched queries to improve recall for retrieval APIs.
 */
export function expandQueries({ disease, query, intent, location }) {
  const base = normalizeWhitespace(query);
  const withDisease = normalizeWhitespace(combineDiseaseQuery(disease, base));

  const expansions = new Set([withDisease]);

  // Evidence + freshness expansions (static but effective for recall).
  expansions.add(`${withDisease} latest`);
  expansions.add(`${withDisease} guidelines`);
  expansions.add(`${withDisease} systematic review`);
  expansions.add(`${withDisease} randomized controlled trial`);
  expansions.add(`${withDisease} meta-analysis`);
  expansions.add(`${withDisease} meta analysis`);

  addSynonymExpansions(expansions, withDisease);

  if (intent === "clinical_trials") {
    expansions.add(`${withDisease} clinical trial`);
    expansions.add(`${withDisease} recruiting trial`);
    expansions.add(`${withDisease} phase 2 trial`);
    expansions.add(`${withDisease} phase 3 trial`);
  }

  if (intent === "treatment") {
    expansions.add(`${withDisease} first line treatment`);
    expansions.add(`${withDisease} second line treatment`);
    expansions.add(`${withDisease} adverse effects`);
  }

  if (location) {
    expansions.add(`${withDisease} ${location}`);
    expansions.add(`${withDisease} clinical trial ${location}`);
  }

  // Keep it bounded (avoid API abuse).
  return Array.from(expansions).slice(0, 8);
}

