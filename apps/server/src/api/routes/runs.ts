import { Router, type Request } from "express";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import multer from "multer";
import { z } from "zod";
import {
  RunEvent,
  WayfairAnswer,
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
import { listRunGeneratedImageEntries } from "../../core/images/runGeneratedArtifact";
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
import { getAppSettings, getWayfairActiveSettings } from "../../core/store/settingsStore";
import {
  addProductGroupMembers,
  deactivateAllPlanItems,
  createPlanItem,
  createProductGroup,
  deleteAllPlanItemAnswers,
  getProductGroupByAsin,
  getProductGroupByKey,
  listActivePlanItemsByDate,
  replacePlanItemAnswers,
  setProductGroupPrimaryAsin
} from "../../core/store/planStore";
import { parseMarketContext as parseWayfairMarketContext } from "../../core/wayfair/taxonomyInit";
import { PLAN_BASE_COLUMNS, PLAN_BASE_FIELD_IDS } from "../../core/plan/planExcelConstants";
import {
  parsePlanFieldIdRow,
  readPlanExcelCellText,
  splitPlanCellMultiValues
} from "../../core/plan/planExcelCells";
import { buildPlanTemplateXlsxBuffer } from "../../core/plan/planWorkbook";
import {
  buildMergedQuestionColumnsForClasses,
  type PlanTemplateQuestionColumn
} from "../../core/plan/planTemplateQuestions";
import { startRun, resumeRun, resumeWayfairAfterReview } from "../../orchestrator/orchestrator";
import { extractAsin } from "../../core/amazon/asin";
import {
  AgentModifiersPayloadSchema,
  sanitizeAgentModifiers
} from "../../core/wayfair/agentModifiers";
import { flattenQuestions, normalizeAnswersForPart } from "../../core/wayfair/answerRules";

export const runsRouter = Router();

const createRunSchema = z.object({
  amazonUrl: z.string().min(1),
  marketContext: z.string().optional(),
  manufacturerId: z.string().optional(),
  enumerateVariants: z.boolean().optional(),
  agentModifiers: AgentModifiersPayloadSchema.optional()
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

const planTemplateClassesSchema = z.object({
  marketContext: z.string().min(1),
  classIds: z.array(z.coerce.number().int().positive()).min(1).max(40)
});

const planTemplatePostSchema = planTemplateClassesSchema.extend({
  /** When omitted, include all merged question columns. Empty array = base columns only. */
  questionIds: z.array(z.string().min(1)).max(500).optional()
});

/**
 * Keep only question columns whose fieldId is in questionIds, in the order of questionIds.
 */
function pickQuestionColumnsByIds(
  questionCols: PlanTemplateQuestionColumn[],
  questionIds: string[]
): PlanTemplateQuestionColumn[] {
  if (questionIds.length === 0) {
    return [];
  }
  const order = new Map(questionIds.map((id, i) => [id, i]));
  const idSet = new Set(questionIds);
  return questionCols
    .filter((c) => idSet.has(c.fieldId))
    .sort((a, b) => (order.get(a.fieldId) ?? 0) - (order.get(b.fieldId) ?? 0));
}

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

function parsePlanDate(value: unknown, timeZone: string): { raw: string; key: string } | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    const key = formatDateKeyInTimeZone(value, timeZone);
    const [y, m, d] = key.split("-");
    const raw = `${m}-${d}-${y}`;
    return { raw, key };
  }
  // Excel stores dates as serial numbers (days since 1900-01-01)
  // Use app timezone to format - avoids off-by-one when Excel interprets dates in user's locale
  const num = typeof value === "number" ? value : Number((value as { text?: string }).text ?? value);
  if (Number.isFinite(num) && num >= 1 && num < 300000) {
    const jsDate = new Date((num - 25569) * 86400 * 1000);
    const key = formatDateKeyInTimeZone(jsDate, timeZone);
    const [y, m, d] = key.split("-");
    const raw = `${m}-${d}-${y}`;
    return { raw, key };
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

function readSubmitAnswers(runId: string) {
  const fullPath = path.join(runsRoot, runId, "artifacts", "wayfair", "submit", "answers.json");
  return readJson<unknown>(fullPath);
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

type ReviewAddition = WayfairSubmitProductAdditionsRequest["proposedProductAdditions"][number];
type ReviewPart = ReviewAddition["parts"][number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toWayfairAnswer(value: unknown): WayfairAnswer | null {
  if (!isRecord(value) || typeof value.questionId !== "string") {
    return null;
  }
  const questionId = value.questionId.trim();
  if (!questionId) {
    return null;
  }
  const rawValue = value.value;
  if (typeof rawValue !== "string" && typeof rawValue !== "number") {
    return null;
  }
  const answer: WayfairAnswer = {
    questionId,
    value: String(rawValue)
  };
  if (typeof value.parentRank === "number" && Number.isInteger(value.parentRank)) {
    answer.parentRank = value.parentRank;
  }
  if (typeof value.rank === "number" && Number.isInteger(value.rank)) {
    answer.rank = value.rank;
  }
  return answer;
}

function getSubmittedAdditions(request: Record<string, unknown>) {
  const additions = request.proposedProductAdditions;
  if (!Array.isArray(additions)) {
    return [];
  }
  return additions.filter(isRecord);
}

function getSubmittedParts(addition: Record<string, unknown> | undefined) {
  if (!addition || !Array.isArray(addition.parts)) {
    return [];
  }
  return addition.parts.filter(isRecord);
}

function findSubmittedAddition(
  additions: Record<string, unknown>[],
  baseAddition: ReviewAddition,
  index: number
) {
  const byClassId = additions.find((candidate) => candidate.classId === baseAddition.classId);
  return byClassId ?? additions[index];
}

function findSubmittedPart(parts: Record<string, unknown>[], basePart: ReviewPart, index: number) {
  const bySupplierPartNumber = parts.find(
    (candidate) => candidate.supplierPartNumber === basePart.supplierPartNumber
  );
  return bySupplierPartNumber ?? parts[index];
}

function shouldMergeSparseAnswers(
  submittedPart: Record<string, unknown> | undefined,
  baseAnswers: WayfairAnswer[],
  submittedAnswers: WayfairAnswer[] | null
) {
  if (!submittedPart || submittedAnswers === null) {
    return true;
  }
  const missingCoreFields =
    !Object.prototype.hasOwnProperty.call(submittedPart, "amazonStandardIdentificationNumber") ||
    !Object.prototype.hasOwnProperty.call(submittedPart, "productName") ||
    !Object.prototype.hasOwnProperty.call(submittedPart, "media");
  if (missingCoreFields) {
    return true;
  }
  if (baseAnswers.length < 4) {
    return false;
  }
  return submittedAnswers.length <= Math.max(2, Math.floor(baseAnswers.length / 2));
}

function extractFallbackAnswersByPart(
  baseRequest: WayfairSubmitProductAdditionsRequest,
  rawAnswers: unknown
) {
  const byPart = new Map<string, WayfairAnswer[]>();
  const assignAnswers = (supplierPartNumber: string | undefined, value: unknown) => {
    if (!supplierPartNumber || !isRecord(value) || !isRecord(value.data) || !Array.isArray(value.data.answers)) {
      return;
    }
    const answers = value.data.answers.map(toWayfairAnswer).filter(Boolean) as WayfairAnswer[];
    if (answers.length > 0) {
      byPart.set(supplierPartNumber, answers);
    }
  };

  const firstPartNumber = baseRequest.proposedProductAdditions[0]?.parts[0]?.supplierPartNumber;
  assignAnswers(firstPartNumber, rawAnswers);

  if (isRecord(rawAnswers)) {
    for (const [key, value] of Object.entries(rawAnswers)) {
      assignAnswers(key, value);
    }
  }

  return byPart;
}

function normalizeReviewRequest(
  request: Record<string, unknown>,
  questions: WayfairProductAdditionQuestion[],
  baseRequest?: WayfairSubmitProductAdditionsRequest | null,
  rawAnswers?: unknown
) {
  const questionMap = new Map(flattenQuestions(questions).map((question) => [question.id, question]));
  const touched = new Set<string>();
  let removedAnswers = 0;
  let normalizedAnswers = 0;
  let fixedRanks = 0;
  const fallbackAnswersByPart = baseRequest ? extractFallbackAnswersByPart(baseRequest, rawAnswers) : new Map();

  const normalizeAnswerList = (answers: WayfairAnswer[]) => {
    const normalized = normalizeAnswersForPart(answers, questionMap, touched);
    removedAnswers += normalized.removedAnswers;
    normalizedAnswers += normalized.normalizedAnswers;
    fixedRanks += normalized.fixedRanks;
    return normalized.answers;
  };

  if (!baseRequest) {
    return {
      request,
      summary: {
        removedAnswers,
        normalizedAnswers,
        fixedRanks,
        touchedQuestions: Array.from(touched)
      }
    };
  }

  const submittedAdditions = getSubmittedAdditions(request);
  const nextRequest: WayfairSubmitProductAdditionsRequest = {
    ...baseRequest,
    supplierId:
      typeof request.supplierId === "string" && request.supplierId.trim()
        ? request.supplierId.trim()
        : baseRequest.supplierId,
    ignoreWarnings:
      typeof request.ignoreWarnings === "boolean" ? request.ignoreWarnings : baseRequest.ignoreWarnings,
    rejectAllOnErrors:
      typeof request.rejectAllOnErrors === "boolean"
        ? request.rejectAllOnErrors
        : baseRequest.rejectAllOnErrors,
    proposedProductAdditions: baseRequest.proposedProductAdditions.map((baseAddition, additionIndex) => {
      const submittedAddition = findSubmittedAddition(submittedAdditions, baseAddition, additionIndex);
      const submittedParts = getSubmittedParts(submittedAddition);
      return {
        ...baseAddition,
        ...(submittedAddition ?? {}),
        parts: baseAddition.parts.map((basePart, partIndex) => {
          const submittedPart = findSubmittedPart(submittedParts, basePart, partIndex);
          const submittedAnswers = submittedPart && Array.isArray(submittedPart.answers)
            ? submittedPart.answers.map(toWayfairAnswer).filter(Boolean) as WayfairAnswer[]
            : null;
          const fallbackAnswers = fallbackAnswersByPart.get(basePart.supplierPartNumber) ?? [];
          const baseAnswers =
            fallbackAnswers.length > (basePart.answers?.length ?? 0)
              ? fallbackAnswers
              : (basePart.answers ?? []);
          const mergedAnswers =
            submittedAnswers === null
              ? baseAnswers
              : shouldMergeSparseAnswers(submittedPart, baseAnswers, submittedAnswers)
                ? [
                    ...baseAnswers.filter(
                      (answer: WayfairAnswer) =>
                        !submittedAnswers.some(
                          (candidate: WayfairAnswer) => candidate.questionId === answer.questionId
                        )
                    ),
                    ...submittedAnswers
                  ]
                : submittedAnswers;
          return {
            ...basePart,
            ...(submittedPart ?? {}),
            answers: normalizeAnswerList(mergedAnswers)
          };
        })
      };
    })
  };
  return {
    request: nextRequest,
    summary: {
      removedAnswers,
      normalizedAnswers,
      fixedRanks,
      touchedQuestions: Array.from(touched)
    }
  };
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

runsRouter.get("/plan-preview", (_req, res) => {
  const settings = getAppSettings();
  const timezone = settings.timezone ?? "UTC";
  const todayKey = formatDateKeyInTimeZone(new Date(), timezone);
  const daysBefore = 1;
  const daysAfter = 3;
  const dates: string[] = [];
  for (let i = -daysBefore; i <= daysAfter; i++) {
    dates.push(addDaysToDateKey(todayKey, i));
  }
  const itemsByDate: Record<string, ReturnType<typeof listActivePlanItemsByDate>> = {};
  for (const d of dates) {
    itemsByDate[d] = listActivePlanItemsByDate(d);
  }
  res.json({
    timezone,
    today: todayKey,
    dates,
    itemsByDate
  });
});

/** Base columns only (no Wayfair questions). Prefer POST /plan-template with classIds. */
runsRouter.get("/plan-template", async (_req, res) => {
  try {
    const buf = await buildPlanTemplateXlsxBuffer(PLAN_BASE_COLUMNS);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=\"plan-template.xlsx\"");
    res.send(buf);
  } catch (error) {
    sendError(res, {
      code: "PLAN_TEMPLATE_FAILED",
      message: error instanceof Error ? error.message : "Plan template failed"
    });
  }
});

/**
 * List merged question field ids / display names for selected classIds (for template column picker).
 */
runsRouter.post("/plan-template-fields", async (req, res) => {
  const parsed = planTemplateClassesSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "marketContext and classIds (1–40) are required"
    });
  }

  const settings = getWayfairActiveSettings();
  if (!settings) {
    return sendError(
      res,
      {
        code: "WAYFAIR_NOT_CONFIGURED",
        message: "Wayfair credentials not configured"
      },
      400
    );
  }

  const marketContext = parseWayfairMarketContext(parsed.data.marketContext);
  if (!marketContext) {
    return sendError(
      res,
      {
        code: "INVALID_MARKET_CONTEXT",
        message: "Invalid marketContext"
      },
      400
    );
  }

  try {
    const questionCols = await buildMergedQuestionColumnsForClasses({
      classIds: parsed.data.classIds,
      supplierId: settings.supplierId,
      marketContext,
      credentials: {
        env: settings.env,
        clientId: settings.clientId.trim(),
        clientSecret: settings.clientSecret.trim(),
        audience: settings.audience.trim()
      }
    });
    res.json({
      fields: questionCols.map((c) => ({
        id: c.fieldId,
        displayName: c.displayName
      }))
    });
  } catch (error) {
    sendError(res, {
      code: "PLAN_TEMPLATE_FIELDS_FAILED",
      message: error instanceof Error ? error.message : "Plan template fields failed"
    });
  }
});

/**
 * Build Plan template with merged question columns from selected taxonomy classIds
 * (productAddition.questions per class, deduped by question id).
 */
runsRouter.post("/plan-template", async (req, res) => {
  const parsed = planTemplatePostSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "marketContext and classIds (1–40) are required"
    });
  }

  const settings = getWayfairActiveSettings();
  if (!settings) {
    return sendError(
      res,
      {
        code: "WAYFAIR_NOT_CONFIGURED",
        message: "Wayfair credentials not configured"
      },
      400
    );
  }

  const marketContext = parseWayfairMarketContext(parsed.data.marketContext);
  if (!marketContext) {
    return sendError(
      res,
      {
        code: "INVALID_MARKET_CONTEXT",
        message: "Invalid marketContext"
      },
      400
    );
  }

  try {
    const mergedQuestionCols = await buildMergedQuestionColumnsForClasses({
      classIds: parsed.data.classIds,
      supplierId: settings.supplierId,
      marketContext,
      credentials: {
        env: settings.env,
        clientId: settings.clientId.trim(),
        clientSecret: settings.clientSecret.trim(),
        audience: settings.audience.trim()
      }
    });
    const questionCols =
      parsed.data.questionIds === undefined
        ? mergedQuestionCols
        : pickQuestionColumnsByIds(mergedQuestionCols, parsed.data.questionIds);
    const columns = [...PLAN_BASE_COLUMNS, ...questionCols];
    const buf = await buildPlanTemplateXlsxBuffer(columns);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=\"plan-template.xlsx\"");
    res.send(buf);
  } catch (error) {
    sendError(res, {
      code: "PLAN_TEMPLATE_FAILED",
      message: error instanceof Error ? error.message : "Plan template failed"
    });
  }
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

  const idParse = parsePlanFieldIdRow(sheet);
  if (!idParse.ok) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: idParse.error
    });
  }
  const colByFieldId = idParse.colByFieldId;
  const questionColumns = [...colByFieldId.entries()]
    .filter(([fieldId]) => !PLAN_BASE_FIELD_IDS.has(fieldId))
    .map(([questionId, col]) => ({ questionId, col }));

  deleteAllPlanItemAnswers();
  deactivateAllPlanItems();

  const errors: Array<{ row: number; message: string }> = [];
  let rowCount = 0;
  let validCount = 0;
  let activatedCount = 0;
  const seenRowHashes = new Set<string>();
  const seenGroupIds = new Set<string>();

  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    const amazonUrl = readPlanExcelCellText(row.getCell(colByFieldId.get("amazonUrl")!));
    const sku = readPlanExcelCellText(row.getCell(colByFieldId.get("sku")!));
    const partNumber = readPlanExcelCellText(row.getCell(colByFieldId.get("partNumber")!));
    const upc = colByFieldId.has("upc")
      ? readPlanExcelCellText(row.getCell(colByFieldId.get("upc")!))
      : "";
    const planDateCell = row.getCell(colByFieldId.get("planDate")!);
    const planDateStr = readPlanExcelCellText(planDateCell);
    const planDateRaw = planDateCell.value;
    const hasPlanDateValue =
      planDateStr !== "" ||
      planDateRaw instanceof Date ||
      (typeof planDateRaw === "number" && Number.isFinite(planDateRaw)) ||
      (typeof planDateRaw === "string" && planDateRaw.trim() !== "");

    if (!amazonUrl && !sku && !partNumber && !hasPlanDateValue) {
      continue;
    }
    rowCount += 1;

    if (!amazonUrl) {
      errors.push({ row: rowNumber, message: "产品链接为空" });
      continue;
    }

    const parsedDate = parsePlanDate(planDateCell.value, timezone);
    if (!parsedDate) {
      errors.push({ row: rowNumber, message: "时间格式错误，应为 MM-DD-YYYY" });
      continue;
    }
    validCount += 1;

    const planAnswersForHash = questionColumns
      .map(({ questionId, col }) => ({
        q: questionId,
        v: readPlanExcelCellText(row.getCell(col))
      }))
      .filter((x) => x.v)
      .sort((a, b) => a.q.localeCompare(b.q));

    const rowHash = hashInput({
      amazonUrl,
      sku,
      partNumber,
      upc,
      planDate: parsedDate.key,
      planAnswers: planAnswersForHash
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
      const answerInputs = questionColumns
        .map(({ questionId, col }) => {
          const raw = readPlanExcelCellText(row.getCell(col));
          const values = splitPlanCellMultiValues(raw);
          return { questionId, rawValue: raw, values };
        })
        .filter((a) => a.values.length > 0);
      replacePlanItemAnswers(planItem.id, answerInputs);
      activatedCount += 1;
    }
  }

  const daysBefore = 1;
  const daysAfter = 3;
  const dates: string[] = [];
  for (let i = -daysBefore; i <= daysAfter; i++) {
    dates.push(addDaysToDateKey(todayKey, i));
  }
  const itemsByDate: Record<string, ReturnType<typeof listActivePlanItemsByDate>> = {};
  for (const d of dates) {
    itemsByDate[d] = listActivePlanItemsByDate(d);
  }

  res.json({
    timezone,
    today: todayKey,
    summary: {
      rows: rowCount,
      validRows: validCount,
      activatedRows: activatedCount
    },
    errors,
    dates,
    itemsByDate
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
  const createdRunIds: string[] = [];

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
      enumerateVariants: settings.enumerateVariantsDefault,
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
    createdRunIds.push(run.id);
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
    },
    createdRunIds
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

  const { agentModifiers, ...runFields } = parsed.data;
  const sanitizedModifiers = sanitizeAgentModifiers(agentModifiers);
  const run = createRun({
    ...runFields,
    ...(sanitizedModifiers ? { agentModifiers: sanitizedModifiers } : {})
  });
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
        imageUrl: primaryUrl,
        scrapedImages: imageIndex?.items ?? [],
        generatedImages: listRunGeneratedImageEntries(run.id, product.asin),
        remoteImageUrls: Array.from(
          new Set(
            [...product.images.all, ...product.images.description].filter(
              (u): u is string => typeof u === "string" && u.length > 0
            )
          )
        )
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
  res.json({
    product: cached.product,
    images: imageIndex,
    generatedImages: listRunGeneratedImageEntries(run.id, req.params.asin)
  });
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
  const questions = readQuestionsArtifact(run.id);
  const baseRequest = readSubmitRequest(run.id);
  const rawAnswers = readSubmitAnswers(run.id);
  try {
    const normalized =
      questions && baseRequest
        ? normalizeReviewRequest(
            parsed.data.request,
            questions,
            baseRequest.data as WayfairSubmitProductAdditionsRequest,
            rawAnswers
          )
        : { request: parsed.data.request };
    createArtifact({
      runId: run.id,
      type: "wayfair/submit/draft",
      relativePath: "wayfair/submit/draft.json",
      content: normalized.request
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
  const baseRequest = readSubmitRequest(run.id);
  const rawAnswers = readSubmitAnswers(run.id);
  if (!baseRequest) {
    return sendError(res, {
      code: "REQUEST_NOT_FOUND",
      message: "Wayfair submit request not found"
    }, 404);
  }
  try {
    const normalized = normalizeReviewRequest(
      parsed.data.request,
      questions,
      baseRequest.data as WayfairSubmitProductAdditionsRequest,
      rawAnswers
    );
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
