import { parseUserInput } from "./queryParser.js";
import { expandQueries } from "./queryExpander.js";
import { createRetrievalOrchestrator, createInMemoryCache } from "../retrieval/retrievalOrchestrator.js";
import { rankAndSelect } from "../ranking/rankingEngine.js";
import { groupByConflict } from "../ranking/conflictDetection.js";
import { buildPrompt } from "../llm/promptBuilder.js";
import { runLlm } from "../llm/llmHandler.js";

// ✅ Helper to map ClinicalTrials.gov API response into rich trial objects
function mapClinicalTrial(apiTrial) {
  return {
    title: apiTrial.protocolSection?.identificationModule?.briefTitle || "Untitled Trial",
    trial: {
      status: apiTrial.protocolSection?.statusModule?.overallStatus || "unknown",
      eligibility: apiTrial.protocolSection?.eligibilityModule?.eligibilityCriteria || "Eligibility not specified",
      location: apiTrial.protocolSection?.locationsModule?.locations?.[0]?.facility?.name || "Location not provided",
      contact: apiTrial.protocolSection?.contactsModule?.overallOfficial?.[0]?.name || "Contact info not available",
    },
    url: `https://clinicaltrials.gov/study/${apiTrial.nctId}`,
  };
}

export function createAssistantPipeline({ env, logger, ollamaClient }) {
  const cache = createInMemoryCache({ ttlSeconds: env.CACHE_TTL_SECONDS });

  const retrieval = createRetrievalOrchestrator({
    cache,
    logger,
    timeoutMs: 20000,
  });

  async function runOnce({ patientName, disease, query, location, intent }) {
    const expandedQueries = expandQueries({ disease, query, intent, location });

    const retMax = Math.min(env.RETRIEVAL_MAX, 15);

    const retrieved = await retrieval.retrieveAll({ expandedQueries, retMax });

    const { pubs, trials } = rankAndSelect({
      publications: retrieved.publications || [],
      clinicalTrials: retrieved.clinicalTrials || [],
      query: expandedQueries[0] || query,
      intent,
      topPublications: 3,
      topTrials: 2,
    });

    // ✅ Map trials into rich format
    const mappedTrials = trials.map(mapClinicalTrial);

    const conflicts = groupByConflict(pubs);

    const prompt = buildPrompt({
      patientName,
      disease,
      userQuery: query,
      rankedPublications: pubs.slice(0, 2),
      trials: mappedTrials.slice(0, 1), // pass mapped trials to LLM
      conflictGroups: conflicts,
    });

    let llmOutput;

    try {
      llmOutput = await Promise.race([
        runLlm({ ollama: ollamaClient, prompt }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("LLM_TIMEOUT")), 280000)
        ),
      ]);
    } catch (err) {
      logger?.error?.("LLM failed:", err.message);

      llmOutput = {
        overview: `Latest research on ${disease || "this condition"} indicates multiple treatment approaches depending on disease stage and patient condition.`,
        research_insights:
          pubs.length > 0
            ? pubs.slice(0, 3).map((p, i) => `${i + 1}. ${p.title}`).join("\n")
            : "Limited research insights available from retrieved sources.",
        conflicting_evidence:
          conflicts.positive.length && conflicts.negative.length
            ? "Some studies report positive outcomes, while others show limited effectiveness, indicating ongoing scientific debate."
            : "No strong conflicting evidence identified among the top sources.",
        // ✅ Expanded clinical trials fallback
        clinical_trials:
          mappedTrials.length > 0
            ? mappedTrials.slice(0, 2).map((t, i) =>
                `${i + 1}. ${t.title} — Status: ${t.trial.status}; Eligibility: ${t.trial.eligibility}; Location: ${t.trial.location}; Contact: ${t.trial.contact}`
              ).join("\n")
            : "No major clinical trials identified in the selected dataset.",
        personalized_insight:
          "Treatment decisions should be personalized based on patient condition, disease stage, and consultation with a qualified healthcare professional.",
        selection_rationale:
          "Sources were selected based on relevance, recency, credibility, and evidence strength. Fast-mode summary generated due to LLM timeout constraints.",
        sources: pubs.map((p) => ({
          id: p.id || "src",
          title: p.title || "Untitled",
          authors: Array.isArray(p.authors)
            ? p.authors.slice(0, 3).join(", ")
            : String(p.authors || ""),
          year: p.year || null,
          platform: p.source || "",
          url: p.url || "",
          evidence_score: isNaN(p.evidenceScore) ? 50 : (p.evidenceScore || 50),
          evidence_reason: p?.evidence?.reason || "",
          study_type: p.studyType || "article",
          supporting_snippet: p.abstract
            ? p.abstract.slice(0, 180) + "..."
            : "No abstract available for this source.",
        })),
        fallback: true,
      };
    }

    return {
      expandedQueries,
      retrievalErrors: retrieved.errors,
      ranked: { publications: pubs, clinicalTrials: mappedTrials, conflicts },
      answer: llmOutput,
    };
  }

  return {
    async run(input) {
      const parsed = parseUserInput(input);
      const out = await runOnce(parsed);
      return { parsed, ...out };
    },
    async runFollowUp(input) {
      const parsed = parseUserInput({
        patientName: input.explicitPatientName || input.previousPatientName,
        disease: input.explicitDisease || input.previousDisease,
        query: input.followUpQuery,
        location: input.explicitLocation || input.previousLocation,
      });
      const out = await runOnce(parsed);
      return { parsed, ...out };
    },
  };
}
