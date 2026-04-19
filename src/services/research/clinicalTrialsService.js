// backend/src/services/llm/clinicalTrialsService.js

export async function fetchClinicalTrials(query, disease) {
  const search = `${query} ${disease}`;
  const url = `https://clinicaltrials.gov/api/query/full_studies?expr=${encodeURIComponent(search)}&min_rnk=1&max_rnk=20&fmt=json`;

  const res = await fetch(url);
  const data = await res.json();
  const studies = data?.FullStudiesResponse?.FullStudies || [];

  return studies.map((s, i) => {
    const study = s.Study || {};
    const protocol = study.ProtocolSection || {};
    const id = protocol.IdentificationModule?.NCTId || `trial_${i}`;
    return {
      id,
      title: protocol.IdentificationModule?.OfficialTitle || "Untitled Trial",
      status: protocol.StatusModule?.OverallStatus || "unknown",
      eligibility: protocol.EligibilityModule?.EligibilityCriteria || "Eligibility not specified",
      location: (protocol.ContactsLocationsModule?.LocationList?.Location || [])
        .map(l => l.Facility?.Name)
        .join(", ") || "Location not provided",
      contact: protocol.ContactsLocationsModule?.CentralContact?.Name || "Contact info not available",
      url: `https://clinicaltrials.gov/study/${id}`,
      evidence_score: 70
    };
  });
}
