import { Router, type Request } from "express";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import multer from "multer";
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
  hasRunForGroup,
  hashInput,
  listArtifacts,
  listJobs,
  listRuns,
  updateRun
} from "../../core/store/runStore";
import { getAppSettings } from "../../core/store/settingsStore";
import {
  addProductGroupMembers,
  deactivateAllPlanItems,
  createPlanItem,
  createProductGroup,
  getProductGroupByAsin,
  getProductGroupByKey,
  listActivePlanItemsByDate,
  setProductGroupPrimaryAsin
} from "../../core/store/planStore";
import { startRun, resumeRun, resumeWayfairAfterReview } from "../../orchestrator/orchestrator";
import { extractAsin } from "../../core/amazon/asin";

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

const planImportSchema = z.object({
  marketContext: z.string().optional(),
  manufacturerId: z.string().optional()
});

const planRunSchema = z.object({
  marketContext: z.string().min(1),
  manufacturerId: z.string().optional()
});

type UploadRequest = Request & { file?: { buffer: Buffer } };

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

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }
});

function normalizeProductLink(input: string) {
  const trimmed = input.trim();
  try {
    const url = new URL(trimmed);
    return `${url.origin}${url.pathname}`.toLowerCase();
  } catch {
    return trimmed.toLowerCase();
  }
}

function formatDateKeyInTimeZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function parsePlanDate(value: unknown): { raw: string; key: string } | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    const raw = `${month}-${day}-${year}`;
    return { raw, key: `${year}-${month}-${day}` };
  }
  const raw = String((value as { text?: string }).text ?? value).trim();
  if (!raw) {
    return null;
  }
  const match = raw.match(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])-(\d{4})$/);
  if (!match) {
    return null;
  }
  const month = match[1];
  const day = match[2];
  const year = match[3];
  return { raw, key: `${year}-${month}-${day}` };
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

function readCellText(cell: { text?: string; value?: unknown }) {
  return String(cell.text ?? cell.value ?? "").trim();
}

runsRouter.get("/plan-template", async (_req, res) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "wayfo";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("Plan");
  sheet.columns = [
    { header: "产品链接", key: "amazonUrl", width: 50 },
    { header: "SKU", key: "sku", width: 20 },
    { header: "Part Number", key: "partNumber", width: 26 },
    { header: "UPC", key: "upc", width: 18 },
    { header: "时间", key: "planDate", width: 18 }
  ];
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  header.height = 22;
  sheet.getColumn(5).numFmt = "mm-dd-yyyy";
  sheet.getRow(2).height = 18;

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader("Content-Disposition", "attachment; filename=\"plan-template.xlsx\"");
  await workbook.xlsx.write(res);
  res.end();
});

runsRouter.post("/plan-import", upload.single("file"), async (req, res) => {
  const parsed = planImportSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "invalid plan import payload"
    });
  }
  const uploadRequest = req as UploadRequest;
  if (!uploadRequest.file) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "file is required"
    });
  }

  const settings = getAppSettings();
  const timezone = settings.timezone ?? "UTC";
  const todayKey = formatDateKeyInTimeZone(new Date(), timezone);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(uploadRequest.file.buffer as Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "empty workbook"
    });
  }

  const headerRow = sheet.getRow(1);
  const headerMap = new Map<string, number>();
  headerRow.eachCell((cell: { text?: string; value?: unknown }, colNumber: number) => {
    const header = readCellText(cell);
    if (header) {
      headerMap.set(header, colNumber);
    }
  });
  const requiredHeaders = ["产品链接", "SKU", "Part Number", "时间"];
  const missingHeaders = requiredHeaders.filter((name) => !headerMap.has(name));
  if (missingHeaders.length > 0) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: `missing headers: ${missingHeaders.join(", ")}`
    });
  }

  deactivateAllPlanItems();

  const errors: Array<{ row: number; message: string }> = [];
  let rowCount = 0;
  let validCount = 0;
  let activatedCount = 0;
  const seenRowHashes = new Set<string>();
  const seenGroupIds = new Set<string>();

  for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const amazonUrl = readCellText(row.getCell(headerMap.get("产品链接")!));
    const sku = readCellText(row.getCell(headerMap.get("SKU")!));
    const partNumber = readCellText(row.getCell(headerMap.get("Part Number")!));
    const upc = headerMap.has("UPC") ? readCellText(row.getCell(headerMap.get("UPC")!)) : "";
    const planDateCell = row.getCell(headerMap.get("时间")!);

    if (!amazonUrl && !sku && !partNumber && !planDateCell.value) {
      continue;
    }
    rowCount += 1;

    if (!amazonUrl) {
      errors.push({ row: rowNumber, message: "产品链接为空" });
      continue;
    }

    const parsedDate = parsePlanDate(planDateCell.value);
    if (!parsedDate) {
      errors.push({ row: rowNumber, message: "时间格式错误，应为 MM-DD-YYYY" });
      continue;
    }
    validCount += 1;

    const rowHash = hashInput({
      amazonUrl,
      sku,
      partNumber,
      upc,
      planDate: parsedDate.key
    });
    if (seenRowHashes.has(rowHash)) {
      continue;
    }
    seenRowHashes.add(rowHash);

    const asin = extractAsin(amazonUrl);
    let group = asin ? getProductGroupByAsin(asin) : null;
    if (!group) {
      const productKey = asin ? `asin:${asin}` : `url:${normalizeProductLink(amazonUrl)}`;
      group = getProductGroupByKey(productKey) ?? createProductGroup({
        productKey,
        primaryAsin: asin ?? null
      });
    }
    if (asin) {
      addProductGroupMembers(group.id, [asin]);
      setProductGroupPrimaryAsin(group.id, asin);
    }

    const isPrimary = !seenGroupIds.has(group.id);
    seenGroupIds.add(group.id);

    const planItem = createPlanItem({
      rowHash,
      groupId: group.id,
      amazonUrl,
      sku: sku || null,
      partNumber: partNumber || null,
      upc: upc || null,
      planDate: parsedDate.key,
      isPrimary
    });
    if (planItem) {
      activatedCount += 1;
    }
  }

  res.json({
    timezone,
    today: todayKey,
    summary: {
      rows: rowCount,
      validRows: validCount,
      activatedRows: activatedCount
    },
    errors
  });
});

runsRouter.post("/plan-run", async (req, res) => {
  const parsed = planRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "marketContext is required"
    });
  }

  const settings = getAppSettings();
  const timezone = settings.timezone ?? "UTC";
  const todayKey = formatDateKeyInTimeZone(new Date(), timezone);
  const planItems = listActivePlanItemsByDate(todayKey);

  let createdRuns = 0;
  let skippedExisting = 0;
  let skippedSecondary = 0;

  for (const item of planItems) {
    if (!item.isPrimary) {
      skippedSecondary += 1;
      continue;
    }
    if (hasRunForGroup(item.groupId)) {
      skippedExisting += 1;
      continue;
    }
    const run = createRun({
      amazonUrl: item.amazonUrl,
      marketContext: parsed.data.marketContext,
      manufacturerId: parsed.data.manufacturerId,
      enumerateVariants: true,
      groupId: item.groupId,
      planItemId: item.id
    });
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
    createdRuns += 1;
  }

  res.json({
    timezone,
    today: todayKey,
    summary: {
      planRows: planItems.length,
      createdRuns,
      skippedExisting,
      skippedSecondary
    }
  });
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
