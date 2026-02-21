import { ClassifiedImage, ImageType, groupImagesByType } from "./classifier";

export type GenerationTask = {
  asin: string;
  isMain: boolean;
  images: Array<{
    sourceUrl: string;
    sourcePath: string;
    type: ImageType;
    candidateCount: number;
    promptTemplate: string;
  }>;
};

export type GenerationPlan = {
  mainAsin: string;
  variantAsins: string[];
  tasks: GenerationTask[];
  sharedImageSlots: string[];
  config: ImageGenerationConfig;
};

export type ImageGenerationConfig = {
  primaryImageCandidateCount: number;
  types: Record<
    ImageType,
    {
      enabled: boolean;
      candidates: number | "use_primaryImageCandidateCount";
      quality: "low" | "medium" | "high";
    }
  >;
  maxImagesPerProduct: number;
};

const defaultConfig: ImageGenerationConfig = {
  primaryImageCandidateCount: 4,
  types: {
    primary: { enabled: true, candidates: "use_primaryImageCandidateCount", quality: "high" },
    dimension: { enabled: true, candidates: 1, quality: "medium" },
    selling_point: { enabled: true, candidates: 1, quality: "medium" },
    lifestyle: { enabled: true, candidates: 1, quality: "low" },
    other: { enabled: false, candidates: 1, quality: "low" }
  },
  maxImagesPerProduct: 8
};

const promptTemplates: Record<ImageType, string[]> = {
  primary: [
    "Rerender this product image with a clean white studio background. Maintain the exact product structure, materials, colors, and proportions. Use soft professional lighting with natural shadows. Do not add text, logos, watermarks, or additional objects. Camera angle: front view.",
    "Rerender this product image with a clean light gray studio background. Maintain the exact product structure, materials, colors, and proportions. Use soft professional lighting with natural shadows. Do not add text, logos, watermarks, or additional objects. Camera angle: 45-degree side view.",
    "Rerender this product image with a clean white studio background. Maintain the exact product structure, materials, colors, and proportions. Use soft professional lighting with natural shadows. Do not add text, logos, watermarks, or additional objects. Camera angle: side view.",
    "Rerender this product image with a clean white studio background. Maintain the exact product structure, materials, colors, and proportions. Use soft professional lighting with natural shadows. Do not add text, logos, watermarks, or additional objects. Camera angle: top-down view."
  ],
  dimension: [
    "Rerender this product dimension/measurement image with a clean white background. Maintain all measurement lines, numbers, and scale indicators clearly visible. Keep the product proportions accurate. Use clean, professional styling without watermarks or extra text."
  ],
  selling_point: [
    "Rerender this product feature/detail image with a clean neutral background. Highlight the specific feature or material detail shown. Maintain accurate colors and textures. Use professional close-up styling without watermarks."
  ],
  lifestyle: [
    "Rerender this lifestyle/context image showing the product in use. Maintain a natural, realistic setting. Keep the product as the focal point. Use warm, inviting lighting. Remove any watermarks or unwanted text."
  ],
  other: [
    "Rerender this product image with a clean neutral background. Maintain the original content and layout. Use professional styling without watermarks."
  ]
};

function getPromptForCandidate(type: ImageType, candidateIndex: number): string {
  const templates = promptTemplates[type];
  return templates[candidateIndex % templates.length];
}

function getCandidateCount(type: ImageType, config: ImageGenerationConfig): number {
  const typeConfig = config.types[type];
  if (!typeConfig.enabled) {
    return 0;
  }
  if (typeConfig.candidates === "use_primaryImageCandidateCount") {
    return config.primaryImageCandidateCount;
  }
  return typeConfig.candidates;
}

export function createGenerationPlan(input: {
  mainAsin: string;
  mainImages: ClassifiedImage[];
  variantAsins: string[];
  variantImages: Map<string, ClassifiedImage[]>;
  config?: Partial<ImageGenerationConfig>;
}): GenerationPlan {
  const config: ImageGenerationConfig = {
    ...defaultConfig,
    ...input.config,
    types: {
      ...defaultConfig.types,
      ...input.config?.types
    }
  };

  const tasks: GenerationTask[] = [];
  const sharedImageSlots: string[] = [];

  const mainGrouped = groupImagesByType(input.mainImages);
  const mainTask: GenerationTask = {
    asin: input.mainAsin,
    isMain: true,
    images: []
  };

  const enabledTypes: ImageType[] = ["primary", "dimension", "selling_point", "lifestyle", "other"];

  for (const type of enabledTypes) {
    const typeConfig = config.types[type];
    if (!typeConfig.enabled) {
      continue;
    }

    const sourceImages = mainGrouped[type];
    if (sourceImages.length === 0) {
      continue;
    }

    const candidateCount = getCandidateCount(type, config);
    const sourceImage = sourceImages[0];

    for (let i = 0; i < candidateCount; i++) {
      mainTask.images.push({
        sourceUrl: sourceImage.url,
        sourcePath: sourceImage.localPath,
        type,
        candidateCount: 1,
        promptTemplate: getPromptForCandidate(type, i)
      });
    }

    if (type !== "primary") {
      sharedImageSlots.push(`${input.mainAsin}:${type}`);
    }
  }

  if (mainTask.images.length > config.maxImagesPerProduct) {
    mainTask.images = mainTask.images.slice(0, config.maxImagesPerProduct);
  }

  tasks.push(mainTask);

  for (const variantAsin of input.variantAsins) {
    const variantImagesArray = input.variantImages.get(variantAsin) ?? [];
    const variantGrouped = groupImagesByType(variantImagesArray);

    const variantTask: GenerationTask = {
      asin: variantAsin,
      isMain: false,
      images: []
    };

    const primaryConfig = config.types.primary;
    if (primaryConfig.enabled) {
      const primaryImages = variantGrouped.primary;
      if (primaryImages.length > 0) {
        const sourceImage = primaryImages[0];
        const candidateCount = getCandidateCount("primary", config);

        for (let i = 0; i < candidateCount; i++) {
          variantTask.images.push({
            sourceUrl: sourceImage.url,
            sourcePath: sourceImage.localPath,
            type: "primary",
            candidateCount: 1,
            promptTemplate: getPromptForCandidate("primary", i)
          });
        }
      }
    }

    if (variantTask.images.length > 0) {
      tasks.push(variantTask);
    }
  }

  return {
    mainAsin: input.mainAsin,
    variantAsins: input.variantAsins,
    tasks,
    sharedImageSlots,
    config
  };
}

export function estimatePlanCost(plan: GenerationPlan): {
  totalImages: number;
  estimatedCostUsd: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {};
  let totalImages = 0;

  for (const task of plan.tasks) {
    const key = task.isMain ? "main" : "variants";
    breakdown[key] = (breakdown[key] ?? 0) + task.images.length;
    totalImages += task.images.length;
  }

  const avgCostPerImage = 0.04;
  const estimatedCostUsd = totalImages * avgCostPerImage;

  return { totalImages, estimatedCostUsd, breakdown };
}

export function getSharedImagesForVariant(
  plan: GenerationPlan,
  variantAsin: string,
  generatedImages: Map<string, Array<{ type: ImageType; url: string; path: string }>>
): Array<{ type: ImageType; url: string; path: string }> {
  if (variantAsin === plan.mainAsin) {
    return [];
  }

  const mainGenerated = generatedImages.get(plan.mainAsin) ?? [];
  return mainGenerated.filter((img) => img.type !== "primary");
}
