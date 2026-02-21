import { nanoid } from "nanoid";
import {
  Run,
  RunEvent,
  Step,
  HasDataAmazonProductResponse,
  WayfairMediaMetaDataTagSet,
  WayfairProductAdditionQuestion,
  WayfairSubmitProductAdditionsRequest,
  WayfairSupplierBrandAssociation,
  WayfairProductAdditionSubmission
} from "@wayfo/shared";
import fs from "fs";
import path from "path";
import { eventBus } from "../core/events/eventBus";
import { log } from "../core/logger";
import {
  createArtifact,
  getRun,
  getOrCreateJob,
  hashInput,
  updateJob,
  updateRun
} from "../core/store/runStore";
import {
  getAppSettings,
  getHasDataApiKey,
  getR2Settings,
  getWayfairActiveSettings
} from "../core/store/settingsStore";
import { extractAsin, normalizeAmazonDomain } from "../core/amazon/asin";
import {
  amazonProductSchemaVersion,
  normalizeHasDataProduct,
  validateAmazonSnapshot,
  type AmazonProductSnapshot
} from "../core/amazon/normalize";
import {
  readGlobalCache,
  readRunCache,
  writeGlobalCache,
  readRunImageIndex,
  getRunImagesDir
} from "../core/amazon/cache";
import { getWayfairPoolId } from "../core/config";
import { ensureTaxonomyCache, parseMarketContext } from "../core/wayfair/taxonomyInit";
import { classifyWayfairClass } from "../core/wayfair/classification";
import {
  fetchWayfairBrandAssociations,
  fetchWayfairMediaMetaDataTags,
  fetchWayfairQuestions
} from "../core/wayfair/discovery";
import { flattenQuestions, normalizeAnswersForPart } from "../core/wayfair/answerRules";
import { submitWayfairProductAdditions, fetchWayfairSubmissions } from "../core/wayfair/productAddition";
import { buildWayfairSubmitRequest } from "../core/wayfair/submitBuilder";
import { reduceWayfairFlaws } from "../core/wayfair/flawReducer";
import { repairFlawsWithAgent, type FlawAgentResult } from "../core/wayfair/flawAgent";
import { dataRoot, runsRoot, ensureDir } from "../core/paths";
import {
  HasDataError,
  scrapeAmazonProduct
} from "../connectors/hasdata";
import { downloadProductImages } from "../core/images/downloadPool";
import { generateImages, type GeneratedImage } from "../core/images/generator";
import {
  buildImageUrlsForSubmit,
  configureR2LifecycleRules,
  uploadImagesToR2,
  type UploadedImage
} from "../core/images/r2Uploader";

const steps: Step[] = [
  "SCRAPE_AMAZON",
  "WAYFAIR_CLASSIFY",
  "WAYFAIR_DISCOVERY",
  "IMAGE_GENERATE",
  "IMAGE_UPLOAD",
  "WAYFAIR_SUBMIT",
  "WAYFAIR_POLL"
];
const wayfairClassifySchemaVersion = "v1";
const wayfairDiscoverySchemaVersion = "v1";
const imageGenerateSchemaVersion = "v1";
const imageUploadSchemaVersion = "v1";
const wayfairSubmitSchemaVersion = "v2";
const wayfairPollSchemaVersion = "v1";

function sanitizeWayfairRequestAnswers(
  request: WayfairSubmitProductAdditionsRequest,
  questions: WayfairProductAdditionQuestion[]
) {
  const questionMap = new Map(flattenQuestions(questions).map((question) => [question.id, question]));
  const touched = new Set<string>();
  return {
    ...request,
    proposedProductAdditions: request.proposedProductAdditions.map((addition) => ({
      ...addition,
      parts: addition.parts.map((part) => {
        const normalized = normalizeAnswersForPart(part.answers ?? [], questionMap, touched);
        return {
          ...part,
          answers: normalized.answers
        };
      })
    }))
  };
}

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

