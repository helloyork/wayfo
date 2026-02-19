import fs from "fs";
import path from "path";
import { dataRoot, ensureDir } from "../paths";

type HasDataSettings = {
  apiKey: string;
  updatedAt: string;
};

type AppSettings = {
  enumerateVariantsDefault: boolean;
  updatedAt: string;
};

export type WayfairEnv = "sandbox" | "prod";

type WayfairEnvSettings = {
  clientId: string;
  clientSecret: string;
  audience: string;
  supplierId: string;
  updatedAt: string;
};

type WayfairSettings = {
  activeEnv: WayfairEnv;
  sandbox?: WayfairEnvSettings;
  prod?: WayfairEnvSettings;
  updatedAt: string;
};

type OpenAiSettings = {
  apiKey: string;
  updatedAt: string;
};

const settingsDir = path.join(dataRoot, "settings");
const hasDataSettingsPath = path.join(settingsDir, "hasdata.json");
const appSettingsPath = path.join(settingsDir, "app.json");
const wayfairSettingsPath = path.join(settingsDir, "wayfair.json");
const openAiSettingsPath = path.join(settingsDir, "openai.json");

function normalizeStoredValue(value: string, mode: "trim" | "no-whitespace") {
  const trimmed = value.trim();
  if (mode === "trim") {
    return trimmed;
  }
  return trimmed.replace(/\s+/g, "");
}

function sanitizeWayfairEnvSettings(input: WayfairEnvSettings): WayfairEnvSettings {
  return {
    clientId: normalizeStoredValue(input.clientId, "no-whitespace"),
    clientSecret: normalizeStoredValue(input.clientSecret, "no-whitespace"),
    audience: normalizeStoredValue(input.audience, "trim"),
    supplierId: normalizeStoredValue(input.supplierId, "trim"),
    updatedAt: input.updatedAt
  };
}

function readSettings(): HasDataSettings | null {
  if (!fs.existsSync(hasDataSettingsPath)) {
    return null;
  }
  const raw = fs.readFileSync(hasDataSettingsPath, "utf-8");
  return JSON.parse(raw) as HasDataSettings;
}

function writeSettings(next: HasDataSettings) {
  ensureDir(settingsDir);
  fs.writeFileSync(hasDataSettingsPath, JSON.stringify(next, null, 2));
}

function readAppSettings(): AppSettings | null {
  if (!fs.existsSync(appSettingsPath)) {
    return null;
  }
  const raw = fs.readFileSync(appSettingsPath, "utf-8");
  return JSON.parse(raw) as AppSettings;
}

function writeAppSettings(next: AppSettings) {
  ensureDir(settingsDir);
  fs.writeFileSync(appSettingsPath, JSON.stringify(next, null, 2));
}

function readWayfairSettings(): WayfairSettings | null {
  if (!fs.existsSync(wayfairSettingsPath)) {
    return null;
  }
  const raw = fs.readFileSync(wayfairSettingsPath, "utf-8");
  const parsed = JSON.parse(raw) as unknown;
  const migrated = migrateWayfairSettings(parsed);
  if (migrated.migrated) {
    writeWayfairSettings(migrated.value!);
  }
  return migrated.value;
}

function writeWayfairSettings(next: WayfairSettings) {
  ensureDir(settingsDir);
  fs.writeFileSync(wayfairSettingsPath, JSON.stringify(next, null, 2));
}

function migrateWayfairSettings(input: unknown): { value: WayfairSettings | null; migrated: boolean } {
  if (!input || typeof input !== "object") {
    return { value: null, migrated: false };
  }
  const anyInput = input as Record<string, unknown>;

  // Legacy format (single env).
  if (
    typeof anyInput.env === "string" &&
    typeof anyInput.clientId === "string" &&
    typeof anyInput.clientSecret === "string" &&
    typeof anyInput.audience === "string" &&
    typeof anyInput.supplierId === "string"
  ) {
    const env = anyInput.env === "prod" ? "prod" : "sandbox";
    const now = typeof anyInput.updatedAt === "string" ? anyInput.updatedAt : new Date().toISOString();
    const envSettings: WayfairEnvSettings = {
      clientId: String(anyInput.clientId),
      clientSecret: String(anyInput.clientSecret),
      audience: String(anyInput.audience),
      supplierId: String(anyInput.supplierId),
      updatedAt: now
    };
    const next: WayfairSettings = {
      activeEnv: env,
      sandbox: env === "sandbox" ? sanitizeWayfairEnvSettings(envSettings) : undefined,
      prod: env === "prod" ? sanitizeWayfairEnvSettings(envSettings) : undefined,
      updatedAt: now
    };
    return { value: next, migrated: true };
  }

  // New format.
  if (typeof anyInput.activeEnv === "string" && (anyInput.activeEnv === "sandbox" || anyInput.activeEnv === "prod")) {
    const updatedAt = typeof anyInput.updatedAt === "string" ? anyInput.updatedAt : new Date().toISOString();
    const sandbox = normalizeWayfairEnvSettings(anyInput.sandbox);
    const prod = normalizeWayfairEnvSettings(anyInput.prod);
    return {
      value: {
        activeEnv: anyInput.activeEnv,
        sandbox: sandbox ?? undefined,
        prod: prod ?? undefined,
        updatedAt
      },
      migrated: false
    };
  }

  return { value: null, migrated: false };
}

