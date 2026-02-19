import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { ensureDir } from "../paths";
import {
  getRunImagesDir,
  getRunImageIndexPath,
  readRunImageIndex,
  type RunImageIndex
} from "../amazon/cache";

type DownloadedImage = {
  url: string;
  fileName: string;
  contentType?: string;
  size?: number;
};

type DownloadError = {
  url: string;
  message: string;
};


function normalizeExtension(input?: string) {
  if (!input) {
    return "";
  }
  const ext = input.startsWith(".") ? input : `.${input}`;
  if (ext.length > 6) {
    return "";
  }
  return ext.toLowerCase();
}

function extensionFromContentType(contentType?: string) {
  if (!contentType) {
    return "";
  }
  const normalized = contentType.split(";")[0].trim().toLowerCase();
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/bmp": ".bmp"
  };
  return map[normalized] ?? "";
}

function extensionFromUrl(url: string) {
  try {
    const ext = path.extname(new URL(url).pathname);
    return normalizeExtension(ext);
  } catch {
    return "";
  }
}

function buildFileName(url: string, contentType?: string) {
  const hash = createHash("sha1").update(url).digest("hex");
  const ext = extensionFromContentType(contentType) || extensionFromUrl(url) || ".img";
  return `${hash}${ext}`;
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<R>
) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const concurrency = Math.max(1, limit);
  const workers = new Array(Math.min(concurrency, items.length)).fill(null).map(async () => {
    while (cursor < items.length) {
      const current = cursor;
      cursor += 1;
      results[current] = await handler(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function downloadOne(url: string, targetDir: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? undefined;
  const fileName = buildFileName(url, contentType);
  const filePath = path.join(targetDir, fileName);
  if (!fs.existsSync(filePath)) {
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
    return { url, fileName, contentType, size: buffer.length };
  }
  const stats = fs.statSync(filePath);
  return { url, fileName, contentType, size: stats.size };
}

export async function downloadProductImages(input: {
  runId: string;
  asin: string;
  urls: string[];
  concurrency: number;
}): Promise<RunImageIndex | null> {
  const uniqueUrls = Array.from(
    new Set(input.urls.filter((url) => typeof url === "string" && url.length > 0))
  );
  if (uniqueUrls.length === 0) {
    return null;
  }

  const existingIndex = readRunImageIndex(input.runId, input.asin);
  const existingMap = new Map(
    existingIndex?.items.map((item) => [item.url, item]) ?? []
  );

  const pending = uniqueUrls.filter((url) => !existingMap.has(url));
  const results: DownloadedImage[] = existingIndex?.items ?? [];
  const errors: DownloadError[] = existingIndex?.errors ?? [];

  if (pending.length === 0) {
    return {
      generatedAt: existingIndex?.generatedAt ?? new Date().toISOString(),
      items: results,
      errors: errors.length ? errors : undefined
    };
  }

  const targetDir = getRunImagesDir(input.runId, input.asin);
  ensureDir(targetDir);

  const downloaded = await runWithConcurrency(pending, input.concurrency, async (url) => {
    try {
      const item = await downloadOne(url, targetDir);
      return { item };
    } catch (error) {
      return {
        error: {
          url,
          message: error instanceof Error ? error.message : String(error)
        }
      };
    }
  });

  for (const entry of downloaded) {
    if ("item" in entry) {
      results.push(entry.item);
    } else if (entry.error) {
      errors.push(entry.error);
    }
  }

  const nextIndex: RunImageIndex = {
    generatedAt: new Date().toISOString(),
    items: results,
    errors: errors.length ? errors : undefined
  };

  ensureDir(getRunImagesDir(input.runId, input.asin));
  fs.writeFileSync(getRunImageIndexPath(input.runId, input.asin), JSON.stringify(nextIndex, null, 2));
  return nextIndex;
}
