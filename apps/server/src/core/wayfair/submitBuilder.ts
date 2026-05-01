import type {
  WayfairMarketContextInput,
  WayfairMediaMetaDataTagSet,
  WayfairProductAdditionQuestion,
  WayfairSubmitProductAdditionsRequest,
  WayfairSupplierBrandAssociation
} from "@wayfo/shared";
import type { AmazonProductSnapshot } from "../amazon/normalize";
import { generateWayfairAnswers } from "./answers";
import { flattenQuestions } from "./answerRules";
import { mergeGeneratedAnswersWithPlan, planEntriesToWayfairAnswers } from "./planAnswerMerge";

const coreQuestionIds = new Set([
  "core::manufacturerId",
  "core::supplierPartNumber",
  "core::productName",
  "core::amazonStandardIdentificationNumber",
  "featureDescription::genericFeatures",
  "featureDescription::romanceCopy",
  "media::imageValue"
]);

function pickManufacturerId(
  brands: WayfairSupplierBrandAssociation[],
  preferredId?: string | null
) {
  if (preferredId) {
    const match = brands.find((item) => item.manufacturer?.id === preferredId);
    if (match) {
      return preferredId;
    }
  }
  const first = brands.find((item) => item.manufacturer?.id);
  return first?.manufacturer?.id ?? null;
}

function buildSupplierPartNumber(snapshot: AmazonProductSnapshot) {
  return snapshot.asin;
}

function selectPrimaryImage(snapshot: AmazonProductSnapshot) {
  return snapshot.images.primary ?? snapshot.images.all[0] ?? null;
}

function selectImageUrls(input: {
  snapshot: AmazonProductSnapshot;
  uploadedImageUrls?: string[] | null;
}): string[] {
  if (input.uploadedImageUrls && input.uploadedImageUrls.length > 0) {
    return input.uploadedImageUrls;
  }
  const primary = selectPrimaryImage(input.snapshot);
  return primary ? [primary] : [];
}

function sanitizeAnswers(
  answers: Array<{ questionId: string; value: string; parentRank?: number; rank?: number }>
) {
  return answers
    .filter((answer) => answer.questionId !== "media::imageValue")
    .map((answer) => ({
      questionId: answer.questionId,
      value: answer.value,
      parentRank: answer.parentRank,
      rank: answer.rank
    }));
}

export type RewrittenContentInput = {
  productName?: string;
  description?: string;
  bullets?: string[];
};

/** Optional Plan Excel overrides: questionId -> one or more cell values (after split). */
export type PlanAnswerEntry = {
  questionId: string;
  values: string[];
};

function applyPlanAnswerMerge(
  questions: WayfairProductAdditionQuestion[],
  generatedAnswers: Array<{
    questionId: string;
    value: string;
    parentRank?: number;
    rank?: number;
  }>,
  planAnswerEntries?: PlanAnswerEntry[] | null
) {
  if (!planAnswerEntries?.length) {
    return sanitizeAnswers(generatedAnswers);
  }
  const questionMap = new Map(flattenQuestions(questions).map((q) => [q.id, q]));
  const planWayfair = planEntriesToWayfairAnswers(questionMap, planAnswerEntries);
  const merged = mergeGeneratedAnswersWithPlan(generatedAnswers, planWayfair);
  return sanitizeAnswers(merged);
}

export async function buildWayfairSubmitRequest(input: {
  snapshot: AmazonProductSnapshot;
  classId: number;
  marketContext: WayfairMarketContextInput;
  supplierId: string;
  questions: WayfairProductAdditionQuestion[];
  brandAssociations: WayfairSupplierBrandAssociation[];
  mediaMetaDataTags: WayfairMediaMetaDataTagSet[];
  manufacturerId?: string | null;
  uploadedImageUrls?: string[] | null;
  rewrittenContent?: RewrittenContentInput | null;
  universalProductCode?: string | null;
  planAnswerEntries?: PlanAnswerEntry[] | null;
  promptModifier?: string | null;
}) {
  const manufacturerId = pickManufacturerId(input.brandAssociations, input.manufacturerId);
  if (!manufacturerId) {
    throw new Error("brandAssociations 为空，无法选择 manufacturerId");
  }
  const supplierPartNumber = buildSupplierPartNumber(input.snapshot);
  const imageUrls = selectImageUrls({
    snapshot: input.snapshot,
    uploadedImageUrls: input.uploadedImageUrls
  });
  if (imageUrls.length === 0) {
    throw new Error("缺少可用图片 URL，无法提交 Wayfair");
  }

  const productName = input.rewrittenContent?.productName ?? input.snapshot.title;
  const featureBullets = input.rewrittenContent?.bullets?.slice(0, 6) ?? input.snapshot.bullets?.slice(0, 6) ?? null;
  const marketingCopy = input.rewrittenContent?.description?.slice(0, 2000) ?? input.snapshot.description?.slice(0, 2000) ?? null;

  const universalProductCode = input.universalProductCode?.trim();
  const skipQuestionIds = new Set(coreQuestionIds);
  if (universalProductCode) {
    skipQuestionIds.add("core::universalProductCode");
  }

  const answerResult = await generateWayfairAnswers({
    snapshot: input.snapshot,
    questions: input.questions,
    skipQuestionIds: Array.from(skipQuestionIds),
    ...(input.promptModifier?.trim() ? { promptModifier: input.promptModifier.trim() } : {})
  });
  const rawAnswers = (answerResult.data as { answers?: unknown }).answers;
  const generated = Array.isArray(rawAnswers)
    ? rawAnswers.filter(
        (item): item is { questionId: string; value: string; parentRank?: number; rank?: number } =>
          item && typeof item === "object" && "questionId" in item && "value" in item
      )
    : [];
  const answers = applyPlanAnswerMerge(input.questions, generated, input.planAnswerEntries);

  const request: WayfairSubmitProductAdditionsRequest = {
    supplierId: input.supplierId,
    ignoreWarnings: true,
    rejectAllOnErrors: false,
    proposedProductAdditions: [
      {
        classId: input.classId,
        marketContext: input.marketContext,
        parts: [
          {
            supplierPartNumber,
            manufacturerId,
            amazonStandardIdentificationNumber: input.snapshot.asin,
            productName,
            featureBullets,
            marketingCopy,
            media: { images: imageUrls },
            answers,
            ...(universalProductCode ? { universalProductCode } : {})
          }
        ]
      }
    ]
  };

  return {
    request,
    answerResult,
    selected: {
      manufacturerId,
      supplierPartNumber,
      imageUrls,
      usedUploadedImages: Boolean(input.uploadedImageUrls && input.uploadedImageUrls.length > 0),
      usedRewrittenContent: Boolean(input.rewrittenContent)
    }
  };
}

