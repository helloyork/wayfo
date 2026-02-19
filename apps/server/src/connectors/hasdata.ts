import type { HasDataAmazonProductResponse } from "@wayfo/shared";
import { log } from "../core/logger";

const baseUrl = "https://api.hasdata.com";

type HasDataJobStatusResponse = {
  status?: string;
  data?: {
    status?: string;
  };
};

type HasDataJobCreateResponse = {
  jobId?: string;
  id?: string;
  data?: {
    jobId?: string;
    id?: string;
  };
  job?: {
    jobId?: string;
    id?: string;
  };
};

type HasDataJobResultsResponse = {
  meta?: {
    total?: number;
    perPage?: number;
    currentPage?: number;
    lastPage?: number;
  };
  data?: Array<Record<string, unknown>>;
};

type HasDataUsageResponse = Record<string, unknown>;

export type HasDataErrorInput = {
  code: string;
  message: string;
  status?: number;
  retryable: boolean;
  suggestion?: string;
};

export class HasDataError extends Error {
  code: string;
  status?: number;
  retryable: boolean;
  suggestion?: string;

  constructor(input: HasDataErrorInput) {
    super(input.message);
    this.code = input.code;
    this.status = input.status;
    this.retryable = input.retryable;
    this.suggestion = input.suggestion;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestHasData<T>(
  path: string,
  options: {
    method?: "GET" | "POST";
    body?: Record<string, unknown>;
    query?: Record<string, string | number>;
    apiKey: string;
  }
) {
  const url = new URL(`${baseUrl}${path}`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      url.searchParams.set(key, String(value));
    }
  }

  const maxAttempts = 5;
  let attempt = 0;
  while (attempt < maxAttempts) {
    attempt += 1;
    log({
      level: "info",
      message: "HasData request",
      err: {
        method: options.method ?? "GET",
        url: url.toString(),
        body: options.body
      }
    });

    const res = await fetch(url.toString(), {
      method: options.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": options.apiKey
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (res.status === 401 || res.status === 403) {
      throw new HasDataError({
        code: "HASDATA_UNAUTHORIZED",
        message: "HasData API Key 无效或无权限",
        status: res.status,
        retryable: false,
        suggestion: "请在设置页更新 HasData API Key 并重新验证"
      });
    }

    if (res.status === 404) {
      throw new HasDataError({
        code: "HASDATA_NOT_FOUND",
        message: "HasData 资源不存在",
        status: res.status,
        retryable: false,
        suggestion: "请确认 Amazon 链接与站点域名是否正确"
      });
    }

    if (res.status === 429 || res.status >= 500) {
      const retryAfter = res.headers.get("Retry-After");
      const waitMs = retryAfter ? Number(retryAfter) * 1000 : 800 * attempt;
      await sleep(waitMs);
      continue;
    }

    if (!res.ok) {
      throw new HasDataError({
        code: "HASDATA_REQUEST_FAILED",
        message: `HasData 请求失败 (${res.status})`,
        status: res.status,
        retryable: false
      });
    }

    return (await res.json()) as T;
  }

  throw new HasDataError({
    code: "HASDATA_RETRY_EXHAUSTED",
    message: "HasData 请求重试次数耗尽",
    retryable: true
  });
}

export async function createAmazonProductJob(input: {
  asins: string[];
  domain: string;
  apiKey: string;
}) {
  const response = await requestHasData<HasDataJobCreateResponse>(
    "/scrapers/amazon-product/jobs",
    {
      method: "POST",
      apiKey: input.apiKey,
      body: {
        asins: input.asins,
        domain: input.domain
      }
    }
  );

  const jobId =
    response.jobId ??
    response.id ??
    response.data?.jobId ??
    response.data?.id ??
    response.job?.jobId ??
    response.job?.id;
  if (!jobId) {
    throw new HasDataError({
      code: "HASDATA_JOB_MISSING",
      message: "HasData 未返回 jobId",
      retryable: false
    });
  }
  return jobId;
}

export async function waitForJobFinish(input: {
  jobId: string;
  apiKey: string;
  maxPolls?: number;
  intervalMs?: number;
}) {
  const maxPolls = input.maxPolls ?? 30;
  const intervalMs = input.intervalMs ?? 2000;
  for (let poll = 0; poll < maxPolls; poll += 1) {
    let statusResponse: HasDataJobStatusResponse;
    try {
      statusResponse = await requestHasData<HasDataJobStatusResponse>(
        `/scrapers/jobs/${input.jobId}`,
        { apiKey: input.apiKey }
      );
    } catch (error) {
      if (error instanceof HasDataError && error.code === "HASDATA_NOT_FOUND") {
        await sleep(intervalMs);
        continue;
      }
      throw error;
    }
    const status = statusResponse.status ?? statusResponse.data?.status ?? "unknown";
    if (status === "finished") {
      return;
    }
    if (status === "failed") {
      throw new HasDataError({
        code: "HASDATA_JOB_FAILED",
        message: "HasData 任务失败",
        retryable: false
      });
    }
    await sleep(intervalMs);
  }

  throw new HasDataError({
    code: "HASDATA_JOB_TIMEOUT",
    message: "HasData 任务超时未完成",
    retryable: true
  });
}

function normalizeResultItem(item: Record<string, unknown>) {
  const nested = item.data && typeof item.data === "object" ? (item.data as Record<string, unknown>) : null;
  const candidate = nested ?? item;
  if (candidate && (candidate as HasDataAmazonProductResponse).product) {
    return candidate as HasDataAmazonProductResponse;
  }
  return null;
}

export async function fetchJobResults(input: { jobId: string; apiKey: string }) {
  const results: HasDataAmazonProductResponse[] = [];
  let page = 1;
  const limit = 100;
  while (true) {
    let response: HasDataJobResultsResponse;
    try {
      response = await requestHasData<HasDataJobResultsResponse>(
        `/scrapers/jobs/${input.jobId}/results`,
        { apiKey: input.apiKey, query: { page, limit } }
      );
    } catch (error) {
      if (error instanceof HasDataError && error.code === "HASDATA_NOT_FOUND") {
        await sleep(800);
        continue;
      }
      throw error;
    }

    for (const item of response.data ?? []) {
      const normalized = normalizeResultItem(item);
      if (normalized) {
        results.push(normalized);
      }
    }

    const lastPage = response.meta?.lastPage ?? page;
    if (page >= lastPage) {
      break;
    }
    page += 1;
  }

  return results;
}

export async function validateHasDataApiKey(apiKey: string) {
  await requestHasData<HasDataUsageResponse>("/user/me/usage", { apiKey });
  return true;
}
