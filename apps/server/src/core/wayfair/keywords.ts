const stopwords = new Set([
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
  "its",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "was",
  "with",
  "without",
  "your",
  "you",
  "we",
  "our"
]);

type KeywordSource = {
  title?: string;
  brand?: string;
  bullets?: string[];
  specs?: Record<string, string>;
  features?: Record<string, string>;
};

function tokenize(text: string) {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

function scoreTokens(tokens: string[], boost = 1) {
  const scores: Record<string, number> = {};
  tokens.forEach((token) => {
    if (token.length < 2) {
      return;
    }
    if (stopwords.has(token)) {
      return;
    }
    scores[token] = (scores[token] ?? 0) + boost;
  });
  return scores;
}

function mergeScores(target: Record<string, number>, source: Record<string, number>) {
  Object.entries(source).forEach(([token, score]) => {
    target[token] = (target[token] ?? 0) + score;
  });
}

export function extractKeywords(input: KeywordSource, limit = 24) {
  const scores: Record<string, number> = {};
  if (input.title) {
    mergeScores(scores, scoreTokens(tokenize(input.title), 4));
  }
  if (input.brand) {
    mergeScores(scores, scoreTokens(tokenize(input.brand), 3));
  }
  input.bullets?.forEach((bullet) => {
    mergeScores(scores, scoreTokens(tokenize(bullet), 2));
  });
  if (input.specs) {
    Object.entries(input.specs).forEach(([key, value]) => {
      mergeScores(scores, scoreTokens(tokenize(key), 2));
      mergeScores(scores, scoreTokens(tokenize(value), 1));
    });
  }
  if (input.features) {
    Object.entries(input.features).forEach(([key, value]) => {
      mergeScores(scores, scoreTokens(tokenize(key), 2));
      mergeScores(scores, scoreTokens(tokenize(value), 1));
    });
  }

  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([token]) => token);
  return sorted;
}

export function buildKeywordQuery(keywords: string[]) {
  return keywords.join(" ");
}
