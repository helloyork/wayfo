import { getTaxonomyPool } from "../pools/registry";
import { runBatches } from "../pools/batch";

export async function runTaxonomyBatches<T, R>(input: {
  items: T[];
  batchSize: number;
  handler: (item: T, attempt: number, signal?: AbortSignal) => Promise<R>;
  signal?: AbortSignal;
}) {
  const pool = getTaxonomyPool();
  return runBatches({
    items: input.items,
    batchSize: input.batchSize,
    pool,
    handler: input.handler,
    signal: input.signal
  });
}
