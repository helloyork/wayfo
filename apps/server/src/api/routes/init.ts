import { Router } from "express";
import { z } from "zod";
import type { WayfairBrandInput, WayfairCountryInput } from "@wayfo/shared";
import { sendError } from "../errors";
import { getWayfairActiveSettings } from "../../core/store/settingsStore";
import { getWayfairPoolId } from "../../core/config";
import {
  getTaxonomyCacheRootDir,
  initializeTaxonomyCacheNow,
  isTaxonomyCacheVersionReady,
  parseMarketContext,
  type TaxonomyInitPhase,
  type TaxonomyInitProgress
} from "../../core/wayfair/taxonomyInit";
import fs from "fs";
import path from "path";
import { createHash } from "crypto";

export const initRouter = Router();

type TaskStatus = "IDLE" | "RUNNING" | "SUCCEEDED" | "FAILED";

type InitTaskState = {
  key: string;
  status: TaskStatus;
  phase?: TaxonomyInitPhase;
  message?: string;
  page?: number;
  totalPages?: number;
  startedAt?: string;
  updatedAt?: string;
  error?: string;
};

const tasks = new Map<string, InitTaskState>();

const marketContextSchema = z.union([
  z.string(),
  z.object({
    locale: z.string(),
    country: z.string(),
    brand: z.string()
  })
]);

function normalizeMarketContext(input: unknown) {
  if (typeof input === "string") {
    return parseMarketContext(input);
  }
  if (input && typeof input === "object") {
    const obj = input as { locale?: string; country?: string; brand?: string };
    if (obj.locale && obj.country && obj.brand) {
      return {
        locale: obj.locale,
        country: obj.country as WayfairCountryInput,
        brand: obj.brand as WayfairBrandInput
      };
    }
  }
  return null;
}

