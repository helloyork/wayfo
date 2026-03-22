import { Router } from "express";
import { z } from "zod";
import { OPENAI_IMAGE_MODEL_OPTIONS, isValidOpenAiImageModel } from "../../core/openaiImageModel";
import {
  getAppSettings,
  getHasDataApiKey,
  getHasDataSettingsMeta,
  getOpenAiApiKey,
  getOpenAiImageModel,
  getOpenAiSettingsMeta,
  getR2Settings,
  getR2SettingsMeta,
  getWayfairActiveSettings,
  getWayfairSettingsAll,
  setAppSettings,
  setHasDataApiKey,
  setOpenAiApiKey,
  setOpenAiImageModel,
  setR2Settings,
  setWayfairActiveEnv,
  setWayfairSettings
} from "../../core/store/settingsStore";
import { validateHasDataApiKey } from "../../connectors/hasdata";
import { validateWayfairCredentials } from "../../connectors/wayfair";
import {
  AgentModifiersPayloadSchema,
  sanitizeAgentModifiers
} from "../../core/wayfair/agentModifiers";
import { sendError } from "../errors";

export const settingsRouter = Router();

const hasDataKeySchema = z.object({
  apiKey: z.string().min(8)
});

const appSettingsSchema = z.object({
  enumerateVariantsDefault: z.boolean(),
  primaryImageCandidateCount: z.number().int().min(1).max(8),
  timezone: z.string().min(1),
  agentModifiers: AgentModifiersPayloadSchema.optional()
});

const wayfairSettingsSchema = z.object({
  env: z.enum(["sandbox", "prod"]),
  clientId: z.string().min(1).optional(),
  clientSecret: z.string().min(1).optional(),
  audience: z.string().min(1),
  supplierId: z.string().min(1)
});

const openAiSettingsSchema = z.object({
  apiKey: z.string().min(1),
  imageModel: z.string().min(1).max(80).optional()
});

const openAiImageModelPatchSchema = z.object({
  imageModel: z.string().min(1).max(80)
});

function maskApiKey(apiKey: string) {
  if (apiKey.length <= 6) {
    return "***";
  }
  return `${apiKey.slice(0, 3)}***${apiKey.slice(-3)}`;
}

function hasPartialPair(value?: string, other?: string) {
  return Boolean(value?.trim()) !== Boolean(other?.trim());
}

function resolveWayfairCredentials(
  env: "sandbox" | "prod",
  input: { clientId?: string; clientSecret?: string; audience: string; supplierId: string }
) {
  const previous = getWayfairSettingsAll();
  const previousEnv = env === "sandbox" ? previous?.sandbox : previous?.prod;
  const clientId = input.clientId?.trim() || previousEnv?.clientId;
  const clientSecret = input.clientSecret?.trim() || previousEnv?.clientSecret;
  return { clientId, clientSecret };
}

function resolveR2Credentials(input: { accessKeyId?: string; secretAccessKey?: string }) {
  const previous = getR2Settings();
  const accessKeyId = input.accessKeyId?.trim() || previous?.accessKeyId;
  const secretAccessKey = input.secretAccessKey?.trim() || previous?.secretAccessKey;
  return { accessKeyId, secretAccessKey };
}

function isValidTimeZone(timezone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return true;
  } catch {
    return false;
  }
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
    updatedAt: meta?.updatedAt ?? null,
    imageModel: getOpenAiImageModel(),
    imageModelOptions: OPENAI_IMAGE_MODEL_OPTIONS.map((o) => ({ id: o.id, label: o.label }))
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
  if (parsed.data.imageModel !== undefined && !isValidOpenAiImageModel(parsed.data.imageModel)) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "imageModel is not a supported OpenAI image model"
    });
  }
  try {
    setOpenAiApiKey(
      parsed.data.apiKey.trim(),
      parsed.data.imageModel !== undefined ? parsed.data.imageModel.trim() : undefined
    );
  } catch (error) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: error instanceof Error ? error.message : "OpenAI settings invalid"
    });
  }
  res.json({ ok: true, imageModel: getOpenAiImageModel() });
});

