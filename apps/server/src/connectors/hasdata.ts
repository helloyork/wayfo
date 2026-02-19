import type { HasDataAmazonProductResponse } from "@wayfo/shared";
import { log } from "../core/logger";

const baseUrl = "https://api.hasdata.com";

type HasDataApiErrorPayload = {
  code?: string;
  message?: string;
  suggestion?: string;
  error?: unknown;
  errors?: unknown;
  details?: unknown;
};

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

function extractHasDataErrorPayload(body: unknown): HasDataApiErrorPayload | null {
  if (!body || typeof body !== "object") return null;
  return body as HasDataApiErrorPayload;
}

function extractHasDataErrorInfo(body: unknown): {
  code?: string;
  message?: string;
  suggestion?: string;
} {
  const payload = extractHasDataErrorPayload(body);
  if (!payload) {
    return { message: typeof body === "string" ? body : undefined };
  }

  const nestedError =
    payload.error && typeof payload.error === "object"
      ? (payload.error as Record<string, unknown>)
      : null;

  const nestedErrorMessage =
    (nestedError && typeof nestedError.message === "string" && nestedError.message) ||
    (nestedError && typeof nestedError.error === "string" && nestedError.error) ||
    undefined;

  const nestedErrorCode =
    nestedError && typeof nestedError.code === "string" ? nestedError.code : undefined;

  const errorsArray = Array.isArray(payload.errors) ? payload.errors : null;
  const firstError =
    errorsArray && errorsArray.length > 0 ? (errorsArray[0] as unknown) : null;
  const firstErrorObj =
    firstError && typeof firstError === "object"
      ? (firstError as Record<string, unknown>)
      : null;
  const firstErrorMessage =
    (typeof firstError === "string" && firstError) ||
    (firstErrorObj && typeof firstErrorObj.message === "string" && firstErrorObj.message) ||
    undefined;

  const message =
    (typeof payload.message === "string" && payload.message) ||
    (typeof payload.error === "string" && payload.error) ||
    nestedErrorMessage ||
    firstErrorMessage ||
    undefined;

  const code =
    (typeof payload.code === "string" && payload.code) ||
    nestedErrorCode ||
    undefined;
  const suggestion =
    typeof payload.suggestion === "string" ? payload.suggestion : undefined;

  return { code, message, suggestion };
}

async function readHasDataErrorBody(res: Response): Promise<unknown> {
  try {
    // Read as text first so we never lose the payload (empty/invalid JSON is common on errors).
    const text = await res.text();
    if (!text) return undefined;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      try {
        return JSON.parse(text) as unknown;
      } catch {
        return text;
      }
    }
    return text;
  } catch {
    return undefined;
  }
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

  function pickDebugHeaders(headers: Headers) {
    const keys = [
      "x-request-id",
      "x-correlation-id",
      "cf-ray",
      "server",
      "date",
      "content-type"
    ];
    const out: Record<string, string> = {};
    for (const key of keys) {
      const value = headers.get(key);
      if (value) out[key] = value;
    }
    return out;
  }

  function suggestionFor404() {
    if (path === "/scrape/amazon/product") {
      return (
        "该 404 通常表示资源/接口在当前账号下不可用，或接口路径已变更。" +
        "如果你在 HasData Playground 能请求成功，但本服务 404，请核对是否使用了同一个 API Key；并把日志里的 request id 发给 HasData 支持排查。"
      );
    }
    if (path === "/scrapers/amazon-product/jobs") {
      return (
        "该 404 很可能不是 ASIN 问题，而是当前 HasData API Key 未开通/无权限访问 `amazon-product` Scraper（或该 scraper slug 在你的账户下不可用）。" +
        "请先在 HasData 控制台确认已开通 Amazon Product Scraper；若已开通仍 404，请将日志里的 request id 发给 HasData 支持排查。"
      );
    }
    return "请确认参数是否正确；若持续出现，可能是 HasData 接口变更或资源不可用";
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

    // For non-retryable errors, read and log response payload once for troubleshooting.
    // (Do not do this for 429/5xx which we retry; avoid noisy logs & extra work.)
    const shouldRetry = res.status === 429 || res.status >= 500;
    const errorBody = !res.ok && !shouldRetry ? await readHasDataErrorBody(res) : undefined;
    const info: { code?: string; message?: string; suggestion?: string } =
      !res.ok && !shouldRetry ? extractHasDataErrorInfo(errorBody) : {};
    if (!res.ok && !shouldRetry) {
      log({
        level: "warn",
        message: "HasData error response",
        err: {
          status: res.status,
          statusText: res.statusText,
          url: url.toString(),
          headers: pickDebugHeaders(res.headers),
          body: errorBody
        }
      });
    }

    if (res.status === 401) {
      throw new HasDataError({
        code: "HASDATA_UNAUTHORIZED",
        message: info.message ? `HasData 授权失败: ${info.message}` : "HasData API Key 无效或无权限",
        status: res.status,
        retryable: false,
        suggestion:
          info.suggestion ?? "请在设置页更新 HasData API Key 并重新验证"
      });
    }

    if (res.status === 403) {
      throw new HasDataError({
        code: info.code ?? "HASDATA_CREDITS_EXHAUSTED",
        message: info.message
          ? `HasData 请求被拒绝: ${info.message}`
          : "HasData 请求被拒绝（可能是额度不足或无权限）",
        status: res.status,
        retryable: false,
        suggestion:
          info.suggestion ??
          "请检查 HasData 额度/套餐权限；如为额度不足，请充值或等待额度恢复"
      });
    }

    if (res.status === 404) {
      throw new HasDataError({
        code: info.code ?? "HASDATA_NOT_FOUND",
        message: info.message ? `HasData 返回 404: ${info.message}` : "HasData 返回 404（资源不存在）",
        status: res.status,
        retryable: false,
        suggestion:
          info.suggestion ?? suggestionFor404()
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
        code: info.code ?? "HASDATA_REQUEST_FAILED",
        message: info.message
          ? `HasData 请求失败 (${res.status}): ${info.message}`
          : `HasData 请求失败 (${res.status})`,
        status: res.status,
        retryable: false,
        suggestion: info.suggestion
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

export async function scrapeAmazonProduct(input: {
  asin: string;
  domain: string;
  apiKey: string;
}) {
  // The HasData Playground uses this synchronous scrape endpoint for Amazon product data.
  const response = await requestHasData<HasDataAmazonProductResponse>(
    "/scrape/amazon/product",
    {
      apiKey: input.apiKey,
      query: {
        asin: input.asin,
        domain: input.domain
      }
    }
  );

  const status = response.requestMetadata?.status;
  if (status && status !== "ok") {
    throw new HasDataError({
      code: "HASDATA_SCRAPE_FAILED",
      message: `HasData 抓取失败（status=${status}）`,
      retryable: false,
      suggestion: response.requestMetadata?.id
        ? `请将 request id（${response.requestMetadata.id}）发给 HasData 支持协助排查`
        : "请在 HasData Playground 复现并将 request id 发给 HasData 支持协助排查"
    });
  }

  if (!response.product) {
    throw new HasDataError({
      code: "HASDATA_EMPTY_RESULT",
      message: "HasData 未返回产品信息",
      retryable: false
    });
  }

  return response;
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
