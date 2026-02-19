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
