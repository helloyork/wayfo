import { Router } from "express";
import fs from "fs";
import path from "path";
import { sendError } from "../errors";
import { listRuns } from "../../core/store/runStore";
import { readRunCache, readRunImageIndex } from "../../core/amazon/cache";
import { runsRoot } from "../../core/paths";

export const productsRouter = Router();

type ProductSummary = {
  asin: string;
  title: string;
  brand?: string;
  price?: {
    currency?: string;
    symbol?: string;
    current?: number;
    before?: number;
    discount?: string;
  };
  availability?: {
    isAvailable: boolean;
  };
  imageName?: string;
  imageUrl?: string;
  runId: string;
  runStatus: string;
  runCreatedAt: string;
};

type ProductDetailResponse = {
  runId: string;
  runStatus: string;
  runCreatedAt: string;
  product: unknown;
  images?: unknown;
  generatedImages: Array<{
    type: string;
    path: string;
    fileName: string;
  }>;
};

function listAsinsForRun(runId: string) {
  const baseDir = path.join(runsRoot, runId, "artifacts", "amazon", "products");
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  return fs
    .readdirSync(baseDir)
    .filter((entry) => fs.statSync(path.join(baseDir, entry)).isDirectory());
}

function listProductsForRun(runId: string, runStatus: string, runCreatedAt: string) {
  const asins = listAsinsForRun(runId);
  return asins
    .map((asin) => {
      const cached = readRunCache(runId, asin);
      if (!cached) {
        return null;
      }
      const product = cached.product;
      const imageIndex = readRunImageIndex(runId, asin);
      const primaryUrl = product.images.primary ?? product.images.all[0];
      const imageName = primaryUrl
        ? imageIndex?.items.find((item) => item.url === primaryUrl)?.fileName
        : undefined;
      return {
        asin: product.asin,
        title: product.title,
        brand: product.brand,
        price: product.price,
        availability: product.availability,
        imageName,
        imageUrl: primaryUrl,
        runId,
        runStatus,
        runCreatedAt
      } satisfies ProductSummary;
    })
    .filter(Boolean) as ProductSummary[];
}

function listGeneratedImages(runId: string, asin: string) {
  const artifactPath = path.join(runsRoot, runId, "artifacts", "images", "generated.json");
  if (!fs.existsSync(artifactPath)) {
    return [];
  }
  const payload = JSON.parse(fs.readFileSync(artifactPath, "utf-8")) as {
    results?: Record<string, Array<{ generatedPath: string }>>;
  };
  const images = payload.results?.[asin] ?? [];
  return images
    .map((image) => {
      const fileName = path.basename(image.generatedPath);
      const type = path.basename(path.dirname(image.generatedPath));
      return {
        type,
        fileName,
        path: `/api/runs/${runId}/generated-images/${asin}/${type}/${encodeURIComponent(fileName)}`
      };
    })
    .filter((item) => item.fileName);
}

productsRouter.get("/", (_req, res) => {
  const runs = listRuns();
  const seen = new Set<string>();
  const products: ProductSummary[] = [];

  for (const run of runs) {
    const runProducts = listProductsForRun(run.id, run.status, run.createdAt);
    for (const product of runProducts) {
      if (seen.has(product.asin)) {
        continue;
      }
      seen.add(product.asin);
      products.push(product);
    }
  }

  res.json(products);
});

productsRouter.get("/:asin", (req, res) => {
  const asin = req.params.asin;
  const runs = listRuns();

  for (const run of runs) {
    const cached = readRunCache(run.id, asin);
    if (!cached) {
      continue;
    }
    const imageIndex = readRunImageIndex(run.id, asin);
    const generatedImages = listGeneratedImages(run.id, asin);
    const response: ProductDetailResponse = {
      runId: run.id,
      runStatus: run.status,
      runCreatedAt: run.createdAt,
      product: cached.product,
      images: imageIndex ?? undefined,
      generatedImages
    };
    return res.json(response);
  }

  return sendError(
    res,
    {
      code: "PRODUCT_NOT_FOUND",
      message: "Product not found"
    },
    404
  );
});
