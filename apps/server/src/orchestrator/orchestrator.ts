import { nanoid } from "nanoid";
import { Run, RunEvent, Step, HasDataAmazonProductResponse } from "@wayfo/shared";
import { eventBus } from "../core/events/eventBus";
import { log } from "../core/logger";
import {
  createArtifact,
  createJob,
  hashInput,
  updateJob,
  updateRun
} from "../core/store/runStore";
import { getHasDataApiKey } from "../core/store/settingsStore";
import { extractAsin, normalizeAmazonDomain } from "../core/amazon/asin";
import {
  amazonProductSchemaVersion,
  normalizeHasDataProduct,
  validateAmazonSnapshot,
  type AmazonProductSnapshot
} from "../core/amazon/normalize";
import { readGlobalCache, readRunCache, writeGlobalCache } from "../core/amazon/cache";
import {
  createAmazonProductJob,
  fetchJobResults,
  HasDataError,
  waitForJobFinish
} from "../connectors/hasdata";

const steps: Step[] = ["SCRAPE_AMAZON"];

function emit(event: RunEvent) {
  eventBus.emit(event);
}

export async function startRun(run: Run) {
  const updated = updateRun(run.id, { status: "RUNNING", currentStep: undefined });
  emit({
    id: nanoid(),
    type: "RUN_STARTED",
    runId: updated.id,
    timestamp: new Date().toISOString()
  });
  log({ level: "info", runId: run.id, message: "Run started" });

  for (const step of steps) {
    await runStep(updated, step);
    const refreshed = updateRun(updated.id, {});
    if (refreshed.status === "NEEDS_REVIEW") {
      return;
    }
  }

  const completed = updateRun(run.id, {
    status: "COMPLETED",
    currentStep: undefined
  });
  emit({
    id: nanoid(),
    type: "RUN_COMPLETED",
    runId: completed.id,
    timestamp: new Date().toISOString()
  });
  log({ level: "info", runId: run.id, message: "Run completed" });
}

async function runStep(run: Run, step: Step) {
  if (step === "SCRAPE_AMAZON") {
    await runScrapeAmazon(run);
    return;
  }
}

