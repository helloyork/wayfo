import type {
  WayfairMarketContextInput,
  WayfairMediaMetaDataTagSet,
  WayfairProductAdditionQuestion,
  WayfairSubmitProductAdditionsRequest,
  WayfairSupplierBrandAssociation
} from "@wayfo/shared";
import type { AmazonProductSnapshot } from "../amazon/normalize";
import { generateWayfairAnswers } from "./answers";

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

  const answerResult = await generateWayfairAnswers({
    snapshot: input.snapshot,
    questions: input.questions,
    skipQuestionIds: Array.from(coreQuestionIds)
  });
  const rawAnswers = (answerResult.data as { answers?: unknown }).answers;
  const answers = Array.isArray(rawAnswers)
    ? sanitizeAnswers(
        rawAnswers.filter(
          (item): item is { questionId: string; value: string; parentRank?: number; rank?: number } =>
            item && typeof item === "object" && "questionId" in item && "value" in item
        )
      )
    : [];

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
            productName: input.snapshot.title,
            featureBullets: input.snapshot.bullets?.slice(0, 6) ?? null,
            marketingCopy: input.snapshot.description?.slice(0, 2000) ?? null,
            media: { images: imageUrls },
            answers
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
      usedUploadedImages: Boolean(input.uploadedImageUrls && input.uploadedImageUrls.length > 0)
    }
  };
}
