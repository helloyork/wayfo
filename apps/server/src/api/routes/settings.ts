import { Router } from "express";
import { z } from "zod";
import {
  getAppSettings,
  getHasDataApiKey,
  getHasDataSettingsMeta,
  getOpenAiApiKey,
  getOpenAiSettingsMeta,
  getR2Settings,
  getR2SettingsMeta,
  getWayfairActiveSettings,
  getWayfairSettingsAll,
  setAppSettings,
  setHasDataApiKey,
  setOpenAiApiKey,
  setR2Settings,
  setWayfairActiveEnv,
  setWayfairSettings
} from "../../core/store/settingsStore";
import { validateHasDataApiKey } from "../../connectors/hasdata";
import { validateWayfairCredentials } from "../../connectors/wayfair";
import { sendError } from "../errors";

export const settingsRouter = Router();

const hasDataKeySchema = z.object({
  apiKey: z.string().min(8)
});

const appSettingsSchema = z.object({
  enumerateVariantsDefault: z.boolean(),
  primaryImageCandidateCount: z.number().int().min(1).max(8)
});

const wayfairSettingsSchema = z.object({
  env: z.enum(["sandbox", "prod"]),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  audience: z.string().min(1),
  supplierId: z.string().min(1)
});

const openAiSettingsSchema = z.object({
  apiKey: z.string().min(1)
});

function maskApiKey(apiKey: string) {
  if (apiKey.length <= 6) {
    return "***";
  }
  return `${apiKey.slice(0, 3)}***${apiKey.slice(-3)}`;
}

settingsRouter.get("/hasdata", (_req, res) => {
  const apiKey = getHasDataApiKey();
  const meta = getHasDataSettingsMeta();
  res.json({
    hasKey: Boolean(apiKey),
    maskedKey: apiKey ? maskApiKey(apiKey) : null,
    updatedAt: meta?.updatedAt ?? null
  });
});

settingsRouter.post("/hasdata", (req, res) => {
  const parsed = hasDataKeySchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "apiKey is required"
    });
  }
  setHasDataApiKey(parsed.data.apiKey.trim());
  res.json({ ok: true });
});

settingsRouter.post("/hasdata/validate", async (req, res) => {
  const parsed = hasDataKeySchema.safeParse(req.body);
  const apiKey = parsed.success ? parsed.data.apiKey.trim() : getHasDataApiKey();
  if (!apiKey) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "apiKey is required"
    });
  }

  try {
    await validateHasDataApiKey(apiKey);
    if (parsed.success) {
      setHasDataApiKey(apiKey);
    }
    res.json({ ok: true });
  } catch (error) {
    sendError(res, {
      code: "HASDATA_VALIDATE_FAILED",
      message: error instanceof Error ? error.message : "HasData validation failed"
    });
  }
});

settingsRouter.get("/openai", (_req, res) => {
  const apiKey = getOpenAiApiKey();
  const meta = getOpenAiSettingsMeta();
  res.json({
    hasKey: Boolean(apiKey),
    maskedKey: apiKey ? maskApiKey(apiKey) : null,
    updatedAt: meta?.updatedAt ?? null
  });
});

settingsRouter.post("/openai", (req, res) => {
  const parsed = openAiSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "apiKey is required"
    });
  }
  setOpenAiApiKey(parsed.data.apiKey.trim());
  res.json({ ok: true });
});

settingsRouter.post("/openai/validate", async (req, res) => {
  const parsed = openAiSettingsSchema.safeParse(req.body);
  const apiKey = parsed.success ? parsed.data.apiKey.trim() : getOpenAiApiKey();
  if (!apiKey) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "apiKey is required"
    });
  }
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      headers: {
        Authorization: `Bearer ${apiKey}`
      }
    });
    if (!response.ok) {
      throw new Error(`OpenAI 验证失败: ${response.status}`);
    }
    if (parsed.success) {
      setOpenAiApiKey(apiKey);
    }
    res.json({ ok: true });
  } catch (error) {
    sendError(res, {
      code: "OPENAI_VALIDATE_FAILED",
      message: error instanceof Error ? error.message : "OpenAI validation failed"
    });
  }
});

settingsRouter.get("/app", (_req, res) => {
  res.json(getAppSettings());
});

settingsRouter.post("/app", (req, res) => {
  const parsed = appSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "enumerateVariantsDefault or primaryImageCandidateCount invalid"
    });
  }
  const next = setAppSettings(parsed.data);
  res.json({
    enumerateVariantsDefault: next.enumerateVariantsDefault,
    primaryImageCandidateCount: next.primaryImageCandidateCount,
    updatedAt: next.updatedAt
  });
});

