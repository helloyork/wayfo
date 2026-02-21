import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { getOpenAiApiKey } from "../store/settingsStore";
import { getModelPool } from "../pools/registry";
import { log } from "../logger";

export type ImageType = "primary" | "dimension" | "selling_point" | "lifestyle" | "other";

export type ClassifiedImage = {
  url: string;
  localPath: string;
  type: ImageType;
  confidence: number;
  evidence?: string;
};

export type ClassificationResult = {
  images: ClassifiedImage[];
  model: string;
  totalCost: number;
};

const classificationPrompt = `You are a product image classifier for e-commerce listings.

Analyze the provided product images and classify each one into ONE of these categories:

1. **primary** - Main product photo showing the full product clearly, typically on white/neutral background, front-facing angle
2. **dimension** - Shows product dimensions, measurements, size comparisons, or scale reference
3. **selling_point** - Highlights specific features, materials, textures, close-up details, or key benefits
4. **lifestyle** - Shows the product in use, in a room setting, or with people/context
5. **other** - Packaging, warranty info, brand logos, or images that don't fit above categories

For each image, provide:
- type: one of the category names above
- confidence: 0.0 to 1.0 indicating your certainty
- evidence: brief explanation (max 20 words) of why you chose this category

Return a JSON array with objects for each image in the same order as provided.
Example: [{"type": "primary", "confidence": 0.95, "evidence": "Full product on white background, front view"}]`;

function encodeImageToBase64(imagePath: string): string {
  const buffer = fs.readFileSync(imagePath);
  return buffer.toString("base64");
}

function getMimeType(imagePath: string): string {
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };
  return mimeTypes[ext] ?? "image/jpeg";
}

export async function classifyImages(input: {
  runId: string;
  asin: string;
  images: Array<{ url: string; localPath: string }>;
  productTitle?: string;
}): Promise<ClassificationResult> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) {
    throw new Error("OpenAI API Key not configured");
  }

  if (input.images.length === 0) {
    return { images: [], model: "none", totalCost: 0 };
  }

  const openai = new OpenAI({ apiKey });
  const pool = getModelPool();

  const validImages = input.images.filter((img) => fs.existsSync(img.localPath));
  if (validImages.length === 0) {
    return { images: [], model: "none", totalCost: 0 };
  }

  const batchSize = 8;
  const batches: Array<Array<{ url: string; localPath: string }>> = [];
  for (let i = 0; i < validImages.length; i += batchSize) {
    batches.push(validImages.slice(i, i + batchSize));
  }

  const allResults: ClassifiedImage[] = [];
  let totalCost = 0;
  const model = "gpt-4o-mini";

  for (const batch of batches) {
    const result = await pool.run([batch], async (batchImages) => {
    const imageContents: OpenAI.Chat.Completions.ChatCompletionContentPart[] = batchImages.map(
      (img) => ({
          type: "image_url" as const,
          image_url: {
            url: `data:${getMimeType(img.localPath)};base64,${encodeImageToBase64(img.localPath)}`,
            detail: "low" as const
          }
        })
      );

      const contextMessage = input.productTitle
        ? `Product: ${input.productTitle}\n\nClassify the following ${batchImages.length} product images:`
        : `Classify the following ${batchImages.length} product images:`;

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: "system", content: classificationPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: contextMessage },
              ...imageContents
            ]
          }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0]?.message?.content ?? "[]";
      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;
      const cost = (inputTokens * 0.00015 + outputTokens * 0.0006) / 1000;

      let parsed: Array<{ type?: string; confidence?: number; evidence?: string }> = [];
      try {
        const jsonContent = JSON.parse(content);
        if (Array.isArray(jsonContent)) {
          parsed = jsonContent;
        } else if (jsonContent.images && Array.isArray(jsonContent.images)) {
          parsed = jsonContent.images;
        } else if (jsonContent.classifications && Array.isArray(jsonContent.classifications)) {
          parsed = jsonContent.classifications;
        }
      } catch {
        log({
          level: "warn",
          message: "Failed to parse classification response",
          err: { content }
        });
      }

      const classified: ClassifiedImage[] = batchImages.map((img, idx) => {
        const result = parsed[idx];
        const validTypes: ImageType[] = ["primary", "dimension", "selling_point", "lifestyle", "other"];
        const type = validTypes.includes(result?.type as ImageType)
          ? (result?.type as ImageType)
          : "other";
        return {
          url: img.url,
          localPath: img.localPath,
          type,
          confidence: typeof result?.confidence === "number" ? result.confidence : 0.5,
          evidence: result?.evidence
        };
      });

      return { classified, cost };
    });

    if (result[0]) {
      allResults.push(...result[0].classified);
      totalCost += result[0].cost;
    }
  }

  return { images: allResults, model, totalCost };
}

export function selectPrimaryImage(images: ClassifiedImage[]): ClassifiedImage | null {
  const primary = images.find((img) => img.type === "primary");
  if (primary) {
    return primary;
  }
  return images[0] ?? null;
}

export function groupImagesByType(images: ClassifiedImage[]): Record<ImageType, ClassifiedImage[]> {
  const groups: Record<ImageType, ClassifiedImage[]> = {
    primary: [],
    dimension: [],
    selling_point: [],
    lifestyle: [],
    other: []
  };
  for (const img of images) {
    groups[img.type].push(img);
  }
  return groups;
}
