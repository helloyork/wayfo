type PoolBudget = {
  maxTasks?: number;
};

export type PoolOptions = {
  name: string;
  concurrency: number;
  maxRetries: number;
  minDelayMs?: number;
  maxDelayMs?: number;
  budget?: PoolBudget;
};

type TaskEntry<T, R> = {
  item: T;
  attempt: number;
  resolve: (value: R) => void;
  reject: (error: unknown) => void;
};

export class TaskPool {
  private name: string;
  private concurrency: number;
  private maxRetries: number;
  private minDelayMs: number;
  private maxDelayMs: number;
  private budget?: PoolBudget;
  private queue: Array<TaskEntry<unknown, unknown>> = [];
  private active = 0;

  constructor(options: PoolOptions) {
    this.name = options.name;
    this.concurrency = Math.max(1, options.concurrency);
    this.maxRetries = Math.max(0, options.maxRetries);
    this.minDelayMs = options.minDelayMs ?? 300;
    this.maxDelayMs = options.maxDelayMs ?? 2000;
    this.budget = options.budget;
  }

  async run<T, R>(
    items: T[],
    handler: (item: T, attempt: number, signal?: AbortSignal) => Promise<R>,
    signal?: AbortSignal
  ): Promise<R[]> {
    if (this.budget?.maxTasks && items.length > this.budget.maxTasks) {
      throw new Error(`${this.name} pool budget exceeded: maxTasks`);
    }
    const results: R[] = new Array(items.length);
    let cursor = 0;
    const workers = new Array(Math.min(this.concurrency, items.length)).fill(null).map(async () => {
      while (cursor < items.length) {
        const current = cursor;
        cursor += 1;
        results[current] = await this.runTask(items[current], handler, signal);
      }
    });
    await Promise.all(workers);
    return results;
  }

  private async runTask<T, R>(
    item: T,
    handler: (item: T, attempt: number, signal?: AbortSignal) => Promise<R>,
    signal?: AbortSignal
  ): Promise<R> {
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      if (signal?.aborted) {
        throw new Error(`${this.name} pool cancelled`);
      }
      try {
        return await handler(item, attempt + 1, signal);
      } catch (error) {
        if (
          error &&
          typeof error === "object" &&
          "retryable" in error &&
          (error as { retryable?: boolean }).retryable === false
        ) {
          throw error;
        }
        attempt += 1;
        if (attempt > this.maxRetries) {
          throw error;
        }
        const delay = Math.min(
          this.maxDelayMs,
          this.minDelayMs * Math.pow(2, Math.max(0, attempt - 1))
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw new Error(`${this.name} pool exhausted`);
  }
}
