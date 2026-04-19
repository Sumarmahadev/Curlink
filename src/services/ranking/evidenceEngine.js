function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function inferStudyType(doc) {
  const t = `${doc?.title || ""} ${doc?.abstract || ""}`.toLowerCase();
  if (doc?.type === "clinical_trial") return "clinical_trial";
  if (t.includes("randomized") || t.includes("randomised") || t.includes("controlled trial")) return "clinical_trial";
  if (t.includes("meta-analysis") || t.includes("meta analysis")) return "meta_analysis";
  if (t.includes("systematic review")) return "systematic_review";
  if (t.includes("review")) return "review";
  return "article";
}

function baseFromType(studyType) {
  switch (studyType) {
    case "clinical_trial":
      return 75;
    case "meta_analysis":
      return 70;
    case "systematic_review":
      return 65;
    case "review":
      return 55;
    default:
      return 45;
  }
}

function recencyBoost(year, nowYear) {
  if (!year) return 0;
  const age = Math.max(0, nowYear - year);
  // Within last 2y: +15, 3-5y: +8, older: +0
  if (age <= 2) return 15;
  if (age <= 5) return 8;
  return 0;
}

function evidenceReason({ studyType, year }) {
  const parts = [];
  if (year) {
    const nowYear = new Date().getFullYear();
    const age = Math.max(0, nowYear - year);
    if (age <= 2) parts.push("Recent");
    else if (age <= 5) parts.push("Moderately recent");
    else parts.push("Older");
  } else {
    parts.push("Year unknown");
  }

  switch (studyType) {
    case "clinical_trial":
      parts.push("clinical trial / RCT signal");
      break;
    case "meta_analysis":
      parts.push("meta-analysis");
      break;
    case "systematic_review":
      parts.push("systematic review");
      break;
    case "review":
      parts.push("review article");
      break;
    default:
      parts.push("primary article");
  }

  return parts.join("; ");
}

export function assignEvidenceScores(docs) {
  const nowYear = new Date().getFullYear();
  return docs.map((d) => {
    const studyType = inferStudyType(d);
    const score = clamp(baseFromType(studyType) + recencyBoost(d.year, nowYear), 0, 100);
    return {
      ...d,
      studyType,
      evidenceScore: score,
      evidence: { score, reason: evidenceReason({ studyType, year: d.year }) },
    };
  });
}