export async function resumeWayfairAfterReview(
  runId: string,
  request: WayfairSubmitProductAdditionsRequest
) {
  const run = getRun(runId);
  if (!run) {
    throw new Error("Run not found");
  }
  const settings = getWayfairActiveSettings();
  if (!settings) {
    markNeedsReview(run.id, "缺少 Wayfair 凭据，无法提交。");
    return;
  }
  updateRun(run.id, { status: "RUNNING", currentStep: "WAYFAIR_SUBMIT" });
  emit({
    id: nanoid(),
    type: "RUN_PROGRESS",
    runId: run.id,
    message: "人工修正已提交，继续执行 Wayfair 提交",
    timestamp: new Date().toISOString()
  });

  const inputHash = hashInput({
    request,
    schemaVersion: wayfairSubmitSchemaVersion,
    mode: "review"
  });
  const jobResult = getOrCreateJob({
    runId: run.id,
    step: "WAYFAIR_SUBMIT",
    inputHash,
    schemaVersion: wayfairSubmitSchemaVersion
  });
  const job = jobResult.job;
  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId: run.id,
    jobId: job.id,
    step: "WAYFAIR_SUBMIT",
    timestamp: new Date().toISOString()
  });
  if (!jobResult.reused) {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: 1 });
  } else if (job.status !== "SUCCEEDED" && job.status !== "SKIPPED") {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: job.attempts + 1 });
  }

  try {
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/submit/request",
      relativePath: "wayfair/submit/request.json",
      content: request
    });
    const submitResponse = await submitWayfairProductAdditions({
      credentials: {
        env: settings.env,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        audience: settings.audience
      },
      request
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/submit/requestIds",
      relativePath: "wayfair/submit/requestIds.json",
      content: submitResponse.requestIds
    });
    updateJob(run.id, job.id, { status: "SUCCEEDED" });
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_SUBMIT",
      message: "Wayfair submit 已提交（人工修正）",
      timestamp: new Date().toISOString()
    });
    await runWayfairPoll(run);
  } catch (error) {
    updateJob(run.id, job.id, { status: "FAILED", errorSummary: String(error) });
    markNeedsReview(
      run.id,
      error instanceof Error ? error.message : "Wayfair submit 失败"
    );
    emit({
      id: nanoid(),
      type: "JOB_FAILED",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_SUBMIT",
      message: error instanceof Error ? error.message : "Job failed",
      timestamp: new Date().toISOString()
    });
  }
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
  if (step === "WAYFAIR_CLASSIFY") {
    await runWayfairClassify(run);
    return;
  }
  if (step === "WAYFAIR_DISCOVERY") {
    await runWayfairDiscovery(run);
    return;
  }
  if (step === "IMAGE_GENERATE") {
    await runImageGenerate(run);
    return;
  }
  if (step === "IMAGE_UPLOAD") {
    await runImageUpload(run);
    return;
  }
  if (step === "WAYFAIR_SUBMIT") {
    await runWayfairSubmit(run);
    return;
  }
  if (step === "WAYFAIR_POLL") {
    await runWayfairPoll(run);
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

function readTaxonomyRef(runId: string) {
  const refPath = path.join(runsRoot, runId, "artifacts", "wayfair", "taxonomyRef.json");
  if (!fs.existsSync(refPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(refPath, "utf-8")) as {
    env: string;
    poolId: string;
    marketContextHash: string;
    version: string;
  };
}

function readJsonArtifact<T>(runId: string, relativePath: string) {
  const fullPath = path.join(runsRoot, runId, "artifacts", relativePath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(fullPath, "utf-8")) as T;
}

function readClassificationArtifact(runId: string) {
  return readJsonArtifact<{
    decision?: { classId?: string };
  }>(runId, "wayfair/classification.json");
}

function readQuestionsArtifact(runId: string) {
  return readJsonArtifact<WayfairProductAdditionQuestion[]>(runId, "wayfair/questions.json");
}

function readBrandAssociationsArtifact(runId: string) {
  return readJsonArtifact<WayfairSupplierBrandAssociation[]>(
    runId,
    "wayfair/brandAssociations.json"
  );
}

function readMediaTagsArtifact(runId: string) {
  return readJsonArtifact<WayfairMediaMetaDataTagSet[]>(
    runId,
    "wayfair/mediaMetaDataTags.json"
  );
}

function readSubmitRequestIds(runId: string) {
  return readJsonArtifact<string[]>(runId, "wayfair/submit/requestIds.json");
}

function readSubmitRequest(runId: string) {
  return readJsonArtifact<unknown>(runId, "wayfair/submit/request.json");
}

async function runWayfairClassify(run: Run) {
  updateRun(run.id, { currentStep: "WAYFAIR_CLASSIFY" });
  const asin = extractAsin(run.amazonUrl);
  if (!asin) {
    markNeedsReview(run.id, "无法从链接中解析 ASIN，无法进行类目判定。");
    return;
  }
  const snapshot = readRunCache(run.id, asin)?.product;
  if (!snapshot) {
    markNeedsReview(run.id, "缺少产品快照，无法进行类目判定。");
    return;
  }
  const taxonomyRef = readTaxonomyRef(run.id);
  if (!taxonomyRef?.version) {
    markNeedsReview(run.id, "缺少 taxonomy 引用，无法进行类目判定。");
    return;
  }
  const inputHash = hashInput({
    asin,
    taxonomyVersion: taxonomyRef.version,
    schemaVersion: wayfairClassifySchemaVersion
  });
  const jobResult = getOrCreateJob({
    runId: run.id,
    step: "WAYFAIR_CLASSIFY",
    inputHash,
    schemaVersion: wayfairClassifySchemaVersion
  });
  const job = jobResult.job;

  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId: run.id,
    jobId: job.id,
    step: "WAYFAIR_CLASSIFY",
    timestamp: new Date().toISOString()
  });
  if (!jobResult.reused) {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: 1 });
  } else if (job.status !== "SUCCEEDED" && job.status !== "SKIPPED") {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: job.attempts + 1 });
  }

  const cachePath = path.join(runsRoot, run.id, "artifacts", "wayfair", "classification.json");
  if (jobResult.reused && (job.status === "SUCCEEDED" || job.status === "SKIPPED") && fs.existsSync(cachePath)) {
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_CLASSIFY",
      message: "类目判定已完成，跳过重复计算",
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const taxonomyVersionDir = path.join(
      dataRoot,
      "cache",
      "wayfair",
      "taxonomy",
      taxonomyRef.env,
      taxonomyRef.poolId,
      taxonomyRef.marketContextHash,
      "versions",
      taxonomyRef.version
    );
    const result = await classifyWayfairClass({
      snapshot,
      taxonomyVersionDir
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/classification",
      relativePath: "wayfair/classification.json",
      content: {
        asin: snapshot.asin,
        taxonomyVersion: taxonomyRef.version,
        keywords: result.keywords,
        candidates: result.candidates,
        decision: result.decision,
        model: result.model
      }
    });
    updateJob(run.id, job.id, { status: "SUCCEEDED" });
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_CLASSIFY",
      message: "类目判定完成",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    updateJob(run.id, job.id, { status: "FAILED", errorSummary: String(error) });
    markNeedsReview(
      run.id,
      error instanceof Error ? error.message : "类目判定失败，请检查设置与 taxonomy 缓存。"
    );
    emit({
      id: nanoid(),
      type: "JOB_FAILED",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_CLASSIFY",
      message: error instanceof Error ? error.message : "Job failed",
      timestamp: new Date().toISOString()
    });
  }
}

