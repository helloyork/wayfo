import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import OpenAI, { toFile } from "openai";
import sharp from "sharp";
import { getOpenAiApiKey, getOpenAiImageModel } from "../store/settingsStore";
import { getImagePool } from "../pools/registry";
import { dataRoot, ensureDir } from "../paths";
import { log } from "../logger";
import type { ImageType } from "./planner";

export type GeneratedImage = {
  sourceUrl: string;
  sourcePath: string;
  type: ImageType;
  generatedPath: string;
  generatedHash: string;
  prompt: string;
  model: string;
  quality: "low" | "medium" | "high";
  cost: number;
};

export type GenerationResult = {
  images: GeneratedImage[];
  totalCost: number;
  model: string;
  errors: Array<{ sourceUrl: string; error: string }>;
};

type QualityConfig = {
  openaiQuality: "low" | "medium" | "high" | "auto";
  size: "1024x1024" | "1536x1024" | "1024x1536" | "auto";
};

const qualityMap: Record<"low" | "medium" | "high", QualityConfig> = {
  low: { openaiQuality: "low", size: "1024x1024" },
  medium: { openaiQuality: "medium", size: "1024x1024" },
  high: { openaiQuality: "high", size: "1024x1024" }
};

/** Approximate USD per image for GPT Image family at 1024x1024 (see OpenAI pricing). */
const costPerImage: Record<"low" | "medium" | "high", number> = {
  low: 0.009,
  medium: 0.034,
  high: 0.133
};

function generateOutputHash(input: {
  prompt: string;
  quality: "low" | "medium" | "high";
  model: string;
  sourceFingerprint: string;
  variantId?: string;
}): string {
  const base = `${input.sourceFingerprint}:${input.prompt}:${input.quality}:${input.model}`;
  const fingerprint = input.variantId ? `${base}:${input.variantId}` : base;
  return createHash("sha1")
    .update(fingerprint)
    .digest("hex")
    .slice(0, 16);
}

function computeSourceFingerprint(buffer: Buffer): string {
  return createHash("sha1").update(buffer).digest("hex").slice(0, 16);
}

function getImageCachePath(type: ImageType, fileName: string) {
  const cacheDir = path.join(dataRoot, "cache", "images", "generated", type);
  ensureDir(cacheDir);
  return path.join(cacheDir, fileName);
}

