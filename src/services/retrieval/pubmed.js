import { fetchJson, toQueryString } from "../../utils/fetch.js";
import { normalizeWhitespace } from "../../utils/text.js";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function extractAbstractFromXml(xml) {
  const parts = [];
  const re = /<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/gim;
  let m;
  while ((m = re.exec(xml))) {
    const t = m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (t) parts.push(t);
  }
  return normalizeWhitespace(parts.join(" "));
}

function extractYearFromXml(xml) {
  const m =
    xml.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>[\s\S]*?<\/PubDate>/im) ||
    xml.match(/<ArticleDate>[\s\S]*?<Year>(\d{4})<\/Year>[\s\S]*?<\/ArticleDate>/im) ||
    xml.match(/<PubMedPubDate[^>]*>[\s\S]*?<Year>(\d{4})<\/Year>/im);
  return m ? Number(m[1]) : undefined;
}

function extractAuthorsFromXml(xml) {
  const authors = [];
  const re = /<Author[^>]*>[\s\S]*?<LastName>([\s\S]*?)<\/LastName>[\s\S]*?<ForeName>([\s\S]*?)<\/ForeName>[\s\S]*?<\/Author>/gim;
  let m;
  while ((m = re.exec(xml))) {
    const last = normalizeWhitespace(m[1]);
    const fore = normalizeWhitespace(m[2]);
    const name = normalizeWhitespace(`${fore} ${last}`);
    if (name) authors.push(name);
  }
  return authors.slice(0, 20);
}

function extractTitleFromXml(xml) {
  const m = xml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/im);
  if (!m) return "";
  return normalizeWhitespace(m[1].replace(/<[^>]+>/g, " "));
}

async function efetchXml(pmids, { timeoutMs }) {
  const qs = toQueryString({
    db: "pubmed",
    id: pmids.join(","),
    rettype: "abstract",
    retmode: "xml",
  });
  const url = `${EUTILS}/efetch.fcgi?${qs}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`PubMed efetch HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(t);
  }
}

export async function retrievePubMedCandidates(queries, { retMax = 200, timeoutMs = 30000, logger } = {}) {
  const pmids = new Set();
  for (const term of queries) {
    const qs = toQueryString({
      db: "pubmed",
      term,
      retmode: "json",
      retmax: Math.min(retMax, 200),
      sort: "relevance",
    });
    const url = `${EUTILS}/esearch.fcgi?${qs}`;
    const data = await fetchJson(url, { timeoutMs });
    const ids = data?.esearchresult?.idlist || [];
    for (const id of ids) pmids.add(String(id));
  }

  const idList = Array.from(pmids).slice(0, retMax);
  if (!idList.length) return [];
  logger?.info?.(`PubMed candidates: ${idList.length}`);

  const results = [];
  for (const batch of chunk(idList, 20)) {
    const xml = await efetchXml(batch, { timeoutMs });
    const articles = xml.split(/<\/PubmedArticle>/i).map((x) => x.trim()).filter(Boolean);
    for (const a of articles) {
      const title = extractTitleFromXml(a);
      if (!title) continue;
      const abstract = extractAbstractFromXml(a);
      const authors = extractAuthorsFromXml(a);
      const year = extractYearFromXml(a);

      // Best-effort PMIDs for URL attribution
      const pmidMatch = a.match(/<PMID[^>]*>(\d+)<\/PMID>/i);
      const pmid = pmidMatch ? pmidMatch[1] : undefined;
      const url = pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "";

      results.push({
        type: "publication",
        title,
        abstract,
        authors,
        year,
        source: "PubMed",
        url,
        raw: { pmid },
      });
    }
  }

  return results;
}