export type VariantBatchInput = {
  asin: string;
  snapshot: AmazonProductSnapshot;
  imageUrls: string[];
  isMain: boolean;
  rewrittenContent?: RewrittenContentInput | null;
};

export type VariantBatchBuildResult = {
  request: WayfairSubmitProductAdditionsRequest;
  answerResults: Map<string, unknown>;
  selected: {
    manufacturerId: string;
    parts: Array<{
      asin: string;
      supplierPartNumber: string;
      imageUrls: string[];
      isMain: boolean;
    }>;
  };
};

export async function buildWayfairBatchSubmitRequest(input: {
  variants: VariantBatchInput[];
  classId: number;
  marketContext: WayfairMarketContextInput;
  supplierId: string;
  questions: WayfairProductAdditionQuestion[];
  brandAssociations: WayfairSupplierBrandAssociation[];
  mediaMetaDataTags: WayfairMediaMetaDataTagSet[];
  manufacturerId?: string | null;
  universalProductCode?: string | null;
  planAnswerEntries?: PlanAnswerEntry[] | null;
  promptModifier?: string | null;
}): Promise<VariantBatchBuildResult> {
  const manufacturerId = pickManufacturerId(input.brandAssociations, input.manufacturerId);
  if (!manufacturerId) {
    throw new Error("brandAssociations 为空，无法选择 manufacturerId");
  }

  if (input.variants.length === 0) {
    throw new Error("variants 为空，无法构建批次提交请求");
  }

  const universalProductCode = input.universalProductCode?.trim();
  const skipQuestionIds = new Set(coreQuestionIds);
  if (universalProductCode) {
    skipQuestionIds.add("core::universalProductCode");
  }

  const sortedVariants = [...input.variants].sort((a, b) => {
    if (a.isMain && !b.isMain) return -1;
    if (!a.isMain && b.isMain) return 1;
    return 0;
  });

  const parts: WayfairSubmitProductAdditionsRequest["proposedProductAdditions"][0]["parts"] = [];
  const answerResults = new Map<string, unknown>();
  const selectedParts: VariantBatchBuildResult["selected"]["parts"] = [];

  for (const variant of sortedVariants) {
    const supplierPartNumber = buildSupplierPartNumber(variant.snapshot);
    const imageUrls = variant.imageUrls.length > 0
      ? variant.imageUrls
      : selectImageUrls({ snapshot: variant.snapshot });

    if (imageUrls.length === 0) {
      continue;
    }

    const answerResult = await generateWayfairAnswers({
      snapshot: variant.snapshot,
      questions: input.questions,
      skipQuestionIds: Array.from(skipQuestionIds),
      ...(input.promptModifier?.trim() ? { promptModifier: input.promptModifier.trim() } : {})
    });
    answerResults.set(variant.asin, answerResult);

    const rawAnswers = (answerResult.data as { answers?: unknown }).answers;
    const generated = Array.isArray(rawAnswers)
      ? rawAnswers.filter(
          (item): item is { questionId: string; value: string; parentRank?: number; rank?: number } =>
            item && typeof item === "object" && "questionId" in item && "value" in item
        )
      : [];
    const answers = applyPlanAnswerMerge(input.questions, generated, input.planAnswerEntries);

    const productName = variant.rewrittenContent?.productName ?? variant.snapshot.title;
    const featureBullets = variant.rewrittenContent?.bullets?.slice(0, 6) ?? variant.snapshot.bullets?.slice(0, 6) ?? null;
    const marketingCopy = variant.rewrittenContent?.description?.slice(0, 2000) ?? variant.snapshot.description?.slice(0, 2000) ?? null;

    parts.push({
      supplierPartNumber,
      manufacturerId,
      amazonStandardIdentificationNumber: variant.snapshot.asin,
      productName,
      featureBullets,
      marketingCopy,
      media: { images: imageUrls },
      answers,
      ...(universalProductCode ? { universalProductCode } : {})
    });

    selectedParts.push({
      asin: variant.asin,
      supplierPartNumber,
      imageUrls,
      isMain: variant.isMain
    });
  }

  if (parts.length === 0) {
    throw new Error("没有有效的变体可以提交（所有变体都缺少图片）");
  }

  const request: WayfairSubmitProductAdditionsRequest = {
    supplierId: input.supplierId,
    ignoreWarnings: true,
    rejectAllOnErrors: true,
    proposedProductAdditions: [
      {
        classId: input.classId,
        marketContext: input.marketContext,
        parts
      }
    ]
  };

  return {
    request,
    answerResults,
    selected: {
      manufacturerId,
      parts: selectedParts
    }
  };
}
