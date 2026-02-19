import { Router } from "express";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { z } from "zod";
import { RunEvent } from "@wayfo/shared";
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
  createRun,
  getRun,
  listArtifacts,
  listJobs,
  listRuns,
  updateRun
} from "../../core/store/runStore";
import { getAppSettings } from "../../core/store/settingsStore";
import { startRun } from "../../orchestrator/orchestrator";

export const runsRouter = Router();

const createRunSchema = z.object({
  amazonUrl: z.string().min(1),
  marketContext: z.string().optional(),
  enumerateVariants: z.boolean().optional()
});

const actionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"])
});

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

runsRouter.post("/:runId/actions", (req, res) => {
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
  const nextStatus =
    action === "pause" ? "PAUSED" : action === "resume" ? "RUNNING" : "CANCELLED";
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