async function loadPngSquareBuffer(sourcePath: string): Promise<Buffer> {
  const image = sharp(sourcePath);
  const targetSize = 1024;
  return image
    .resize(targetSize, targetSize, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .ensureAlpha()
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function generateSingleImage(input: {
  openai: OpenAI;
  model: string;
  sourcePath: string;
  sourceUrl: string;
  prompt: string;
  type: ImageType;
  quality: "low" | "medium" | "high";
  outputDir: string;
  variantId?: string;
}): Promise<GeneratedImage> {
  const { openai, model, sourcePath, sourceUrl, prompt, type, quality, outputDir, variantId } = input;
  const qualityConfig = qualityMap[quality];
  const inputFidelity = "low";

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source image not found: ${sourcePath}`);
  }

  const pngBuffer = await loadPngSquareBuffer(sourcePath);
  const sourceFingerprint = computeSourceFingerprint(pngBuffer);
  const outputHash = generateOutputHash({
    prompt,
    quality,
    model,
    sourceFingerprint,
    variantId
  });
  const outputExt = ".png";
  const outputFileName = `${outputHash}${outputExt}`;
  const typeDir = path.join(outputDir, type);
  ensureDir(typeDir);
  const outputPath = path.join(typeDir, outputFileName);
  const cachePath = getImageCachePath(type, outputFileName);

  if (fs.existsSync(outputPath)) {
    if (!fs.existsSync(cachePath)) {
      fs.copyFileSync(outputPath, cachePath);
    }
    return {
      sourceUrl,
      sourcePath,
      type,
      generatedPath: outputPath,
      generatedHash: outputHash,
      prompt,
      model,
      quality,
      cost: 0
    };
  }

  if (fs.existsSync(cachePath)) {
    fs.copyFileSync(cachePath, outputPath);
    return {
      sourceUrl,
      sourcePath,
      type,
      generatedPath: outputPath,
      generatedHash: outputHash,
      prompt,
      model,
      quality,
      cost: 0
    };
  }

  const sourceFile = await toFile(pngBuffer, "input.png", { type: "image/png" });

  const response = await openai.images.edit({
    model,
    image: sourceFile,
    prompt,
    n: 1,
    size: qualityConfig.size,
    quality: qualityConfig.openaiQuality,
    input_fidelity: inputFidelity
  });

  if (!response.data || response.data.length === 0) {
    throw new Error("No image data returned from OpenAI");
  }
  const imageData = response.data[0];
  if (!imageData?.b64_json && !imageData?.url) {
    throw new Error("No image URL or data returned from OpenAI");
  }

  let outputBuffer: Buffer;
  if (imageData.b64_json) {
    outputBuffer = Buffer.from(imageData.b64_json, "base64");
  } else if (imageData.url) {
    const fetchResponse = await fetch(imageData.url);
    if (!fetchResponse.ok) {
      throw new Error(`Failed to fetch generated image: ${fetchResponse.status}`);
    }
    outputBuffer = Buffer.from(await fetchResponse.arrayBuffer());
  } else {
    throw new Error("No image data returned");
  }

  fs.writeFileSync(outputPath, outputBuffer);
  fs.writeFileSync(cachePath, outputBuffer);

  return {
    sourceUrl,
    sourcePath,
    type,
    generatedPath: outputPath,
    generatedHash: outputHash,
    prompt,
    model,
    quality,
    cost: costPerImage[quality]
  };
}

export async function generateImages(input: {
  runId: string;
  asin: string;
  tasks: Array<{
    sourceUrl: string;
    sourcePath: string;
    type: ImageType;
    prompt: string;
    quality?: "low" | "medium" | "high";
    variantId?: string;
  }>;
  outputDir: string;
}): Promise<GenerationResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API Key not configured");
  }

  const model = getOpenAiImageModel();

  if (input.tasks.length === 0) {
    return { images: [], totalCost: 0, model, errors: [] };
  }

  const openai = new OpenAI({ apiKey });
  const pool = getImagePool();

  const results: GeneratedImage[] = [];
  const errors: Array<{ sourceUrl: string; error: string }> = [];
  let totalCost = 0;

  const taskResults = await pool.run(input.tasks, async (task) => {
    try {
      const quality = task.quality ?? "medium";
      const result = await generateSingleImage({
        openai,
        model,
        sourcePath: task.sourcePath,
        sourceUrl: task.sourceUrl,
        prompt: task.prompt,
        type: task.type,
        quality,
        outputDir: input.outputDir,
        variantId: task.variantId
      });
      return { success: true as const, result };
    } catch (error) {
      log({
        level: "warn",
        runId: input.runId,
        message: "Image generation failed",
        err: { sourceUrl: task.sourceUrl, error: String(error) }
      });
      return {
        success: false as const,
        error: {
          sourceUrl: task.sourceUrl,
          error: error instanceof Error ? error.message : String(error)
        }
      };
    }
  });

  for (const taskResult of taskResults) {
    if (taskResult.success) {
      results.push(taskResult.result);
      totalCost += taskResult.result.cost;
    } else {
      errors.push(taskResult.error);
    }
  }

  return {
    images: results,
    totalCost,
    model,
    errors
  };
}

export async function generateImagesForPlan(input: {
  runId: string;
  plan: import("./planner").GenerationPlan;
  outputBaseDir: string;
}): Promise<{
  results: Map<string, GeneratedImage[]>;
  totalCost: number;
  errors: Array<{ asin: string; sourceUrl: string; error: string }>;
}> {
  const results = new Map<string, GeneratedImage[]>();
  const allErrors: Array<{ asin: string; sourceUrl: string; error: string }> = [];
  let totalCost = 0;

  for (const task of input.plan.tasks) {
    const asinOutputDir = path.join(input.outputBaseDir, task.asin);
    ensureDir(asinOutputDir);

    const tasks = task.images.map((img) => ({
      sourceUrl: img.sourceUrl,
      sourcePath: img.sourcePath,
      type: img.type,
      prompt: img.promptTemplate,
      variantId: img.variantId,
      quality: (img.type === "primary" ? "high" : "medium") as "low" | "medium" | "high"
    }));

    const result = await generateImages({
      runId: input.runId,
      asin: task.asin,
      tasks,
      outputDir: asinOutputDir
    });

    results.set(task.asin, result.images);
    totalCost += result.totalCost;

    for (const error of result.errors) {
      allErrors.push({ asin: task.asin, ...error });
    }
  }

  return { results, totalCost, errors: allErrors };
}
