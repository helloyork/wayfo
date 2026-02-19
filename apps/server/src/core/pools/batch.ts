import { TaskPool } from "./taskPool";

export async function runBatches<T, R>(input: {
  items: T[];
  batchSize: number;
  pool: TaskPool;
  handler: (item: T, attempt: number, signal?: AbortSignal) => Promise<R>;
  signal?: AbortSignal;
}): Promise<R[]> {
  const results: R[] = [];
  const batchSize = Math.max(1, input.batchSize);
  for (let i = 0; i < input.items.length; i += batchSize) {
    const batch = input.items.slice(i, i + batchSize);
    const batchResults = await input.pool.run(batch, input.handler, input.signal);
    results.push(...batchResults);
  }
  return results;
}
