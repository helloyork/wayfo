import fs from "fs";
import path from "path";
import { dataRoot, ensureDir } from "../paths";

type HasDataSettings = {
  apiKey: string;
  updatedAt: string;
};

const settingsDir = path.join(dataRoot, "settings");
const hasDataSettingsPath = path.join(settingsDir, "hasdata.json");

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
