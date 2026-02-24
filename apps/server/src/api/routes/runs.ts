import { Router } from "express";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { z } from "zod";
import {
  RunEvent,
  WayfairProductAdditionQuestion,
  WayfairSubmitProductAdditionsRequest
} from "@wayfo/shared";
import { sendError } from "../errors";
import { eventBus } from "../../core/events/eventBus";
import { log } from "../../core/logger";
import { runsRoot } from "../../core/paths";
import {
  getRunImagePath,
  readRunCache,
  readRunImageIndex
} from "../../core/amazon/cache";
import {
  createArtifact,
  createRun,
  getRun,
  listArtifacts,
  listJobs,
  listRuns,
  updateRun
} from "../../core/store/runStore";
import { getAppSettings } from "../../core/store/settingsStore";
import { startRun, resumeRun, resumeWayfairAfterReview } from "../../orchestrator/orchestrator";

export const runsRouter = Router();

const createRunSchema = z.object({
  amazonUrl: z.string().min(1),
  marketContext: z.string().optional(),
  manufacturerId: z.string().optional(),
  enumerateVariants: z.boolean().optional()
});

const actionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"])
});

const reviewSchema = z.object({
  request: z.record(z.string(), z.unknown())
});

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function readJsonWithMeta<T>(filePath: string): { data: T; updatedAt: string } | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  const stat = fs.statSync(filePath);
  return { data: raw, updatedAt: stat.mtime.toISOString() };
}

function readQuestionsArtifact(runId: string) {
  const fullPath = path.join(runsRoot, runId, "artifacts", "wayfair", "questions.json");
  return readJson<WayfairProductAdditionQuestion[]>(fullPath);
}

function readSubmitRequest(runId: string) {
  const fullPath = path.join(runsRoot, runId, "artifacts", "wayfair", "submit", "request.json");
  return readJsonWithMeta<unknown>(fullPath);
}

function readSubmitDraft(runId: string) {
  const fullPath = path.join(runsRoot, runId, "artifacts", "wayfair", "submit", "draft.json");
  return readJsonWithMeta<unknown>(fullPath);
}

function readLatestJsonInDir<T>(dirPath: string, prefix: string) {
  if (!fs.existsSync(dirPath)) {
    return null;
  }
  const files = fs
    .readdirSync(dirPath)
    .filter((file) => file.startsWith(prefix) && file.endsWith(".json"));
  if (files.length === 0) {
    return null;
  }
  const latest = files
    .map((file) => ({
      file,
      mtime: fs.statSync(path.join(dirPath, file)).mtimeMs
    }))
    .sort((a, b) => a.mtime - b.mtime)
    .pop();
  if (!latest) {
    return null;
  }
  return readJson<T>(path.join(dirPath, latest.file));
}

function readLatestSubmissions(runId: string) {
  const dirPath = path.join(runsRoot, runId, "artifacts", "wayfair", "submissions");
  return readLatestJsonInDir(dirPath, "attempt-");
}

function readLatestRepairSuggestions(runId: string) {
  const dirPath = path.join(runsRoot, runId, "artifacts", "wayfair", "submit", "repairs");
  return readLatestJsonInDir(dirPath, "suggestions-");
}

function getGeneratedImagesDir(runId: string, asin: string, type: string) {
  return path.join(runsRoot, runId, "artifacts", "images", "generated", asin, type);
}

function normalizeReviewRequest(
  request: Record<string, unknown>,
  questions: WayfairProductAdditionQuestion[]
) {
  void questions;
  return {
    request,
    summary: { removedAnswers: 0, normalizedAnswers: 0, fixedRanks: 0, touchedQuestions: [] }
  };
}

runsRouter.post("/", async (req, res) => {
  const parsed = createRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "amazonUrl is required"
    });
  }

  const run = createRun(parsed.data);
  if (parsed.data.enumerateVariants === undefined) {
    const defaults = getAppSettings();
    if (defaults.enumerateVariantsDefault) {
      updateRun(run.id, { enumerateVariants: true });
    }
  }
  startRun(run).catch((error) => {
    log({
      level: "error",
      runId: run.id,
      message: "Run failed",
      err: error
    });
    updateRun(run.id, { status: "FAILED" });
    eventBus.emit({
      id: nanoid(),
      type: "RUN_FAILED",
      runId: run.id,
      message: "Run failed",
      timestamp: new Date().toISOString()
    });
  });

  res.status(201).json(run);
});

