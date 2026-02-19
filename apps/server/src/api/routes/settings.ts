import { Router } from "express";
import { z } from "zod";
import {
  getAppSettings,
  getHasDataApiKey,
  getHasDataSettingsMeta,
  getOpenAiApiKey,
  getOpenAiSettingsMeta,
  getWayfairActiveSettings,
  getWayfairSettingsAll,
  setAppSettings,
  setHasDataApiKey,
  setOpenAiApiKey,
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
  enumerateVariantsDefault: z.boolean()
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
      message: "enumerateVariantsDefault must be boolean"
    });
  }
  const next = setAppSettings(parsed.data);
  res.json({
    enumerateVariantsDefault: next.enumerateVariantsDefault,
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