async function runWayfairDiscovery(run: Run) {
  updateRun(run.id, { currentStep: "WAYFAIR_DISCOVERY" });
  const settings = getWayfairActiveSettings();
  if (!settings) {
    markNeedsReview(run.id, "缺少 Wayfair 凭据，无法执行 discovery。");
    return;
  }
  const marketContext = parseMarketContext(run.marketContext);
  if (!marketContext) {
    markNeedsReview(run.id, "缺少 marketContext，无法执行 discovery。");
    return;
  }
  const classification = readClassificationArtifact(run.id);
  const classIdRaw = classification?.decision?.classId;
  const classId = classIdRaw ? Number(classIdRaw) : Number.NaN;
  if (!Number.isFinite(classId)) {
    markNeedsReview(run.id, "缺少有效的 classId，无法执行 discovery。");
    return;
  }

  const inputHash = hashInput({
    classId,
    marketContext,
    schemaVersion: wayfairDiscoverySchemaVersion
  });
  const jobResult = getOrCreateJob({
    runId: run.id,
    step: "WAYFAIR_DISCOVERY",
    inputHash,
    schemaVersion: wayfairDiscoverySchemaVersion
  });
  const job = jobResult.job;
  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId: run.id,
    jobId: job.id,
    step: "WAYFAIR_DISCOVERY",
    timestamp: new Date().toISOString()
  });
  if (!jobResult.reused) {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: 1 });
  } else if (job.status !== "SUCCEEDED" && job.status !== "SKIPPED") {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: job.attempts + 1 });
  }

  if (jobResult.reused && (job.status === "SUCCEEDED" || job.status === "SKIPPED")) {
    const cachedQuestions = readQuestionsArtifact(run.id);
    if (cachedQuestions) {
      emit({
        id: nanoid(),
        type: "JOB_PROGRESS",
        runId: run.id,
        jobId: job.id,
        step: "WAYFAIR_DISCOVERY",
        message: "Wayfair discovery 已完成，跳过重复计算",
        timestamp: new Date().toISOString()
      });
      return;
    }
  }

  try {
    const credentials = {
      env: settings.env,
      clientId: settings.clientId,
      clientSecret: settings.clientSecret,
      audience: settings.audience
    };
    const questions = await fetchWayfairQuestions({
      credentials,
      supplierId: settings.supplierId,
      classId,
      marketContext
    });
    const brandAssociations = await fetchWayfairBrandAssociations({
      credentials,
      supplierId: settings.supplierId,
      marketContext
    });
    const mediaTags = await fetchWayfairMediaMetaDataTags({
      credentials,
      marketContext
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/questions",
      relativePath: "wayfair/questions.json",
      content: questions
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/brandAssociations",
      relativePath: "wayfair/brandAssociations.json",
      content: brandAssociations
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/mediaMetaDataTags",
      relativePath: "wayfair/mediaMetaDataTags.json",
      content: mediaTags
    });
    updateJob(run.id, job.id, { status: "SUCCEEDED" });
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_DISCOVERY",
      message: "Wayfair discovery 完成",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    updateJob(run.id, job.id, { status: "FAILED", errorSummary: String(error) });
    markNeedsReview(run.id, error instanceof Error ? error.message : "Wayfair discovery 失败");
    emit({
      id: nanoid(),
      type: "JOB_FAILED",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_DISCOVERY",
      message: error instanceof Error ? error.message : "Job failed",
      timestamp: new Date().toISOString()
    });
  }
}

function readGeneratedImagesArtifact(runId: string) {
  return readJsonArtifact<{
    results: Record<string, GeneratedImage[]>;
    totalCost: number;
  }>(runId, "images/generated.json");
}

function readUploadedImagesArtifact(runId: string) {
  return readJsonArtifact<{
    uploaded: Record<string, UploadedImage[]>;
    totalSize: number;
  }>(runId, "images/uploaded.json");
}

function resolveLocalImagePath(runId: string, asin: string, url: string): string | null {
  const index = readRunImageIndex(runId, asin);
  if (!index) {
    return null;
  }
  const item = index.items.find((entry) => entry.url === url);
  if (!item) {
    return null;
  }
  return path.join(getRunImagesDir(runId, asin), item.fileName);
}

