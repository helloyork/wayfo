import { nanoid } from "nanoid";
import { Run, RunEvent, Step, HasDataAmazonProductResponse } from "@wayfo/shared";
import { eventBus } from "../core/events/eventBus";
import { log } from "../core/logger";
import {
  createArtifact,
  getOrCreateJob,
  hashInput,
  updateJob,
  updateRun
} from "../core/store/runStore";
import { getHasDataApiKey, getWayfairActiveSettings } from "../core/store/settingsStore";
import { extractAsin, normalizeAmazonDomain } from "../core/amazon/asin";
import {
  amazonProductSchemaVersion,
  normalizeHasDataProduct,
  validateAmazonSnapshot,
  type AmazonProductSnapshot
} from "../core/amazon/normalize";
import { readGlobalCache, readRunCache, writeGlobalCache } from "../core/amazon/cache";
import { getWayfairPoolId } from "../core/config";
import { ensureTaxonomyCache, parseMarketContext } from "../core/wayfair/taxonomyInit";
import {
  HasDataError,
  scrapeAmazonProduct
} from "../connectors/hasdata";
import { downloadProductImages } from "../core/images/downloadPool";

const steps: Step[] = ["SCRAPE_AMAZON"];

function emit(event: RunEvent) {
  eventBus.emit(event);
}

export async function startRun(run: Run) {
  const initializing = updateRun(run.id, {
    status: "INITIALIZING",
    currentStep: undefined
  });
  emit({
    id: nanoid(),
    type: "RUN_INITIALIZING",
    runId: initializing.id,
    data: { status: initializing.status },
    timestamp: new Date().toISOString()
  });

  const initOk = await runInitializationGate(run);
  if (!initOk) {
    return;
  }

  const updated = updateRun(run.id, { status: "RUNNING", currentStep: undefined });
  emit({
    id: nanoid(),
    type: "RUN_STARTED",
    runId: updated.id,
    data: { status: updated.status },
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

async function runInitializationGate(run: Run) {
  const settings = getWayfairActiveSettings();
  if (!settings) {
    markNeedsReview(
      run.id,
      "缺少 Wayfair 凭据，请先在设置页配置并验证。",
      undefined,
      "WAITING_FOR_REVIEW"
    );
    return false;
  }
  const marketContext = parseMarketContext(run.marketContext);
  if (!marketContext) {
    markNeedsReview(
      run.id,
      "缺少 marketContext，请在创建 Run 时提供。",
      "示例：{\"locale\":\"en-US\",\"country\":\"UNITED_STATES\",\"brand\":\"WAYFAIR\"}",
      "WAITING_FOR_REVIEW"
    );
    return false;
  }

  emit({
    id: nanoid(),
    type: "RUN_PROGRESS",
    runId: run.id,
    message: "Taxonomy 初始化中...",
    timestamp: new Date().toISOString()
  });

  try {
    const result = await ensureTaxonomyCache({
      poolId: getWayfairPoolId(),
      marketContext,
      credentials: {
        env: settings.env,
        clientId: settings.clientId.trim(),
        clientSecret: settings.clientSecret.trim(),
        audience: settings.audience.trim()
      }
    });
    createArtifact({
      runId: run.id,
      type: "wayfair/taxonomy/ref",
      relativePath: "wayfair/taxonomyRef.json",
      content: {
        env: result.meta.env,
        poolId: result.meta.poolId,
        marketContext: result.meta.marketContext,
        marketContextHash: result.meta.marketContextHash,
        version: result.meta.activeVersion,
        initializedAt: result.meta.initializedAt,
        expiresAt: result.meta.expiresAt,
        status: result.status
      }
    });
    emit({
      id: nanoid(),
      type: "RUN_PROGRESS",
      runId: run.id,
      message:
        result.status === "rebuilt"
          ? "Taxonomy 初始化完成"
          : result.status === "stale"
            ? "Taxonomy 已过期，已在后台刷新"
            : "Taxonomy 已就绪",
      timestamp: new Date().toISOString()
    });
    return true;
  } catch (error) {
    markNeedsReview(
      run.id,
      error instanceof Error ? error.message : "Taxonomy 初始化失败",
      undefined,
      "NEEDS_REVIEW"
    );
    return false;
  }
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
    markNeedsReview(
      run.id,
      "缺少 HasData API Key，请先在设置页配置并验证。",
      undefined,
      "WAITING_FOR_REVIEW"
    );
    return;
  }

  const domain = normalizeAmazonDomain(run.amazonUrl);
  const asin = extractAsin(run.amazonUrl);
  if (!asin) {
    markNeedsReview(
      run.id,
      "无法从链接中解析 ASIN，请检查 Amazon 链接。",
      undefined,
      "WAITING_FOR_REVIEW"
    );
    return;
  }

  const seedJobResult = getOrCreateJob({
    runId: run.id,
    step: "SCRAPE_AMAZON",
    inputHash: hashInput({
      type: "seed",
      amazonUrl: run.amazonUrl,
      domain,
      asin,
      schemaVersion: amazonProductSchemaVersion
    }),
    schemaVersion: amazonProductSchemaVersion
  });
  const seedJob = seedJobResult.job;

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
    message: seedJobResult.reused ? "Seed job reused" : "Seed job started"
  });
  if (!seedJobResult.reused) {
    updateJob(run.id, seedJob.id, { status: "RUNNING", attempts: 1 });
  } else if (seedJob.status !== "SUCCEEDED" && seedJob.status !== "SKIPPED") {
    updateJob(run.id, seedJob.id, {
      status: "RUNNING",
      attempts: seedJob.attempts + 1
    });
  }

  let seedSnapshot: AmazonProductSnapshot | null = null;
  try {
    if (seedJobResult.reused && (seedJob.status === "SUCCEEDED" || seedJob.status === "SKIPPED")) {
      const cached = readRunCache(run.id, asin);
      if (cached?.product) {
        seedSnapshot = cached.product;
        emit({
          id: nanoid(),
          type: "JOB_PROGRESS",
          runId: run.id,
          jobId: seedJob.id,
          step: "SCRAPE_AMAZON",
          message: "Seed 已完成，跳过采集",
          timestamp: new Date().toISOString()
        });
      } else {
        const seedResult = await fetchAndCacheAsin({
          runId: run.id,
          jobId: seedJob.id,
          domain,
          asin,
          apiKey
        });
        seedSnapshot = seedResult.product;
        await downloadImagesForSnapshot(run.id, seedJob.id, seedSnapshot);
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
      }
    } else {
      const seedResult = await fetchAndCacheAsin({
        runId: run.id,
        jobId: seedJob.id,
        domain,
        asin,
        apiKey
      });
      seedSnapshot = seedResult.product;
      await downloadImagesForSnapshot(run.id, seedJob.id, seedSnapshot);
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
    }
  } catch (error) {
    handleJobError(run.id, seedJob.id, "SCRAPE_AMAZON", error);
    return;
  }

  if (!run.enumerateVariants) {
    emit({
      id: nanoid(),
      type: "RUN_PROGRESS",
      runId: run.id,
      message: "变体枚举已关闭，跳过变体入列。",
      timestamp: new Date().toISOString()
    });
    log({
      level: "info",
      runId: run.id,
      step: "SCRAPE_AMAZON",
      message: "Variants enumeration disabled"
    });
    return;
  }

  const variantAsins =
    seedSnapshot?.variants.map((variant) => variant.asin).filter(Boolean) ?? [];
  for (const variantAsin of variantAsins) {
    const variantJobResult = getOrCreateJob({
      runId: run.id,
      step: "SCRAPE_AMAZON",
      inputHash: hashInput({
        type: "variant",
        domain,
        asin: variantAsin,
        schemaVersion: amazonProductSchemaVersion
      }),
      schemaVersion: amazonProductSchemaVersion
    });
    const variantJob = variantJobResult.job;
    emit({
      id: nanoid(),
      type: "JOB_STARTED",
      runId: run.id,
      jobId: variantJob.id,
      step: "SCRAPE_AMAZON",
      timestamp: new Date().toISOString()
    });
    if (!variantJobResult.reused) {
      updateJob(run.id, variantJob.id, { status: "RUNNING", attempts: 1 });
    } else if (variantJob.status !== "SUCCEEDED" && variantJob.status !== "SKIPPED") {
      updateJob(run.id, variantJob.id, {
        status: "RUNNING",
        attempts: variantJob.attempts + 1
      });
    }

    try {
      if (
        variantJobResult.reused &&
        (variantJob.status === "SUCCEEDED" || variantJob.status === "SKIPPED")
      ) {
        emit({
          id: nanoid(),
          type: "JOB_PROGRESS",
          runId: run.id,
          jobId: variantJob.id,
          step: "SCRAPE_AMAZON",
          message: "变体已完成，跳过采集",
          timestamp: new Date().toISOString()
        });
      } else {
        const result = await fetchAndCacheAsin({
          runId: run.id,
          jobId: variantJob.id,
          domain,
          asin: variantAsin,
          apiKey
        });
        await downloadImagesForSnapshot(run.id, variantJob.id, result.product);
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
      }
    } catch (error) {
      handleJobError(run.id, variantJob.id, "SCRAPE_AMAZON", error);
      return;
    }
  }
}