runsRouter.get("/", (_req, res) => {
  res.json(listRuns());
});

runsRouter.get("/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(res, {
      code: "RUN_NOT_FOUND",
      message: "Run not found"
    }, 404);
  }

  res.json({
    run,
    jobs: listJobs(run.id),
    artifacts: listArtifacts(run.id)
  });
});

runsRouter.get("/:runId/artifacts", (req, res) => {
  res.json(listArtifacts(req.params.runId));
});

runsRouter.get("/:runId/products", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const baseDir = path.join(
    runsRoot,
    run.id,
    "artifacts",
    "amazon",
    "products"
  );
  if (!fs.existsSync(baseDir)) {
    return res.json([]);
  }
  const asins = fs
    .readdirSync(baseDir)
    .filter((entry) => fs.statSync(path.join(baseDir, entry)).isDirectory());
  const products = asins
    .map((asin) => {
      const cached = readRunCache(run.id, asin);
      if (!cached) {
        return null;
      }
      const product = cached.product;
      const imageIndex = readRunImageIndex(run.id, asin);
      const primaryUrl = product.images.primary ?? product.images.all[0];
      const imageName = primaryUrl
        ? imageIndex?.items.find((item) => item.url === primaryUrl)?.fileName
        : undefined;
      return {
        asin: product.asin,
        title: product.title,
        brand: product.brand,
        price: product.price,
        availability: product.availability,
        imageName,
        imageUrl: primaryUrl
      };
    })
    .filter(Boolean);
  res.json(products);
});

runsRouter.get("/:runId/products/:asin", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const cached = readRunCache(run.id, req.params.asin);
  if (!cached) {
    return sendError(
      res,
      {
        code: "PRODUCT_NOT_FOUND",
        message: "Product not found"
      },
      404
    );
  }
  const imageIndex = readRunImageIndex(run.id, req.params.asin) ?? undefined;
  res.json({ product: cached.product, images: imageIndex });
});

runsRouter.get("/:runId/images/:asin/:imageName", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const imageName = decodeURIComponent(req.params.imageName);
  const baseDir = path.resolve(
    runsRoot,
    run.id,
    "artifacts",
    "amazon",
    "products",
    req.params.asin,
    "images"
  );
  const imagePath = path.resolve(getRunImagePath(run.id, req.params.asin, imageName));
  if (!imagePath.startsWith(baseDir)) {
    return sendError(res, {
      code: "INVALID_IMAGE_PATH",
      message: "Invalid image path"
    });
  }
  if (!fs.existsSync(imagePath)) {
    return sendError(
      res,
      {
        code: "IMAGE_NOT_FOUND",
        message: "Image not found"
      },
      404
    );
  }
  res.sendFile(imagePath);
});

runsRouter.get("/:runId/generated-images/:asin/:type/:imageName", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const type = decodeURIComponent(req.params.type);
  const imageName = decodeURIComponent(req.params.imageName);
  const baseDir = path.resolve(getGeneratedImagesDir(run.id, req.params.asin, type));
  const imagePath = path.resolve(path.join(baseDir, imageName));
  if (!imagePath.startsWith(baseDir)) {
    return sendError(res, {
      code: "INVALID_IMAGE_PATH",
      message: "Invalid image path"
    });
  }
  if (!fs.existsSync(imagePath)) {
    return sendError(
      res,
      {
        code: "IMAGE_NOT_FOUND",
        message: "Image not found"
      },
      404
    );
  }
  res.sendFile(imagePath);
});