async function runScrapeAmazon(run: Run) {
  updateRun(run.id, { currentStep: "SCRAPE_AMAZON" });
  const apiKey = getHasDataApiKey();
  if (!apiKey) {
    markNeedsReview(run.id, "缺少 HasData API Key，请先在设置页配置并验证。");
    return;
  }

  const domain = normalizeAmazonDomain(run.amazonUrl);
  const asin = extractAsin(run.amazonUrl);
  if (!asin) {
    markNeedsReview(run.id, "无法从链接中解析 ASIN，请检查 Amazon 链接。");
    return;
  }

  const seedJob = createJob({
    runId: run.id,
    step: "SCRAPE_AMAZON",
    inputHash: hashInput({
      type: "seed",
      amazonUrl: run.amazonUrl,
      domain,
      asin,
      schemaVersion: amazonProductSchemaVersion
    })
  });

  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId: run.id,
    jobId: seedJob.id,
    step: "SCRAPE_AMAZON",
    timestamp: new Date().toISOString()
  });
  log({
    level: "info",
    runId: run.id,
    jobId: seedJob.id,
    step: "SCRAPE_AMAZON",
    message: "Seed job started"
  });
  updateJob(run.id, seedJob.id, { status: "RUNNING", attempts: 1 });

  let seedSnapshot: AmazonProductSnapshot | null = null;
  try {
    const seedResult = await fetchAndCacheAsin({
      runId: run.id,
      jobId: seedJob.id,
      domain,
      asin,
      apiKey
    });
    seedSnapshot = seedResult.product;
    updateJob(run.id, seedJob.id, {
      status: seedResult.fromCache ? "SKIPPED" : "SUCCEEDED"
    });
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: seedJob.id,
      step: "SCRAPE_AMAZON",
      message: seedResult.fromCache ? "Seed 命中缓存" : "Seed 采集完成",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    handleJobError(run.id, seedJob.id, "SCRAPE_AMAZON", error);
    return;
  }

  const variantAsins =
    seedSnapshot?.variants.map((variant) => variant.asin).filter(Boolean) ?? [];
  for (const variantAsin of variantAsins) {
    const variantJob = createJob({
      runId: run.id,
      step: "SCRAPE_AMAZON",
      inputHash: hashInput({
        type: "variant",
        domain,
        asin: variantAsin,
        schemaVersion: amazonProductSchemaVersion
      })
    });
    emit({
      id: nanoid(),
      type: "JOB_STARTED",
      runId: run.id,
      jobId: variantJob.id,
      step: "SCRAPE_AMAZON",
      timestamp: new Date().toISOString()
    });
    updateJob(run.id, variantJob.id, { status: "RUNNING", attempts: 1 });

    try {
      const result = await fetchAndCacheAsin({
        runId: run.id,
        jobId: variantJob.id,
        domain,
        asin: variantAsin,
        apiKey
      });
      updateJob(run.id, variantJob.id, {
        status: result.fromCache ? "SKIPPED" : "SUCCEEDED"
      });
      emit({
        id: nanoid(),
        type: "JOB_PROGRESS",
        runId: run.id,
        jobId: variantJob.id,
        step: "SCRAPE_AMAZON",
        message: result.fromCache ? "变体命中缓存" : "变体采集完成",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleJobError(run.id, variantJob.id, "SCRAPE_AMAZON", error);
      return;
    }
  }
}

function handleJobError(runId: string, jobId: string, step: Step, error: unknown) {
  if (error instanceof HasDataError && !error.retryable) {
    markNeedsReview(runId, error.message, error.suggestion);
  }
  updateJob(runId, jobId, { status: "FAILED", errorSummary: String(error) });
  emit({
    id: nanoid(),
    type: "JOB_FAILED",
    runId,
    jobId,
    step,
    message: error instanceof Error ? error.message : "Job failed",
    timestamp: new Date().toISOString()
  });
  log({
    level: "error",
    runId,
    jobId,
    step,
    message: "Job failed",
    err: error
  });
}

function markNeedsReview(runId: string, message: string, suggestion?: string) {
  updateRun(runId, { status: "NEEDS_REVIEW" });
  emit({
    id: nanoid(),
    type: "NEEDS_REVIEW",
    runId,
    message,
    data: suggestion ? { suggestion } : undefined,
    timestamp: new Date().toISOString()
  });
  log({
    level: "warn",
    runId,
    message,
    err: suggestion ? { suggestion } : undefined
  });
}

async function fetchAndCacheAsin(input: {
  runId: string;
  jobId: string;
  domain: string;
  asin: string;
  apiKey: string;
}) {
  const cachedInRun = readRunCache(input.runId, input.asin);
  if (cachedInRun?.product?.schemaVersion === amazonProductSchemaVersion) {
    return { product: cachedInRun.product, fromCache: true };
  }

  const cachedGlobal = readGlobalCache(input.domain, input.asin);
  if (cachedGlobal?.product?.schemaVersion === amazonProductSchemaVersion) {
    createAmazonArtifacts(
      input.runId,
      input.jobId,
      input.asin,
      cachedGlobal.raw,
      cachedGlobal.product
    );
    return { product: cachedGlobal.product, fromCache: true };
  }

  const jobId = await createAmazonProductJob({
    asins: [input.asin],
    domain: input.domain,
    apiKey: input.apiKey
  });
  await waitForJobFinish({ jobId, apiKey: input.apiKey });
  const results = await fetchJobResults({ jobId, apiKey: input.apiKey });
  const matched =
    results.find((item) => item.product?.asin?.toUpperCase() === input.asin) ??
    results[0];
  if (!matched) {
    throw new HasDataError({
      code: "HASDATA_EMPTY_RESULT",
      message: "HasData 未返回产品结果",
      retryable: false
    });
  }

  const snapshot = normalizeHasDataProduct(matched, input.domain);
  if (!snapshot) {
    throw new HasDataError({
      code: "HASDATA_INVALID_RESULT",
      message: "HasData 返回的产品信息缺失",
      retryable: false
    });
  }

  const missing = validateAmazonSnapshot(snapshot);
  if (missing.length > 0) {
    markNeedsReview(
      input.runId,
      `HasData 返回信息缺失: ${missing.join(", ")}`
    );
  }

  createAmazonArtifacts(input.runId, input.jobId, input.asin, matched, snapshot);
  writeGlobalCache(input.domain, input.asin, { raw: matched, product: snapshot });
  return { product: snapshot, fromCache: false };
}

function createAmazonArtifacts(
  runId: string,
  jobId: string,
  asin: string,
  raw: HasDataAmazonProductResponse | undefined,
  product: AmazonProductSnapshot
) {
  if (raw) {
    createArtifact({
      runId,
      jobId,
      type: "amazon/provider/raw",
      relativePath: `amazon/products/${asin}/provider/raw.json`,
      content: raw
    });
  }
  createArtifact({
    runId,
    jobId,
    type: "amazon/product/snapshot",
    relativePath: `amazon/products/${asin}/product.json`,
    content: product
  });
}
