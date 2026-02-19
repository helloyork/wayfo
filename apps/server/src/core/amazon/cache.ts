import fs from "fs";
import path from "path";
import { dataRoot, runsRoot, ensureDir } from "../paths";
import type { AmazonProductSnapshot } from "./normalize";
import type { HasDataAmazonProductResponse } from "@wayfo/shared";

type CacheEntry = {
  product: AmazonProductSnapshot;
  raw?: HasDataAmazonProductResponse;
};

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

export function getRunProductPath(runId: string, asin: string) {
  return path.join(
    runsRoot,
    runId,
    "artifacts",
    "amazon",
    "products",
    asin,
    "product.json"
  );
}

export function getRunRawPath(runId: string, asin: string) {
  return path.join(
    runsRoot,
    runId,
    "artifacts",
    "amazon",
    "products",
    asin,
    "provider",
    "raw.json"
  );
}

export type RunImageIndex = {
  generatedAt: string;
  items: Array<{
    url: string;
    fileName: string;
    contentType?: string;
    size?: number;
  }>;
  errors?: Array<{
    url: string;
    message: string;
  }>;
};

export function getRunImagesDir(runId: string, asin: string) {
  return path.join(runsRoot, runId, "artifacts", "amazon", "products", asin, "images");
}

export function getRunImageIndexPath(runId: string, asin: string) {
  return path.join(getRunImagesDir(runId, asin), "index.json");
}

export function getRunImagePath(runId: string, asin: string, fileName: string) {
  return path.join(getRunImagesDir(runId, asin), fileName);
}

export function readRunImageIndex(runId: string, asin: string) {
  return readJson<RunImageIndex>(getRunImageIndexPath(runId, asin));
}

export function readRunCache(runId: string, asin: string): CacheEntry | null {
  const product = readJson<AmazonProductSnapshot>(getRunProductPath(runId, asin));
  if (!product) {
    return null;
  }
  const raw = readJson<HasDataAmazonProductResponse>(getRunRawPath(runId, asin)) ?? undefined;
  return { product, raw };
}

export function readGlobalCache(domain: string, asin: string): CacheEntry | null {
  const baseDir = path.join(dataRoot, "amazon-cache", domain, asin);
  const product = readJson<AmazonProductSnapshot>(path.join(baseDir, "product.json"));
  if (!product) {
    return null;
  }
  const raw = readJson<HasDataAmazonProductResponse>(path.join(baseDir, "raw.json")) ?? undefined;
  return { product, raw };
}

export function writeGlobalCache(domain: string, asin: string, entry: CacheEntry) {
  const baseDir = path.join(dataRoot, "amazon-cache", domain, asin);
  writeJson(path.join(baseDir, "product.json"), entry.product);
  if (entry.raw) {
    writeJson(path.join(baseDir, "raw.json"), entry.raw);
  }
}
