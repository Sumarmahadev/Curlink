// backend/src/services/llm/pubMedService.js

export async function fetchPubMedPublications(query, disease) {
  const search = `${query} ${disease}`;
  const esearchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(search)}&retmax=50&retmode=json`;

  const esearchRes = await fetch(esearchUrl);
  const esearchData = await esearchRes.json();
  const ids = esearchData.esearchresult?.idlist || [];

  if (ids.length === 0) return [];

  const efetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
  const efetchRes = await fetch(efetchUrl);
  const efetchText = await efetchRes.text();

  // ⚠️ For now, we don’t parse XML fully — just return placeholders
  return ids.map((id, i) => ({
    id: `pubmed_${id}`,
    title: `PubMed Article ${id}`,
    authors: "",
    year: null,
    platform: "PubMed",
    url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
    evidence_score: 65,
    supporting_snippet: "Abstract parsing needed here."
  }));
}