function normalizeWayfairEnvSettings(input: unknown): WayfairEnvSettings | null {
  if (!input || typeof input !== "object") {
    return null;
  }
  const obj = input as Record<string, unknown>;
  if (
    typeof obj.clientId !== "string" ||
    typeof obj.clientSecret !== "string" ||
    typeof obj.audience !== "string" ||
    typeof obj.supplierId !== "string"
  ) {
    return null;
  }
  const updatedAt = typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString();
  return sanitizeWayfairEnvSettings({
    clientId: obj.clientId,
    clientSecret: obj.clientSecret,
    audience: obj.audience,
    supplierId: obj.supplierId,
    updatedAt
  });
}

function readOpenAiSettings(): OpenAiSettings | null {
  if (!fs.existsSync(openAiSettingsPath)) {
    return null;
  }
  const raw = fs.readFileSync(openAiSettingsPath, "utf-8");
  return JSON.parse(raw) as OpenAiSettings;
}

function writeOpenAiSettings(next: OpenAiSettings) {
  ensureDir(settingsDir);
  fs.writeFileSync(openAiSettingsPath, JSON.stringify(next, null, 2));
}

export function getHasDataApiKey() {
  return readSettings()?.apiKey ?? null;
}

export function getHasDataSettingsMeta() {
  const settings = readSettings();
  if (!settings) {
    return null;
  }
  return {
    updatedAt: settings.updatedAt
  };
}

export function setHasDataApiKey(apiKey: string) {
  const next: HasDataSettings = {
    apiKey,
    updatedAt: new Date().toISOString()
  };
  writeSettings(next);
  return next;
}

export function getAppSettings() {
  const settings = readAppSettings();
  return {
    enumerateVariantsDefault: settings?.enumerateVariantsDefault ?? false,
    updatedAt: settings?.updatedAt ?? null
  };
}

export function setAppSettings(input: { enumerateVariantsDefault: boolean }) {
  const next: AppSettings = {
    enumerateVariantsDefault: input.enumerateVariantsDefault,
    updatedAt: new Date().toISOString()
  };
  writeAppSettings(next);
  return next;
}

export function getWayfairSettingsAll() {
  return readWayfairSettings();
}

export function getWayfairActiveSettings() {
  const all = readWayfairSettings();
  if (!all) {
    return null;
  }
  const env = all.activeEnv;
  const settings = env === "sandbox" ? all.sandbox : all.prod;
  if (!settings) {
    return null;
  }
  return { env, ...settings };
}

export function setWayfairSettings(input: {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
  supplierId: string;
}) {
  const previous = readWayfairSettings();
  const now = new Date().toISOString();
  const nextEnvSettings: WayfairEnvSettings = {
    clientId: normalizeStoredValue(input.clientId, "no-whitespace"),
    clientSecret: normalizeStoredValue(input.clientSecret, "no-whitespace"),
    audience: normalizeStoredValue(input.audience, "trim"),
    supplierId: normalizeStoredValue(input.supplierId, "trim"),
    updatedAt: now
  };
  const next: WayfairSettings = {
    activeEnv: input.env,
    sandbox: input.env === "sandbox" ? nextEnvSettings : previous?.sandbox,
    prod: input.env === "prod" ? nextEnvSettings : previous?.prod,
    updatedAt: now
  };
  writeWayfairSettings(next);
  return next;
}

export function getOpenAiApiKey() {
  return readOpenAiSettings()?.apiKey ?? null;
}

export function getOpenAiSettingsMeta() {
  const settings = readOpenAiSettings();
  if (!settings) {
    return null;
  }
  return {
    updatedAt: settings.updatedAt
  };
}

export function setOpenAiApiKey(apiKey: string) {
  const next: OpenAiSettings = {
    apiKey,
    updatedAt: new Date().toISOString()
  };
  writeOpenAiSettings(next);
  return next;
}