function collectImageUrls(snapshot: AmazonProductSnapshot) {
  const urls = new Set<string>();
  if (snapshot.images.primary) {
    urls.add(snapshot.images.primary);
  }
  snapshot.images.all.forEach((url) => urls.add(url));
  snapshot.images.description.forEach((url) => urls.add(url));
  snapshot.variants.forEach((variant) => {
    if (variant.imageUrl) {
      urls.add(variant.imageUrl);
    }
  });
  return Array.from(urls);
}

async function downloadImagesForSnapshot(
  runId: string,
  jobId: string,
  snapshot: AmazonProductSnapshot
) {
  const urls = collectImageUrls(snapshot);
  if (urls.length === 0) {
    return;
  }
  try {
    const index = await downloadProductImages({
      runId,
      asin: snapshot.asin,
      urls
    });
    if (index) {
      createArtifact({
        runId,
        jobId,
        type: "amazon/product/images",
        relativePath: `amazon/products/${snapshot.asin}/images/index.json`,
        content: index
      });
    }
  } catch (error) {
    log({
      level: "warn",
      runId,
      jobId,
      step: "SCRAPE_AMAZON",
      message: "Image download failed",
      err: error
    });
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

function markNeedsReview(
  runId: string,
  message: string,
  suggestion?: string,
  status: "NEEDS_REVIEW" | "WAITING_FOR_REVIEW" = "NEEDS_REVIEW"
) {
  updateRun(runId, { status });
  emit({
    id: nanoid(),
    type: status === "WAITING_FOR_REVIEW" ? "WAITING_FOR_REVIEW" : "NEEDS_REVIEW",
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

  const matched = await scrapeAmazonProduct({
    asin: input.asin,
    domain: input.domain,
    apiKey: input.apiKey
  });
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