const primaryPrompts = [
  "Rerender this product image with a clean white studio background. Maintain the exact product structure, materials, colors, and proportions. Use soft professional lighting with natural shadows. Do not add text, logos, watermarks, or additional objects. Camera angle: front view.",
  "Rerender this product image with a clean light gray studio background. Maintain the exact product structure, materials, colors, and proportions. Use soft professional lighting with natural shadows. Do not add text, logos, watermarks, or additional objects. Camera angle: 45-degree side view.",
  "Rerender this product image with a clean white studio background. Maintain the exact product structure, materials, colors, and proportions. Use soft professional lighting with natural shadows. Do not add text, logos, watermarks, or additional objects. Camera angle: side view.",
  "Rerender this product image with a clean white studio background. Maintain the exact product structure, materials, colors, and proportions. Use soft professional lighting with natural shadows. Do not add text, logos, watermarks, or additional objects. Camera angle: top-down view."
];

function getPrimaryCandidateCount() {
  const settings = getAppSettings();
  return settings.primaryImageCandidateCount ?? 4;
}

async function runImageGenerate(run: Run) {
  updateRun(run.id, { currentStep: "IMAGE_GENERATE" });

  const r2Settings = getR2Settings();
  if (!r2Settings) {
    emit({
      id: nanoid(),
      type: "RUN_PROGRESS",
      runId: run.id,
      message: "R2 未配置，跳过图片生成",
      timestamp: new Date().toISOString()
    });
    return;
  }

  const asin = extractAsin(run.amazonUrl);
  if (!asin) {
    markNeedsReview(run.id, "无法从链接中解析 ASIN，无法进行图片生成。");
    return;
  }

  const snapshot = readRunCache(run.id, asin)?.product;
  if (!snapshot) {
    markNeedsReview(run.id, "缺少产品快照，无法进行图片生成。");
    return;
  }

  const primaryUrl = snapshot.images.primary ?? snapshot.images.all[0];
  if (!primaryUrl) {
    markNeedsReview(run.id, "缺少主图 URL，无法进行图片生成。");
    return;
  }

  const primaryLocalPath = resolveLocalImagePath(run.id, asin, primaryUrl);
  if (!primaryLocalPath) {
    markNeedsReview(run.id, "未找到主图本地文件，无法进行图片生成。");
    return;
  }

  const variantAsins = run.enumerateVariants
    ? (snapshot.variants.map((v) => v.asin).filter(Boolean) ?? [])
    : [];

  const inputHash = hashInput({
    mainAsin: asin,
    variantCount: variantAsins.length,
    primaryUrl,
    schemaVersion: imageGenerateSchemaVersion
  });

  const jobResult = getOrCreateJob({
    runId: run.id,
    step: "IMAGE_GENERATE",
    inputHash,
    schemaVersion: imageGenerateSchemaVersion
  });
  const job = jobResult.job;

  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId: run.id,
    jobId: job.id,
    step: "IMAGE_GENERATE",
    timestamp: new Date().toISOString()
  });

  if (!jobResult.reused) {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: 1 });
  } else if (job.status !== "SUCCEEDED" && job.status !== "SKIPPED") {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: job.attempts + 1 });
  }

  const cachePath = path.join(runsRoot, run.id, "artifacts", "images", "generated.json");
  if (jobResult.reused && (job.status === "SUCCEEDED" || job.status === "SKIPPED") && fs.existsSync(cachePath)) {
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_GENERATE",
      message: "图片生成已完成，跳过重复生成",
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const outputBaseDir = path.join(runsRoot, run.id, "artifacts", "images", "generated");
    ensureDir(outputBaseDir);

    const primaryCandidateCount = getPrimaryCandidateCount();
    const tasks: Array<{
      asin: string;
      sourceUrl: string;
      sourcePath: string;
    }> = [];

    for (let i = 0; i < primaryCandidateCount; i += 1) {
      tasks.push({ asin, sourceUrl: primaryUrl, sourcePath: primaryLocalPath });
    }

    for (const variantAsin of variantAsins) {
      const variantSnapshot = readRunCache(run.id, variantAsin)?.product;
      const variantPrimaryUrl = variantSnapshot?.images.primary ?? variantSnapshot?.images.all[0];
      if (!variantPrimaryUrl) {
        continue;
      }
      const variantPrimaryPath = resolveLocalImagePath(run.id, variantAsin, variantPrimaryUrl);
      if (!variantPrimaryPath) {
        continue;
      }
      for (let i = 0; i < primaryCandidateCount; i += 1) {
        tasks.push({
          asin: variantAsin,
          sourceUrl: variantPrimaryUrl,
          sourcePath: variantPrimaryPath
        });
      }
    }

    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_GENERATE",
      message: `开始生成主图，共 ${tasks.length} 张`,
      timestamp: new Date().toISOString()
    });

    const resultsObj: Record<string, GeneratedImage[]> = {};
    let totalCost = 0;
    const errors: Array<{ asin: string; sourceUrl: string; error: string }> = [];

    for (let i = 0; i < tasks.length; i += 1) {
      const task = tasks[i];
      const asinOutputDir = path.join(outputBaseDir, task.asin);
      ensureDir(asinOutputDir);
      const prompt = primaryPrompts[i % primaryPrompts.length];

      const result = await generateImages({
        runId: run.id,
        asin: task.asin,
        tasks: [
          {
            sourceUrl: task.sourceUrl,
            sourcePath: task.sourcePath,
            type: "primary",
            prompt,
            quality: "high"
          }
        ],
        outputDir: asinOutputDir
      });

      resultsObj[task.asin] = [...(resultsObj[task.asin] ?? []), ...result.images];
      totalCost += result.totalCost;
      for (const error of result.errors) {
        errors.push({ asin: task.asin, ...error });
      }
    }

    if (!resultsObj[asin] || resultsObj[asin].length === 0) {
      markNeedsReview(run.id, "主产品主图生成失败，无法继续提交。");
      return;
    }

    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "images/generated",
      relativePath: "images/generated.json",
      content: {
        results: resultsObj,
        totalCost,
        errors
      }
    });

    updateJob(run.id, job.id, { status: "SUCCEEDED" });
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_GENERATE",
      message: `主图生成完成，成本 $${totalCost.toFixed(3)}`,
      timestamp: new Date().toISOString()
    });

    log({
      level: "info",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_GENERATE",
      message: "Primary image generation completed",
      err: {
        totalImages: Object.values(resultsObj).flat().length,
        totalCost,
        errorCount: errors.length
      }
    });
  } catch (error) {
    updateJob(run.id, job.id, { status: "FAILED", errorSummary: String(error) });
    markNeedsReview(run.id, error instanceof Error ? error.message : "图片生成失败");
    emit({
      id: nanoid(),
      type: "JOB_FAILED",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_GENERATE",
      message: error instanceof Error ? error.message : "Job failed",
      timestamp: new Date().toISOString()
    });
  }
}

