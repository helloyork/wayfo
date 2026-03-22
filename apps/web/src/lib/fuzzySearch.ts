/**
 * Lowercase, Unicode-normalize, and treat & / full-width ＆ like a word separator
 * so "letters&" matches "letters &" and vice versa.
 */
export function normalizeSearchText(s: string): string {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s*[&＆]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * True if all characters of query appear in haystack in order (case-insensitive).
 * Useful for typo-tolerant and CJK search without requiring a contiguous substring.
 */
export function isOrderedSubsequence(query: string, haystack: string): boolean {
  const q = normalizeSearchText(query);
  if (!q) return true;
  const h = normalizeSearchText(haystack);
  let qi = 0;
  for (let j = 0; j < h.length && qi < q.length; j++) {
    if (h[j] === q[qi]) qi++;
  }
  return qi === q.length;
}

/**
 * Whitespace-separated tokens after normalization; each token must match via
 * substring or ordered subsequence (subsequence keeps light typo / CJK tolerance).
 */
export function matchesTokenizedSearch(haystack: string, filterText: string): boolean {
  const normHay = normalizeSearchText(haystack);
  const tokens = normalizeSearchText(filterText).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  return tokens.every(
    (t) => normHay.includes(t) || isOrderedSubsequence(t, normHay)
  );
}

/** @deprecated Use matchesTokenizedSearch (handles & spacing). */
export function matchesTokenizedSubsequence(haystack: string, filterText: string): boolean {
  return matchesTokenizedSearch(haystack, filterText);
}
