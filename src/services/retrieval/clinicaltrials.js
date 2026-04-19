import { fetchJson, toQueryString } from "../../utils/fetch.js";
import { normalizeWhitespace } from "../../utils/text.js";

const BASE = "https://clinicaltrials.gov/api/v2";

function pickFirst(arr) {
  return Array.isArray(arr) && arr.length ? arr[0] : undefined;
}

export async function retrieveClinicalTrialsCandidates(
  queries,
  { pageSize = 100, timeoutMs = 30000, logger } = {}
) {
  const trials = new Map(); // nctId -> record

  for (const term of queries) {
    const qs = toQueryString({
      "query.term": term,
      pageSize: Math.min(pageSize, 100),
      format: "json",
      fields:
        "NCTId,BriefTitle,Condition,BriefSummary,OverallStatus,StudyType,StartDateStruct,CompletionDateStruct,LocationFacility,LocationCity,LocationCountry,EligibilityCriteria,CentralContactName,CentralContactPhone,CentralContactEMail",
    });
    const url = `${BASE}/studies?${qs}`;
    const data = await fetchJson(url, { timeoutMs });
    for (const s of data?.studies || []) {
      const id = s?.protocolSection?.identificationModule?.nctId;
      if (id) trials.set(id, s);
    }
  }

  logger?.info?.(`ClinicalTrials candidates: ${trials.size}`);

  const results = [];
  for (const s of trials.values()) {
    const id = s?.protocolSection?.identificationModule?.nctId;
    const title = normalizeWhitespace(s?.protocolSection?.identificationModule?.briefTitle || "");
    if (!id || !title) continue;

    const status = normalizeWhitespace(s?.protocolSection?.statusModule?.overallStatus || "");
    const studyType = normalizeWhitespace(s?.protocolSection?.designModule?.studyType || "");
    const yearRaw =
      s?.protocolSection?.statusModule?.startDateStruct?.date ||
      s?.protocolSection?.statusModule?.completionDateStruct?.date ||
      "";
    const yearMatch = String(yearRaw).match(/(\d{4})/);
    const year = yearMatch ? Number(yearMatch[1]) : undefined;

    const summary = normalizeWhitespace(s?.protocolSection?.descriptionModule?.briefSummary || "");
    const eligibility = normalizeWhitespace(s?.protocolSection?.eligibilityModule?.eligibilityCriteria || "");
    const loc = pickFirst(s?.protocolSection?.contactsLocationsModule?.locations || []);
    const facility = normalizeWhitespace(loc?.facility || "");
    const city = normalizeWhitespace(loc?.city || "");
    const country = normalizeWhitespace(loc?.country || "");
    const location = normalizeWhitespace([facility, city, country].filter(Boolean).join(", "));

    const contactName = normalizeWhitespace(
      s?.protocolSection?.contactsLocationsModule?.centralContact?.name || ""
    );
    const contactPhone = normalizeWhitespace(
      s?.protocolSection?.contactsLocationsModule?.centralContact?.phone || ""
    );
    const contactEmail = normalizeWhitespace(
      s?.protocolSection?.contactsLocationsModule?.centralContact?.email || ""
    );

    // ✅ Flatten contact into a single string
    const contact =
      contactName ||
      contactEmail ||
      contactPhone ||
      "Contact info not available";

    results.push({
      type: "clinical_trial",
      title,
      abstract: summary,
      authors: [],
      year,
      source: "ClinicalTrials.gov",
      url: `https://clinicaltrials.gov/study/${id}`,
      trial: {
        nctId: id,
        status,
        studyType,
        location,
        eligibility, // ✅ renamed so fallback sees it
        contact,     // ✅ flattened string
      },
      raw: { nctId: id },
    });
  }

  return results;
}
