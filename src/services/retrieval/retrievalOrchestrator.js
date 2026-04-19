import pLimit from "p-limit";
import { retrievePubMedCandidates } from "./pubmed.js";
import { retrieveOpenAlexCandidates } from "./openalex.js";
import { retrieveClinicalTrialsCandidates } from "./clinicaltrials.js";

function nowMs() {
  return Date.now();
}

// ✅ Helper to map ClinicalTrials.gov API response into rich trial objects
function mapClinicalTrial(apiTrial) {
  return {
    title: apiTrial.protocolSection?.identificationModule?.briefTitle || "Untitled Trial",
    trial: {
      status: apiTrial.protocolSection?.statusModule?.overallStatus || "unknown",
      // shorten eligibility text so UI stays clean
      eligibility: apiTrial.protocolSection?.eligibilityModule?.eligibilityCriteria
        ? apiTrial.protocolSection.eligibilityModule.eligibilityCriteria.slice(0, 200) + "..."
        : "Eligibility not specified",
      location: apiTrial.protocolSection?.locationsModule?.locations?.[0]?.facility?.name || "Location not provided",
      contact: apiTrial.protocolSection?.contactsModule?.overallOfficial?.[0]?.name || "Contact info not available",
    },
    url: `https://clinicaltrials.gov/study/${apiTrial.nctId}`,
  };
}

export function createInMemoryCache({ ttlSeconds = 600 } = {}) {
  const store = new Map(); // key -> {expiresAt,data}
  return {
    get(key) {
      const v = store.get(key);
      if (!v) return undefined;
      if (v.expiresAt <= nowMs()) {
        store.delete(key);
        return undefined;
      }
      return v.data;
    },
    set(key, data) {
      if (ttlSeconds <= 0) return;
      store.set(key, { data, expiresAt: nowMs() + ttlSeconds * 1000 });
    },
  };
}

export function createRetrievalOrchestrator({ cache, logger, timeoutMs = 30000 } = {}) {
  const limit = pLimit(4);
  const localCache = cache || createInMemoryCache({ ttlSeconds: 0 });

  async function cached(key, fn) {
    const hit = localCache.get(key);
    if (hit) return hit;
    const data = await fn();
    localCache.set(key, data);
    return data;
  }

  return {
    async retrieveAll({ expandedQueries, retMax }) {
      const key = `v1::${retMax}::${expandedQueries.join("||")}`;
      return cached(key, async () => {
        const tasks = [
          limit(() =>
            retrievePubMedCandidates(expandedQueries, {
              retMax,
              timeoutMs,
              logger,
            })
          ),
          limit(() =>
            retrieveOpenAlexCandidates(expandedQueries, {
              perPage: retMax,
              timeoutMs,
              logger,
            })
          ),
          limit(() =>
            retrieveClinicalTrialsCandidates(expandedQueries, {
              pageSize: Math.min(100, retMax),
              timeoutMs,
              logger,
            })
          ),
        ];

        const [pubmed, openalex, trials] = await Promise.allSettled(tasks);
        const safe = (r) => (r.status === "fulfilled" ? r.value : []);

        // ✅ Map trials immediately after retrieval
        const mappedTrials = safe(trials).map(mapClinicalTrial);

        const out = {
          publications: [...safe(pubmed), ...safe(openalex)],
          clinicalTrials: mappedTrials,
          errors: [
            pubmed.status === "rejected" ? { source: "PubMed", error: String(pubmed.reason) } : null,
            openalex.status === "rejected" ? { source: "OpenAlex", error: String(openalex.reason) } : null,
            trials.status === "rejected"
              ? { source: "ClinicalTrials.gov", error: String(trials.reason) }
              : null,
          ].filter(Boolean),
        };
        return out;
      });
    },
  };
}
