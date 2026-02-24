export type ImageType = "primary" | "other";

export type GenerationTask = {
  asin: string;
  isMain: boolean;
  images: Array<{
    sourceUrl: string;
    sourcePath: string;
    type: ImageType;
    candidateCount: number;
    promptTemplate: string;
    variantId?: string;
  }>;
};

export type GenerationPlan = {
  mainAsin: string;
  variantAsins: string[];
  tasks: GenerationTask[];
  sharedImageSlots: string[];
  config: SimplifiedImageGenerationConfig;
};

export type SimplifiedImageGenerationConfig = {
  primaryImageCandidateCount: number;
  maxImagesPerProduct: number;
};

const defaultConfig: SimplifiedImageGenerationConfig = {
  primaryImageCandidateCount: 4,
  maxImagesPerProduct: 8
};

const PRIMARY_PROMPT =
  "Generate entirely different camera angle with a professional photographic aesthetic on a solid white background. Maintain strict consistency in the number of products, as well as their materials, colors, and aspect ratios, as shown in the original image.";

const NON_PRIMARY_PROMPT =
  "Generate entirely different designs and background images for related content while ensuring continuity and consistency of the object content. Maintain the product's functional expression, aspect ratio, materials, and colors. The objects, people, and layout must differ from the original image, but all product dimensions and specifications must be strictly preserved.";

export type SimpleImageInput = {
  url: string;
  localPath: string;
  isPrimary: boolean;
};

export function createSimpleGenerationPlan(input: {
  mainAsin: string;
  mainPrimaryImage: SimpleImageInput;
  mainOtherImages: SimpleImageInput[];
  variantAsins: string[];
  variantPrimaryImages: Map<string, SimpleImageInput>;
  config?: Partial<SimplifiedImageGenerationConfig>;
}): GenerationPlan {
  const config: SimplifiedImageGenerationConfig = {
    ...defaultConfig,
    ...input.config
  };

  const tasks: GenerationTask[] = [];
  const sharedImageSlots: string[] = [];
  const filteredVariantAsins = input.variantAsins.filter(
    (variantAsin) => variantAsin && variantAsin !== input.mainAsin
  );

  const mainTask: GenerationTask = {
    asin: input.mainAsin,
    isMain: true,
    images: []
  };

  for (let i = 0; i < config.primaryImageCandidateCount; i++) {
    mainTask.images.push({
      sourceUrl: input.mainPrimaryImage.url,
      sourcePath: input.mainPrimaryImage.localPath,
      type: "primary",
      candidateCount: 1,
      promptTemplate: PRIMARY_PROMPT,
      variantId: `primary-${i + 1}`
    });
  }

  let otherIndex = 0;
  for (const otherImage of input.mainOtherImages) {
    if (mainTask.images.length >= config.maxImagesPerProduct) {
      break;
    }
    otherIndex += 1;
    mainTask.images.push({
      sourceUrl: otherImage.url,
      sourcePath: otherImage.localPath,
      type: "other",
      candidateCount: 1,
      promptTemplate: NON_PRIMARY_PROMPT,
      variantId: `other-${otherIndex}`
    });
    sharedImageSlots.push(`${input.mainAsin}:other:${otherImage.url}`);
  }

  tasks.push(mainTask);

  for (const variantAsin of filteredVariantAsins) {
    const variantPrimary = input.variantPrimaryImages.get(variantAsin);
    if (!variantPrimary) continue;

    const variantTask: GenerationTask = {
      asin: variantAsin,
      isMain: false,
      images: []
    };

    for (let i = 0; i < config.primaryImageCandidateCount; i++) {
      variantTask.images.push({
        sourceUrl: variantPrimary.url,
        sourcePath: variantPrimary.localPath,
        type: "primary",
        candidateCount: 1,
        promptTemplate: PRIMARY_PROMPT,
        variantId: `primary-${i + 1}`
      });
    }

    if (variantTask.images.length > 0) {
      tasks.push(variantTask);
    }
  }

  return {
    mainAsin: input.mainAsin,
    variantAsins: filteredVariantAsins,
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
  return mainGenerated.filter((img) => img.type === "other");
}
