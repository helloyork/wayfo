import { Router } from "express";
import { z } from "zod";
import {
  getAppSettings,
  getHasDataApiKey,
  getHasDataSettingsMeta,
  getWayfairSettings,
  setAppSettings,
  setHasDataApiKey,
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
  const settings = getWayfairSettings();
  res.json({
    hasCredentials: Boolean(settings?.clientId && settings?.clientSecret),
    maskedClientId: settings?.clientId ? maskApiKey(settings.clientId) : null,
    maskedClientSecret: settings?.clientSecret ? maskApiKey(settings.clientSecret) : null,
    env: settings?.env ?? null,
    audience: settings?.audience ?? null,
    supplierId: settings?.supplierId ?? null,
    updatedAt: settings?.updatedAt ?? null
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
  const settings = parsed.success
    ? parsed.data
    : getWayfairSettings();
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