async function runImageUpload(run: Run) {
  updateRun(run.id, { currentStep: "IMAGE_UPLOAD" });

  const r2Settings = getR2Settings();
  if (!r2Settings) {
    emit({
      id: nanoid(),
      type: "RUN_PROGRESS",
      runId: run.id,
      message: "R2 未配置，跳过图片上传",
      timestamp: new Date().toISOString()
    });
    return;
  }

  const generatedArtifact = readGeneratedImagesArtifact(run.id);
  if (!generatedArtifact || Object.keys(generatedArtifact.results).length === 0) {
    emit({
      id: nanoid(),
      type: "RUN_PROGRESS",
      runId: run.id,
      message: "没有生成的图片需要上传",
      timestamp: new Date().toISOString()
    });
    return;
  }

  const inputHash = hashInput({
    imageCount: Object.values(generatedArtifact.results).flat().length,
    schemaVersion: imageUploadSchemaVersion
  });

  const jobResult = getOrCreateJob({
    runId: run.id,
    step: "IMAGE_UPLOAD",
    inputHash,
    schemaVersion: imageUploadSchemaVersion
  });
  const job = jobResult.job;

  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId: run.id,
    jobId: job.id,
    step: "IMAGE_UPLOAD",
    timestamp: new Date().toISOString()
  });

  if (!jobResult.reused) {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: 1 });
  } else if (job.status !== "SUCCEEDED" && job.status !== "SKIPPED") {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: job.attempts + 1 });
  }

  const cachePath = path.join(runsRoot, run.id, "artifacts", "images", "uploaded.json");
  if (jobResult.reused && (job.status === "SUCCEEDED" || job.status === "SKIPPED") && fs.existsSync(cachePath)) {
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_UPLOAD",
      message: "图片上传已完成，跳过重复上传",
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_UPLOAD",
      message: "开始上传图片到 R2",
      timestamp: new Date().toISOString()
    });

    await configureR2LifecycleRules(r2Settings.lifecycleDays ?? 7);

    const mainAsin = extractAsin(run.amazonUrl);
    if (!mainAsin) {
      markNeedsReview(run.id, "无法从链接中解析 ASIN，无法上传图片。");
      return;
    }
    const mainSnapshot = readRunCache(run.id, mainAsin)?.product;
    if (!mainSnapshot) {
      markNeedsReview(run.id, "缺少产品快照，无法上传图片。");
      return;
    }

    const primaryUrl = mainSnapshot.images.primary ?? mainSnapshot.images.all[0];
    const otherImageUrls = new Set<string>();
    mainSnapshot.images.all.forEach((url) => {
      if (url && url !== primaryUrl) {
        otherImageUrls.add(url);
      }
    });
    mainSnapshot.images.description.forEach((url) => {
      if (url && url !== primaryUrl) {
        otherImageUrls.add(url);
      }
    });

    const uploadTargets = new Map<string, Array<{ localPath: string; type: "primary" | "other" }>>();

    for (const [asin, images] of Object.entries(generatedArtifact.results)) {
      const generated = images.map((img) => ({
        localPath: img.generatedPath,
        type: "primary" as const
      }));
      uploadTargets.set(asin, generated);
    }

    const mainOthers: Array<{ localPath: string; type: "other" }> = [];
    for (const url of otherImageUrls) {
      const localPath = resolveLocalImagePath(run.id, mainAsin, url);
      if (localPath) {
        mainOthers.push({ localPath, type: "other" });
      }
    }

    const existingMainTargets = uploadTargets.get(mainAsin) ?? [];
    uploadTargets.set(mainAsin, [...existingMainTargets, ...mainOthers]);

    const uploadedObj: Record<string, UploadedImage[]> = {};
    let totalSize = 0;
    const errors: Array<{ asin: string; localPath: string; error: string }> = [];

    for (const [asin, images] of uploadTargets) {
      if (images.length === 0) {
        continue;
      }
      const result = await uploadImagesToR2({
        runId: run.id,
        asin,
        images
      });
      uploadedObj[asin] = result.images;
      totalSize += result.totalSize;
      for (const error of result.errors) {
        errors.push({ asin, ...error });
      }
    }

    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "images/uploaded",
      relativePath: "images/uploaded.json",
      content: {
        uploaded: uploadedObj,
        totalSize,
        errors
      }
    });

    updateJob(run.id, job.id, { status: "SUCCEEDED" });
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_UPLOAD",
      message: `图片上传完成，总大小 ${(totalSize / 1024 / 1024).toFixed(2)} MB`,
      timestamp: new Date().toISOString()
    });

    log({
      level: "info",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_UPLOAD",
      message: "Image upload completed",
      err: {
        totalImages: Object.values(uploadedObj).flat().length,
        totalSize,
        errorCount: errors.length
      }
    });
  } catch (error) {
    updateJob(run.id, job.id, { status: "FAILED", errorSummary: String(error) });
    markNeedsReview(run.id, error instanceof Error ? error.message : "图片上传失败");
    emit({
      id: nanoid(),
      type: "JOB_FAILED",
      runId: run.id,
      jobId: job.id,
      step: "IMAGE_UPLOAD",
      message: error instanceof Error ? error.message : "Job failed",
      timestamp: new Date().toISOString()
    });
  }
}

