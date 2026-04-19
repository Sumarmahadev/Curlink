// backend/src/services/llm/openAlexService.js

export async function fetchOpenAlexPublications(query, disease) {
  const search = `${query} ${disease}`;
  const url = `https://api.openalex.org/works?filter=title.search:${encodeURIComponent(search)}&per_page=50`;

  const res = await fetch(url);
  const data = await res.json();

  return (data.results || []).map((p, i) => ({
    id: p.id || `openalex_${i}`,
    title: p.title,
    authors: (p.authorships || []).map(a => a.author.display_name).join(", "),
    year: p.publication_year,
    platform: "OpenAlex",
    url: p.id,
    evidence_score: 60,
    supporting_snippet: p.abstract || "No abstract available."
  }));
}
