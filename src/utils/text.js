const STOP = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "for",
  "from",
  "has",
  "have",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "were",
  "with",
]);

export function normalizeWhitespace(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text) {
  const t = normalizeWhitespace(text).toLowerCase();
  return t
    .split(/[^a-z0-9]+/g)
    .map((x) => x.trim())
    .filter(Boolean)
    .filter((x) => x.length >= 2 && !STOP.has(x));
}

export function keywordOverlapScore(query, text) {
  const q = new Set(tokenize(query));
  if (!q.size) return 0;
  const tokens = tokenize(text);
  if (!tokens.length) return 0;
  let hit = 0;
  for (const tok of tokens) if (q.has(tok)) hit++;
  return Math.min(1, hit / Math.max(3, q.size));
}

export function keywordDensityScore(query, text) {
  const q = tokenize(query);
  if (!q.length) return 0;
  const t = tokenize(text);
  if (!t.length) return 0;
  const setQ = new Set(q);
  let count = 0;
  for (const tok of t) if (setQ.has(tok)) count++;
  return Math.min(1, count / Math.max(30, t.length));
}

export function stableIdFrom(title, year, source) {
  const base = normalizeWhitespace(`${title}::${year ?? ""}::${source ?? ""}`).toLowerCase();
  let h = 2166136261;
  for (let i = 0; i < base.length; i++) {
    h ^= base.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `doc_${(h >>> 0).toString(16)}`;
}