function readTaxonomyMeta(root: string) {
  const metaPath = path.join(root, "meta.json");
  if (!fs.existsSync(metaPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(metaPath, "utf-8")) as {
    expiresAt?: string;
    activeVersion?: string;
    refreshing?: boolean;
    lastRefreshError?: string;
  };
}

function isExpired(expiresAt?: string) {
  if (!expiresAt) {
    return true;
  }
  const ts = new Date(expiresAt).getTime();
  if (!Number.isFinite(ts)) {
    return true;
  }
  return Date.now() > ts;
}

function getTaskKey(input: { env: string; poolId: string; marketContextHash: string }) {
  return `${input.env}:${input.poolId}:${input.marketContextHash}`;
}

initRouter.get("/status", (req, res) => {
  const wayfair = getWayfairActiveSettings();
  const wayfairReady = Boolean(wayfair?.clientId && wayfair?.clientSecret && wayfair?.audience);

  const parsed = marketContextSchema.safeParse(req.query.marketContext);
  const marketContext = parsed.success ? normalizeMarketContext(parsed.data) : null;
  if (!marketContext) {
    return res.json({
      ready: false,
      prerequisites: { wayfair: wayfairReady },
      activeEnv: wayfair?.env ?? null,
      marketContextValid: false,
      taxonomy: { state: "MISSING" as const },
      task: null
    });
  }

  const poolId = getWayfairPoolId();
  const env = wayfair?.env ?? "sandbox";
  const root = getTaxonomyCacheRootDir({ env, poolId, marketContext });
  const meta = readTaxonomyMeta(root);
  const version = meta?.activeVersion ? path.join(root, "versions", meta.activeVersion) : null;
  const ready = Boolean(version && fs.existsSync(version) && isTaxonomyCacheVersionReady(version));

  const taskKey = getTaskKey({
    env,
    poolId,
    marketContextHash: createMarketContextHash(marketContext)
  });
  const task = tasks.get(taskKey) ?? null;

  const expired = meta?.expiresAt ? isExpired(meta.expiresAt) : true;
  const state = ready
    ? task?.status === "RUNNING"
      ? "BUILDING"
      : meta?.refreshing
        ? "REFRESHING"
        : expired
          ? "STALE"
          : "READY"
    : task?.status === "RUNNING"
      ? "BUILDING"
      : "MISSING";

  return res.json({
    ready: ready,
    prerequisites: { wayfair: wayfairReady },
    activeEnv: wayfair?.env ?? null,
    marketContextValid: true,
    taxonomy: {
      state,
      expiresAt: meta?.expiresAt ?? null,
      lastRefreshError: meta?.lastRefreshError ?? null
    },
    task
  });
});

initRouter.post("/taxonomy", async (req, res) => {
  const wayfair = getWayfairActiveSettings();
  const wayfairReady = Boolean(wayfair?.clientId && wayfair?.clientSecret && wayfair?.audience);
  if (!wayfairReady || !wayfair) {
    return sendError(res, {
      code: "INIT_PREREQUISITES_MISSING",
      message: "初始化前置条件未满足：请先配置 Wayfair 凭据"
    });
  }

  const parsedBody = z
    .object({
      marketContext: marketContextSchema
    })
    .safeParse(req.body);
  if (!parsedBody.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "marketContext is required"
    });
  }
  const marketContext = normalizeMarketContext(parsedBody.data.marketContext);
  if (!marketContext) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message:
        'marketContext 格式不正确，请使用 {"locale":"en-US","country":"UNITED_STATES","brand":"WAYFAIR"}'
    });
  }

  const poolId = getWayfairPoolId();
  const env = wayfair.env;
  const root = getTaxonomyCacheRootDir({ env, poolId, marketContext });
  const meta = readTaxonomyMeta(root);
  const version = meta?.activeVersion ? path.join(root, "versions", meta.activeVersion) : null;
  const cacheReady = Boolean(version && fs.existsSync(version) && isTaxonomyCacheVersionReady(version));
  if (cacheReady) {
    return res.json({
      ok: true,
      status: "ALREADY_READY"
    });
  }

  const taskKey = getTaskKey({
    env,
    poolId,
    marketContextHash: createMarketContextHash(marketContext)
  });
  const existing = tasks.get(taskKey);
  if (existing?.status === "RUNNING") {
    return res.json({ ok: true, task: existing });
  }

  const state: InitTaskState = {
    key: taskKey,
    status: "RUNNING",
    phase: "FETCHING_TAXONOMY",
    message: "准备开始初始化...",
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  tasks.set(taskKey, state);

  const update = (progress: TaxonomyInitProgress) => {
    const current = tasks.get(taskKey);
    if (!current) {
      return;
    }
    tasks.set(taskKey, {
      ...current,
      phase: progress.phase,
      message: progress.message,
      page: progress.page,
      totalPages: progress.totalPages,
      updatedAt: new Date().toISOString()
    });
  };

  void (async () => {
    try {
      await initializeTaxonomyCacheNow({
        poolId,
        marketContext,
        credentials: {
          env,
          clientId: wayfair.clientId,
          clientSecret: wayfair.clientSecret,
          audience: wayfair.audience
        },
        onProgress: update
      });
      const done = tasks.get(taskKey);
      if (done) {
        tasks.set(taskKey, {
          ...done,
          status: "SUCCEEDED",
          phase: "FINALIZING",
          message: "初始化完成",
          updatedAt: new Date().toISOString()
        });
      }
    } catch (error) {
      const failed = tasks.get(taskKey);
      if (failed) {
        tasks.set(taskKey, {
          ...failed,
          status: "FAILED",
          error: error instanceof Error ? error.message : String(error),
          message: "初始化失败",
          updatedAt: new Date().toISOString()
        });
      }
    }
  })();

  return res.json({ ok: true, task: state });
});

initRouter.get("/progress", (req, res) => {
  const parsed = marketContextSchema.safeParse(req.query.marketContext);
  const marketContext = parsed.success ? normalizeMarketContext(parsed.data) : null;
  const wayfair = getWayfairActiveSettings();
  const poolId = getWayfairPoolId();
  const env = wayfair?.env ?? "sandbox";
  if (!marketContext) {
    return res.json({ task: null });
  }
  const taskKey = getTaskKey({
    env,
    poolId,
    marketContextHash: createMarketContextHash(marketContext)
  });
  res.json({ task: tasks.get(taskKey) ?? null });
});

function createMarketContextHash(marketContext: { locale: string; country: string; brand: string }) {
  return createHash("sha256")
    .update(JSON.stringify(marketContext))
    .digest("hex");
}

