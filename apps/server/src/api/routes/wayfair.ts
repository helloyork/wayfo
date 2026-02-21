import { Router } from "express";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { WayfairMarketContextInput, WayfairSupplierBrandAssociation } from "@wayfo/shared";
import { sendError } from "../errors";
import { getWayfairActiveSettings } from "../../core/store/settingsStore";
import { fetchWayfairBrandAssociations } from "../../core/wayfair/discovery";
import { dataRoot } from "../../core/paths";

export const wayfairRouter = Router();

const brandsQuerySchema = z.object({
  marketContext: z.string().optional()
});

function getCacheDir() {
  return path.join(dataRoot, "cache", "wayfair", "brands");
}

function getCachePath(env: string, supplierId: string, marketContextHash: string) {
  return path.join(getCacheDir(), `${env}-${supplierId}-${marketContextHash}.json`);
}

function hashMarketContext(marketContext: WayfairMarketContextInput) {
  const str = JSON.stringify(marketContext);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

type BrandsCache = {
  brands: WayfairSupplierBrandAssociation[];
  fetchedAt: string;
  expiresAt: string;
};

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

function readBrandsCache(cachePath: string): BrandsCache | null {
  if (!fs.existsSync(cachePath)) {
    return null;
  }
  try {
    const raw = fs.readFileSync(cachePath, "utf-8");
    const parsed = JSON.parse(raw) as BrandsCache;
    if (new Date(parsed.expiresAt) < new Date()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeBrandsCache(cachePath: string, brands: WayfairSupplierBrandAssociation[]) {
  const dir = path.dirname(cachePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const now = new Date();
  const cache: BrandsCache = {
    brands,
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CACHE_DURATION_MS).toISOString()
  };
  fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2));
}

function parseMarketContext(raw: string | undefined): WayfairMarketContextInput | null {
  if (!raw) {
    return {
      locale: "en-US",
      country: "UNITED_STATES",
      brand: "WAYFAIR"
    };
  }
  try {
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof parsed.locale === "string" &&
      typeof parsed.country === "string" &&
      typeof parsed.brand === "string"
    ) {
      return parsed as WayfairMarketContextInput;
    }
    return null;
  } catch {
    return null;
  }
}

wayfairRouter.get("/brands", async (req, res) => {
  const settings = getWayfairActiveSettings();
  if (!settings) {
    return sendError(res, {
      code: "WAYFAIR_NOT_CONFIGURED",
      message: "Wayfair credentials not configured"
    }, 400);
  }

  const parsed = brandsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "Invalid query parameters"
    });
  }

  const marketContext = parseMarketContext(parsed.data.marketContext);
  if (!marketContext) {
    return sendError(res, {
      code: "INVALID_MARKET_CONTEXT",
      message: "Invalid marketContext format"
    });
  }

  const marketContextHash = hashMarketContext(marketContext);
  const cachePath = getCachePath(settings.env, settings.supplierId, marketContextHash);
  const cached = readBrandsCache(cachePath);

  if (cached) {
    return res.json({
      brands: cached.brands,
      cached: true,
      fetchedAt: cached.fetchedAt
    });
  }

  try {
    const brands = await fetchWayfairBrandAssociations({
      credentials: {
        env: settings.env,
        clientId: settings.clientId,
        clientSecret: settings.clientSecret,
        audience: settings.audience
      },
      supplierId: settings.supplierId,
      marketContext
    });

    writeBrandsCache(cachePath, brands);

    res.json({
      brands,
      cached: false,
      fetchedAt: new Date().toISOString()
    });
  } catch (error) {
    sendError(res, {
      code: "WAYFAIR_API_ERROR",
      message: error instanceof Error ? error.message : "Failed to fetch brands"
    }, 500);
  }
});