settingsRouter.patch("/openai", (req, res) => {
  const parsed = openAiImageModelPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "imageModel is required"
    });
  }
  if (!isValidOpenAiImageModel(parsed.data.imageModel)) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "imageModel is not a supported OpenAI image model"
    });
  }
  try {
    setOpenAiImageModel(parsed.data.imageModel.trim());
  } catch (error) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: error instanceof Error ? error.message : "Failed to save image model"
    });
  }
  res.json({ ok: true, imageModel: getOpenAiImageModel() });
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
      message: "enumerateVariantsDefault, primaryImageCandidateCount, or timezone invalid"
    });
  }
  if (!isValidTimeZone(parsed.data.timezone)) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "timezone invalid"
    });
  }
  const hadAgentModifiers =
    req.body &&
    typeof req.body === "object" &&
    !Array.isArray(req.body) &&
    "agentModifiers" in req.body;
  const sanitizedModifiers =
    hadAgentModifiers && parsed.data.agentModifiers !== undefined
      ? sanitizeAgentModifiers(parsed.data.agentModifiers) ?? undefined
      : undefined;
  const next = setAppSettings({
    enumerateVariantsDefault: parsed.data.enumerateVariantsDefault,
    primaryImageCandidateCount: parsed.data.primaryImageCandidateCount,
    timezone: parsed.data.timezone,
    agentModifiers: hadAgentModifiers ? sanitizedModifiers : undefined,
    replaceAgentModifiers: hadAgentModifiers
  });
  res.json({
    enumerateVariantsDefault: next.enumerateVariantsDefault,
    primaryImageCandidateCount: next.primaryImageCandidateCount,
    timezone: next.timezone,
    agentModifiers: next.agentModifiers,
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
  if (hasPartialPair(parsed.data.clientId, parsed.data.clientSecret)) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "clientId 与 clientSecret 需要同时填写"
    });
  }
  const resolved = resolveWayfairCredentials(parsed.data.env, parsed.data);
  if (!resolved.clientId || !resolved.clientSecret) {
    return sendError(res, {
      code: "WAYFAIR_SETTINGS_MISSING",
      message: "Wayfair 凭据缺失，请补全 clientId 与 clientSecret"
    });
  }
  setWayfairSettings({
    env: parsed.data.env,
    clientId: resolved.clientId,
    clientSecret: resolved.clientSecret,
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
  if (parsed.success && hasPartialPair(settings.clientId, settings.clientSecret)) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "clientId 与 clientSecret 需要同时填写"
    });
  }
  const resolved = parsed.success
    ? resolveWayfairCredentials(settings.env, settings)
    : { clientId: settings.clientId, clientSecret: settings.clientSecret };
  if (!resolved.clientId || !resolved.clientSecret) {
    return sendError(res, {
      code: "WAYFAIR_SETTINGS_MISSING",
      message: "Wayfair 凭据缺失，请补全 clientId 与 clientSecret"
    });
  }

  try {
    const token = await validateWayfairCredentials({
      env: settings.env,
      clientId: resolved.clientId.trim(),
      clientSecret: resolved.clientSecret.trim(),
      audience: settings.audience.trim()
    });
    if (parsed.success) {
      setWayfairSettings({
        env: settings.env,
        clientId: resolved.clientId.trim(),
        clientSecret: resolved.clientSecret.trim(),
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
  accessKeyId: z.string().min(1).optional(),
  secretAccessKey: z.string().min(1).optional(),
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
  if (hasPartialPair(parsed.data.accessKeyId, parsed.data.secretAccessKey)) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "accessKeyId 与 secretAccessKey 需要同时填写"
    });
  }
  const resolved = resolveR2Credentials(parsed.data);
  if (!resolved.accessKeyId || !resolved.secretAccessKey) {
    return sendError(res, {
      code: "R2_SETTINGS_MISSING",
      message: "R2 凭据缺失，请补全 accessKeyId 与 secretAccessKey"
    });
  }
  setR2Settings({
    accountId: parsed.data.accountId,
    accessKeyId: resolved.accessKeyId,
    secretAccessKey: resolved.secretAccessKey,
    bucketName: parsed.data.bucketName,
    publicUrlBase: parsed.data.publicUrlBase,
    lifecycleDays: parsed.data.lifecycleDays
  });
  res.json({ ok: true });
});

settingsRouter.post("/r2/validate", async (req, res) => {
  const parsed = r2SettingsSchema.safeParse(req.body);
  const settings = parsed.success ? parsed.data : getR2Settings();
  if (!settings) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "R2 credentials are required"
    });
  }
  if (parsed.success && hasPartialPair(settings.accessKeyId, settings.secretAccessKey)) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "accessKeyId 与 secretAccessKey 需要同时填写"
    });
  }
  const resolved = parsed.success
    ? resolveR2Credentials(settings)
    : { accessKeyId: settings.accessKeyId, secretAccessKey: settings.secretAccessKey };
  if (!resolved.accessKeyId || !resolved.secretAccessKey) {
    return sendError(res, {
      code: "R2_SETTINGS_MISSING",
      message: "R2 凭据缺失，请补全 accessKeyId 与 secretAccessKey"
    });
  }

  try {
    const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
    const client = new S3Client({
      endpoint: `https://${settings.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: resolved.accessKeyId,
        secretAccessKey: resolved.secretAccessKey
      },
      region: "auto"
    });

    await client.send(new HeadBucketCommand({ Bucket: settings.bucketName }));

    if (parsed.success) {
      setR2Settings({
        accountId: settings.accountId,
        accessKeyId: resolved.accessKeyId,
        secretAccessKey: resolved.secretAccessKey,
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
