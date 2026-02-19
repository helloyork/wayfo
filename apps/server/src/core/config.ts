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