async function runWayfairSubmit(run: Run) {
  updateRun(run.id, { currentStep: "WAYFAIR_SUBMIT" });
  const settings = getWayfairActiveSettings();
  if (!settings) {
    markNeedsReview(run.id, "缺少 Wayfair 凭据，无法提交。");
    return;
  }
  const marketContext = parseMarketContext(run.marketContext);
  if (!marketContext) {
    markNeedsReview(run.id, "缺少 marketContext，无法提交。");
    return;
  }
  const asin = extractAsin(run.amazonUrl);
  const snapshot = asin ? readRunCache(run.id, asin)?.product : null;
  if (!snapshot) {
    markNeedsReview(run.id, "缺少产品快照，无法提交。");
    return;
  }
  const classification = readClassificationArtifact(run.id);
  const classIdRaw = classification?.decision?.classId;
  const classId = classIdRaw ? Number(classIdRaw) : Number.NaN;
  if (!Number.isFinite(classId)) {
    markNeedsReview(run.id, "缺少有效的 classId，无法提交。");
    return;
  }
  const questions = readQuestionsArtifact(run.id);
  const brandAssociations = readBrandAssociationsArtifact(run.id);
  const mediaTags = readMediaTagsArtifact(run.id);
  if (!questions || !brandAssociations || !mediaTags) {
    markNeedsReview(run.id, "Wayfair discovery 产物缺失，无法提交。");
    return;
  }

  const inputHash = hashInput({
    classId,
    asin: snapshot.asin,
    schemaVersion: wayfairSubmitSchemaVersion
  });
  const jobResult = getOrCreateJob({
    runId: run.id,
    step: "WAYFAIR_SUBMIT",
    inputHash,
    schemaVersion: wayfairSubmitSchemaVersion
  });
  const job = jobResult.job;
  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId: run.id,
    jobId: job.id,
    step: "WAYFAIR_SUBMIT",
    timestamp: new Date().toISOString()
  });
  if (!jobResult.reused) {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: 1 });
  } else if (job.status !== "SUCCEEDED" && job.status !== "SKIPPED") {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: job.attempts + 1 });
  }

  const cachedRequestIds = readSubmitRequestIds(run.id);
  if (jobResult.reused && (job.status === "SUCCEEDED" || job.status === "SKIPPED") && cachedRequestIds) {
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_SUBMIT",
      message: "Wayfair submit 已完成，跳过重复提交",
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const uploadedArtifact = readUploadedImagesArtifact(run.id);
    let uploadedImageUrls: string[] | null = null;

    if (uploadedArtifact && asin) {
      const candidateUrls = buildImageUrlsForSubmit({
        mainAsin: asin,
        asin,
        uploadedImages: new Map(Object.entries(uploadedArtifact.uploaded)),
        isMain: true
      });
      if (candidateUrls.length > 0) {
        uploadedImageUrls = candidateUrls;
      }
    }

    const built = await buildWayfairSubmitRequest({
      snapshot,
      classId,
      marketContext,
      supplierId: settings.supplierId,
      questions,
      brandAssociations,
      mediaMetaDataTags: mediaTags,
      manufacturerId: run.manufacturerId,
      uploadedImageUrls
    });
    const request = sanitizeWayfairRequestAnswers(built.request, questions);
    const { answerResult, selected } = built;
    const partCount = request.proposedProductAdditions.reduce(
      (count, addition) => count + addition.parts.length,
      0
    );
    const answersCount = request.proposedProductAdditions.reduce(
      (count, addition) =>
        count +
        addition.parts.reduce((inner, part) => inner + (part.answers?.length ?? 0), 0),
      0
    );
    log({
      level: "info",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_SUBMIT",
      message: "Wayfair submit payload ready",
      err: {
        supplierId: request.supplierId,
        classId,
        partCount,
        answersCount,
        manufacturerId: selected.manufacturerId,
        supplierPartNumber: selected.supplierPartNumber,
        imageUrls: selected.imageUrls,
        usedUploadedImages: selected.usedUploadedImages
      }
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/submit/request",
      relativePath: "wayfair/submit/request.json",
      content: request
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/submit/answers",
      relativePath: "wayfair/submit/answers.json",
      content: answerResult
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/submit/selection",
      relativePath: "wayfair/submit/selection.json",
      content: selected
    });

    const submitResponse = await submitWayfairProductAdditions({
      credentials: {
        env: settings.env,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        audience: settings.audience
      },
      request
    });
    log({
      level: "info",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_SUBMIT",
      message: "Wayfair submit response",
      err: {
        requestIds: submitResponse.requestIds
      }
    });
    createArtifact({
      runId: run.id,
      jobId: job.id,
      type: "wayfair/submit/requestIds",
      relativePath: "wayfair/submit/requestIds.json",
      content: submitResponse.requestIds
    });
    updateJob(run.id, job.id, { status: "SUCCEEDED" });
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_SUBMIT",
      message: "Wayfair submit 已提交",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    updateJob(run.id, job.id, { status: "FAILED", errorSummary: String(error) });
    markNeedsReview(run.id, error instanceof Error ? error.message : "Wayfair submit 失败");
    emit({
      id: nanoid(),
      type: "JOB_FAILED",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_SUBMIT",
      message: error instanceof Error ? error.message : "Job failed",
      timestamp: new Date().toISOString()
    });
  }
}