runsRouter.post("/:runId/actions", async (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_ACTION",
      message: "action must be pause, resume, or cancel"
    });
  }

  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(res, {
      code: "RUN_NOT_FOUND",
      message: "Run not found"
    }, 404);
  }

  const action = parsed.data.action;

  if (action === "resume") {
    if (run.status !== "NEEDS_REVIEW" && run.status !== "PAUSED") {
      return sendError(res, {
        code: "INVALID_STATE",
        message: `Cannot resume run with status ${run.status}`
      });
    }

    res.json({ ok: true, message: "Run resuming" });

    resumeRun(run.id).catch((error) => {
      log({
        level: "error",
        runId: run.id,
        message: "Resume run failed",
        err: { error: String(error) }
      });
    });
    return;
  }

  const nextStatus = action === "pause" ? "PAUSED" : "CANCELLED";
  const updated = updateRun(run.id, { status: nextStatus });

  const event: RunEvent = {
    id: nanoid(),
    type: "RUN_PROGRESS",
    runId: run.id,
    message: `Run ${action}d`,
    data: { status: updated.status },
    timestamp: new Date().toISOString()
  };
  eventBus.emit(event);
  res.json(updated);
});

runsRouter.get("/:runId/events", (req, res) => {
  const runId = req.params.runId;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("event: ready\n");
  res.write("data: {}\n\n");

  const run = getRun(runId);
  if (run) {
    const initEvent: RunEvent = {
      id: nanoid(),
      type: "RUN_PROGRESS",
      runId,
      data: { status: run.status, currentStep: run.currentStep },
      timestamp: new Date().toISOString()
    };
    res.write(`data: ${JSON.stringify(initEvent)}\n\n`);
  }

  const unsubscribe = eventBus.subscribe(runId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});

runsRouter.get("/:runId/wayfair/submissions", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const submissions = readLatestSubmissions(run.id);
  const suggestions = readLatestRepairSuggestions(run.id);
  res.json({ submissions, suggestions });
});

runsRouter.get("/:runId/wayfair/request", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const request = readSubmitRequest(run.id);
  if (!request) {
    return sendError(
      res,
      {
        code: "REQUEST_NOT_FOUND",
        message: "Wayfair submit request not found"
      },
      404
    );
  }
  res.json({ request: request.data, updatedAt: request.updatedAt });
});

runsRouter.get("/:runId/wayfair/questions", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const questions = readQuestionsArtifact(run.id);
  if (!questions) {
    return sendError(res, {
      code: "QUESTIONS_NOT_FOUND",
      message: "Wayfair questions not found"
    }, 404);
  }
  res.json({ questions });
});

runsRouter.get("/:runId/wayfair/draft", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const draft = readSubmitDraft(run.id);
  if (!draft) {
    return sendError(
      res,
      {
        code: "DRAFT_NOT_FOUND",
        message: "Wayfair submit draft not found"
      },
      404
    );
  }
  res.json({ draft: draft.data, updatedAt: draft.updatedAt });
});

runsRouter.post("/:runId/wayfair/draft", async (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "request is required"
    });
  }
  try {
    createArtifact({
      runId: run.id,
      type: "wayfair/submit/draft",
      relativePath: "wayfair/submit/draft.json",
      content: parsed.data.request
    });
    res.json({ ok: true });
  } catch (error) {
    sendError(res, {
      code: "DRAFT_SAVE_FAILED",
      message: error instanceof Error ? error.message : "Draft save failed"
    });
  }
});

runsRouter.post("/:runId/wayfair/review", async (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(
      res,
      {
        code: "RUN_NOT_FOUND",
        message: "Run not found"
      },
      404
    );
  }
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "request is required"
    });
  }
  const questions = readQuestionsArtifact(run.id);
  if (!questions) {
    return sendError(res, {
      code: "QUESTIONS_NOT_FOUND",
      message: "Wayfair questions not found"
    });
  }
  try {
    const normalized = normalizeReviewRequest(parsed.data.request, questions);
    await resumeWayfairAfterReview(
      run.id,
      normalized.request as WayfairSubmitProductAdditionsRequest
    );
    res.json({
      ok: true,
      summary: normalized.summary
    });
  } catch (error) {
    sendError(res, {
      code: "REVIEW_SUBMIT_FAILED",
      message: error instanceof Error ? error.message : "Review submit failed"
    });
  }
});