settingsRouter.get("/wayfair", (_req, res) => {
  const all = getWayfairSettingsAll();
  const active = getWayfairActiveSettings();
  const sandbox = all?.sandbox ?? null;
  const prod = all?.prod ?? null;
  res.json({
    activeEnv: all?.activeEnv ?? null,
    activeHasCredentials: Boolean(active?.clientId && active?.clientSecret),
    sandbox: {
      hasCredentials: Boolean(sandbox?.clientId && sandbox?.clientSecret),
      maskedClientId: sandbox?.clientId ? maskApiKey(sandbox.clientId) : null,
      maskedClientSecret: sandbox?.clientSecret ? maskApiKey(sandbox.clientSecret) : null,
      audience: sandbox?.audience ?? null,
      supplierId: sandbox?.supplierId ?? null,
      updatedAt: sandbox?.updatedAt ?? null
    },
    prod: {
      hasCredentials: Boolean(prod?.clientId && prod?.clientSecret),
      maskedClientId: prod?.clientId ? maskApiKey(prod.clientId) : null,
      maskedClientSecret: prod?.clientSecret ? maskApiKey(prod.clientSecret) : null,
      audience: prod?.audience ?? null,
      supplierId: prod?.supplierId ?? null,
      updatedAt: prod?.updatedAt ?? null
    }
  });
});

const wayfairActiveEnvSchema = z.object({
  activeEnv: z.enum(["sandbox", "prod"])
});

settingsRouter.patch("/wayfair", (req, res) => {
  const parsed = wayfairActiveEnvSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "activeEnv must be 'sandbox' or 'prod'"
    });
  }
  const result = setWayfairActiveEnv(parsed.data.activeEnv);
  if (!result) {
    return sendError(res, {
      code: "WAYFAIR_SETTINGS_MISSING",
      message: "Wayfair settings not configured yet"
    });
  }
  res.json({ activeEnv: result.activeEnv });
});

settingsRouter.post("/wayfair", (req, res) => {
  const parsed = wayfairSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "Wayfair credentials are required"
    });
  }
  setWayfairSettings({
    env: parsed.data.env,
    clientId: parsed.data.clientId.trim(),
    clientSecret: parsed.data.clientSecret.trim(),
    audience: parsed.data.audience.trim(),
    supplierId: parsed.data.supplierId.trim()
  });
  res.json({ ok: true });
});

settingsRouter.post("/wayfair/validate", async (req, res) => {
  const parsed = wayfairSettingsSchema.safeParse(req.body);
  const settings = parsed.success ? parsed.data : getWayfairActiveSettings();
  if (!settings) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "Wayfair credentials are required"
    });
  }

  try {
    const token = await validateWayfairCredentials({
      env: settings.env,
      clientId: settings.clientId.trim(),
      clientSecret: settings.clientSecret.trim(),
      audience: settings.audience.trim()
    });
    if (parsed.success) {
      setWayfairSettings({
        env: settings.env,
        clientId: settings.clientId.trim(),
        clientSecret: settings.clientSecret.trim(),
        audience: settings.audience.trim(),
        supplierId: settings.supplierId.trim()
      });
    }
    res.json({
      ok: true,
      expiresAt: token.expiresAt,
      tokenType: token.tokenType
    });
  } catch (error) {
    sendError(res, {
      code: "WAYFAIR_VALIDATE_FAILED",
      message: error instanceof Error ? error.message : "Wayfair validation failed"
    });
  }
});

const r2SettingsSchema = z.object({
  accountId: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucketName: z.string().min(1),
  publicUrlBase: z.string().min(1),
  lifecycleDays: z.number().int().min(1).max(365).optional()
});

settingsRouter.get("/r2", (_req, res) => {
  const meta = getR2SettingsMeta();
  res.json({
    hasCredentials: meta?.hasCredentials ?? false,
    maskedAccessKeyId: meta?.maskedAccessKeyId ?? null,
    accountId: meta?.accountId ?? null,
    bucketName: meta?.bucketName ?? null,
    publicUrlBase: meta?.publicUrlBase ?? null,
    lifecycleDays: meta?.lifecycleDays ?? 7,
    updatedAt: meta?.updatedAt ?? null
  });
});

settingsRouter.post("/r2", (req, res) => {
  const parsed = r2SettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "R2 credentials are required"
    });
  }
  setR2Settings({
    accountId: parsed.data.accountId,
    accessKeyId: parsed.data.accessKeyId,
    secretAccessKey: parsed.data.secretAccessKey,
    bucketName: parsed.data.bucketName,
    publicUrlBase: parsed.data.publicUrlBase,
    lifecycleDays: parsed.data.lifecycleDays
  });
  res.json({ ok: true });
});

settingsRouter.post("/r2/validate", async (req, res) => {
  const parsed = r2SettingsSchema.safeParse(req.body);
  const settings = parsed.success
    ? parsed.data
    : getR2Settings();
  if (!settings) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "R2 credentials are required"
    });
  }

  try {
    const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey
      },
      region: "auto"
    });

    await client.send(new HeadBucketCommand({ Bucket: settings.bucketName }));

    if (parsed.success) {
      setR2Settings({
        accountId: settings.accountId,
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
        bucketName: settings.bucketName,
        publicUrlBase: settings.publicUrlBase,
        lifecycleDays: settings.lifecycleDays
      });
    }
    res.json({ ok: true, bucket: settings.bucketName });
  } catch (error) {
    sendError(res, {
      code: "R2_VALIDATE_FAILED",
      message: error instanceof Error ? error.message : "R2 validation failed"
    });
  }
});