async function runWayfairPoll(run: Run) {
  updateRun(run.id, { currentStep: "WAYFAIR_POLL" });
  const settings = getWayfairActiveSettings();
  if (!settings) {
    markNeedsReview(run.id, "缺少 Wayfair 凭据，无法轮询提交状态。");
    return;
  }
  let requestIds = readSubmitRequestIds(run.id);
  if (!requestIds || requestIds.length === 0) {
    markNeedsReview(run.id, "缺少 requestIds，无法轮询提交状态。");
    return;
  }

  const inputHash = hashInput({
    requestIds,
    schemaVersion: wayfairPollSchemaVersion
  });
  const jobResult = getOrCreateJob({
    runId: run.id,
    step: "WAYFAIR_POLL",
    inputHash,
    schemaVersion: wayfairPollSchemaVersion
  });
  const job = jobResult.job;
  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId: run.id,
    jobId: job.id,
    step: "WAYFAIR_POLL",
    timestamp: new Date().toISOString()
  });
  if (!jobResult.reused) {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: 1 });
  } else if (job.status !== "SUCCEEDED" && job.status !== "SKIPPED") {
    updateJob(run.id, job.id, { status: "RUNNING", attempts: job.attempts + 1 });
  }

  try {
    const maxAttempts = 6;
    const intervalMs = 5000;
    let submissions: WayfairProductAdditionSubmission[] = [];
    let repaired = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      submissions = await fetchWayfairSubmissions({
        credentials: {
          env: settings.env,
          clientId: settings.clientId,
          clientSecret: settings.clientSecret,
          audience: settings.audience
        },
        supplierId: settings.supplierId,
        requestIds
      });
      const statusSummary = submissions.map((item) => ({
        requestId: item.requestId,
        status: item.status,
        validationStatus: item.validationStatus,
        submissionStatus: item.submissionStatus,
        flawCount: item.validationFlaws?.length ?? 0
      }));
      log({
        level: "info",
        runId: run.id,
        jobId: job.id,
        step: "WAYFAIR_POLL",
        message: `Wayfair submissions poll #${attempt}`,
        err: statusSummary
      });
      createArtifact({
        runId: run.id,
        jobId: job.id,
        type: "wayfair/submissions",
        relativePath: `wayfair/submissions/attempt-${attempt}.json`,
        content: submissions
      });
      const hasFailed = submissions.some(
        (item) =>
          item.validationStatus === "FAILED" ||
          item.submissionStatus === "FAILED" ||
          (item.validationFlaws ?? []).length > 0
      );
      const allSubmitted = submissions.length > 0 && submissions.every((item) => item.status === "SUBMITTED");
      if (hasFailed) {
        if (!repaired) {
          const request = readSubmitRequest(run.id);
          const questions = readQuestionsArtifact(run.id);
          const asin = extractAsin(run.amazonUrl);
          const snapshot = asin ? readRunCache(run.id, asin)?.product : null;
          if (request && questions) {
            const reduced = reduceWayfairFlaws({
              request: request as never,
              questions,
              submissions,
              snapshot
            });

            let finalRequest = reduced.request;
            let agentResults: FlawAgentResult[] = [];
            let agentAppliedCount = 0;

            if (reduced.summary.unrepairableFlaws > 0 && snapshot) {
              const unrepairedFlaws = reduced.suggestions
                .filter((s) => !s.repairable && s.questionId !== "media::imageValue")
                .map((s) => {
                  const originalFlaw = submissions.flatMap((sub) => sub.validationFlaws ?? [])
                    .find((f) => f.questionId === s.questionId);
                  return {
                    questionId: s.questionId,
                    flawType: (originalFlaw?.flawType ?? "ERROR") as "ERROR" | "WARNING",
                    flaw: s.flaw
                  };
                });

              if (unrepairedFlaws.length > 0) {
                const existingAnswers = finalRequest.proposedProductAdditions
                  .flatMap((a) => a.parts)
                  .flatMap((p) => p.answers);

                log({
                  level: "info",
                  runId: run.id,
                  jobId: job.id,
                  step: "WAYFAIR_POLL",
                  message: "Attempting Agent repair for unresolved flaws",
                  err: { flawCount: unrepairedFlaws.length }
                });

                agentResults = await repairFlawsWithAgent({
                  flaws: unrepairedFlaws,
                  questions,
                  snapshot,
                  existingAnswers
                });

                for (const agentResult of agentResults) {
                  if (agentResult.result.repaired && agentResult.result.answers.length > 0) {
                    for (const addition of finalRequest.proposedProductAdditions) {
                      for (const part of addition.parts) {
                        part.answers = part.answers.filter(
                          (a) => a.questionId !== agentResult.questionId
                        );
                        part.answers.push(...agentResult.result.answers);
                      }
                    }
                    agentAppliedCount += 1;
                  }
                }
              }
            }

            const totalFixed = reduced.summary.appliedFixes + agentAppliedCount;
            if (reduced.changed || agentAppliedCount > 0) {
              finalRequest = sanitizeWayfairRequestAnswers(finalRequest, questions);
              const repairId = Date.now();
              log({
                level: "info",
                runId: run.id,
                jobId: job.id,
                step: "WAYFAIR_POLL",
                message: "Wayfair validationFlaws auto-fix applied",
                err: {
                  ...reduced.summary,
                  agentAppliedCount,
                  totalFixed
                }
              });
              createArtifact({
                runId: run.id,
                jobId: job.id,
                type: "wayfair/submit/repairSummary",
                relativePath: `wayfair/submit/repairs/summary-${repairId}.json`,
                content: {
                  ...reduced.summary,
                  agentAppliedCount,
                  agentResults: agentResults.map((r) => ({
                    questionId: r.questionId,
                    flaw: r.flaw,
                    repaired: r.result.repaired,
                    confidence: r.result.confidence,
                    reason: r.result.reason
                  }))
                }
              });
              createArtifact({
                runId: run.id,
                jobId: job.id,
                type: "wayfair/submit/request",
                relativePath: "wayfair/submit/request.json",
                content: finalRequest
              });
              createArtifact({
                runId: run.id,
                jobId: job.id,
                type: "wayfair/submit/repairRequest",
                relativePath: `wayfair/submit/repairs/request-${repairId}.json`,
                content: finalRequest
              });
              const submitResponse = await submitWayfairProductAdditions({
                credentials: {
                  env: settings.env,
                  clientId: settings.clientId,
                  clientSecret: settings.clientSecret,
                  audience: settings.audience
                },
                request: finalRequest
              });
              requestIds = submitResponse.requestIds;
              createArtifact({
                runId: run.id,
                jobId: job.id,
                type: "wayfair/submit/requestIds",
                relativePath: "wayfair/submit/requestIds.json",
                content: submitResponse.requestIds
              });
              createArtifact({
                runId: run.id,
                jobId: job.id,
                type: "wayfair/submit/repairRequestIds",
                relativePath: `wayfair/submit/repairs/requestIds-${repairId}.json`,
                content: submitResponse.requestIds
              });
              repaired = true;
              attempt = 0;
              continue;
            }
          }
        }
        break;
      }
      if (allSubmitted) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const hasFlaws = submissions.some((item) => (item.validationFlaws ?? []).length > 0);
    const failed = submissions.some(
      (item) => item.validationStatus === "FAILED" || item.submissionStatus === "FAILED"
    );
    if (hasFlaws || failed) {
      updateJob(run.id, job.id, { status: "FAILED", errorSummary: "Wayfair submissions 含 validationFlaws" });
      markNeedsReview(run.id, "Wayfair submissions 返回 validationFlaws，需要人工修正。");
      return;
    }

    updateJob(run.id, job.id, { status: "SUCCEEDED" });
    emit({
      id: nanoid(),
      type: "JOB_PROGRESS",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_POLL",
      message: "Wayfair submissions 状态已更新",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    updateJob(run.id, job.id, { status: "FAILED", errorSummary: String(error) });
    markNeedsReview(run.id, error instanceof Error ? error.message : "Wayfair poll 失败");
    emit({
      id: nanoid(),
      type: "JOB_FAILED",
      runId: run.id,
      jobId: job.id,
      step: "WAYFAIR_POLL",
      message: error instanceof Error ? error.message : "Job failed",
      timestamp: new Date().toISOString()
    });
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
