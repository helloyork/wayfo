export function getImagePoolConcurrency() {
  const raw = process.env.IMAGE_POOL_CONCURRENCY;
  if (!raw) {
    return 6;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 6;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 24);
}

export function getWayfairPoolConcurrency() {
  const raw = process.env.WAYFAIR_POOL_CONCURRENCY;
  if (!raw) {
    return 4;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 4;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 12);
}

export function getModelPoolConcurrency() {
  const raw = process.env.MODEL_POOL_CONCURRENCY;
  if (!raw) {
    return 2;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 2;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), 8);
}

export function getPoolMaxRetries() {
  const raw = process.env.POOL_MAX_RETRIES;
  if (!raw) {
    return 2;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 2;
  }
  return Math.min(Math.max(Math.floor(parsed), 0), 5);
}

export function getWayfairPoolId() {
  const raw = process.env.WAYFAIR_POOL_ID;
  if (!raw) {
    return "default";
  }
  return raw.trim() || "default";
}

export function getTaxonomyCacheMaxAgeDays() {
  const raw = process.env.TAXONOMY_CACHE_MAX_AGE_DAYS;
  if (!raw) {
    return 30;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 30;
  }
  return Math.min(Math.max(parsed, 1), 180);
}

export function getTaxonomyEmbeddingModel() {
  const raw = process.env.TAXONOMY_EMBEDDING_MODEL;
  if (!raw) {
    return "text-embedding-3-small";
  }
  return raw.trim() || "text-embedding-3-small";
}

export function getTaxonomyPageSize() {
  const raw = process.env.TAXONOMY_PAGE_SIZE;
  if (!raw) {
    return 50;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    return 50;
  }
  const allowed = [10, 20, 25, 50];
  return allowed.includes(parsed) ? parsed : 50;
}

export function getWayfairClassifyModel() {
  const raw = process.env.WAYFAIR_CLASSIFY_MODEL;
  if (!raw) {
    return "gpt-4o-mini";
  }
  return raw.trim() || "gpt-4o-mini";
}

export function getWayfairAnswerModel() {
  const raw = process.env.WAYFAIR_ANSWER_MODEL;
  if (!raw) {
    return "gpt-4o-mini";
  }
  return raw.trim() || "gpt-4o-mini";
}

export function getWayfairClassifyCandidateLimit() {
  const raw = process.env.WAYFAIR_CLASSIFY_CANDIDATE_LIMIT;
  if (!raw) {
    return 12;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 12;
  }
  return Math.min(Math.max(Math.floor(parsed), 5), 50);
}

export function getWayfairClassifyKeywordLimit() {
  const raw = process.env.WAYFAIR_CLASSIFY_KEYWORD_LIMIT;
  if (!raw) {
    return 24;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 24;
  }
  return Math.min(Math.max(Math.floor(parsed), 8), 80);
}
