import fs from "fs";
import path from "path";
import { dataRoot, ensureDir } from "../paths";

type CacheEnvelope<T> = {
  updatedAt: string;
  schemaVersion?: string;
  data: T;
};

function cacheDir(kind: string) {
  return path.join(dataRoot, "cache", kind);
}

function cachePath(kind: string, key: string) {
  return path.join(cacheDir(kind), `${key}.json`);
}

function readEnvelope<T>(kind: string, key: string): CacheEnvelope<T> | null {
  const filePath = cachePath(kind, key);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as CacheEnvelope<T>;
}

function writeEnvelope<T>(kind: string, key: string, input: CacheEnvelope<T>) {
  ensureDir(cacheDir(kind));
  fs.writeFileSync(cachePath(kind, key), JSON.stringify(input, null, 2));
}

function isFresh(updatedAt: string, maxAgeDays?: number) {
  if (!maxAgeDays) {
    return true;
  }
  const now = Date.now();
  const ts = new Date(updatedAt).getTime();
  if (!Number.isFinite(ts)) {
    return false;
  }
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return now - ts <= maxAgeMs;
}

export function readTaxonomyCache<T>(key: string, maxAgeDays = 30) {
  const entry = readEnvelope<T>("taxonomy", key);
  if (!entry || !isFresh(entry.updatedAt, maxAgeDays)) {
    return null;
  }
  return entry;
}

export function writeTaxonomyCache<T>(key: string, data: T, schemaVersion?: string) {
  const entry: CacheEnvelope<T> = {
    updatedAt: new Date().toISOString(),
    schemaVersion,
    data
  };
  writeEnvelope("taxonomy", key, entry);
  return entry;
}

export function readVectorStoreCache<T>(key: string, maxAgeDays = 30) {
  const entry = readEnvelope<T>("vectorstore", key);
  if (!entry || !isFresh(entry.updatedAt, maxAgeDays)) {
    return null;
  }
  return entry;
}

export function writeVectorStoreCache<T>(key: string, data: T, schemaVersion?: string) {
  const entry: CacheEnvelope<T> = {
    updatedAt: new Date().toISOString(),
    schemaVersion,
    data
  };
  writeEnvelope("vectorstore", key, entry);
  return entry;
}

export function readBm25Cache<T>(key: string, maxAgeDays = 30) {
  const entry = readEnvelope<T>("bm25", key);
  if (!entry || !isFresh(entry.updatedAt, maxAgeDays)) {
    return null;
  }
  return entry;
}

export function writeBm25Cache<T>(key: string, data: T, schemaVersion?: string) {
  const entry: CacheEnvelope<T> = {
    updatedAt: new Date().toISOString(),
    schemaVersion,
    data
  };
  writeEnvelope("bm25", key, entry);
  return entry;
}
