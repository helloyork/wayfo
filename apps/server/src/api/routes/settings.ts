import { Router } from "express";
import { z } from "zod";
import {
  getAppSettings,
  getHasDataApiKey,
  getHasDataSettingsMeta,
  setAppSettings,
  setHasDataApiKey
} from "../../core/store/settingsStore";
import { validateHasDataApiKey } from "../../connectors/hasdata";

export const settingsRouter = Router();

const hasDataKeySchema = z.object({
  apiKey: z.string().min(8)
});

const appSettingsSchema = z.object({
  enumerateVariantsDefault: z.boolean()
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
    res.status(400).json({ message: "apiKey is required" });
    return;
  }
  setHasDataApiKey(parsed.data.apiKey.trim());
  res.json({ ok: true });
});

settingsRouter.post("/hasdata/validate", async (req, res) => {
  const parsed = hasDataKeySchema.safeParse(req.body);
  const apiKey = parsed.success ? parsed.data.apiKey.trim() : getHasDataApiKey();
  if (!apiKey) {
    res.status(400).json({ message: "apiKey is required" });
    return;
  }

  try {
    await validateHasDataApiKey(apiKey);
    if (parsed.success) {
      setHasDataApiKey(apiKey);
    }
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({
      ok: false,
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
    res.status(400).json({ message: "enumerateVariantsDefault must be boolean" });
    return;
  }
  const next = setAppSettings(parsed.data);
  res.json({
    enumerateVariantsDefault: next.enumerateVariantsDefault,
    updatedAt: next.updatedAt
  });
});
