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
  "featureDescription::romanceCopy"
]);

function pickManufacturerId(brands: WayfairSupplierBrandAssociation[]) {
  const first = brands.find((item) => item.manufacturer?.id);
  return first?.manufacturer?.id ?? null;
}

function buildSupplierPartNumber(snapshot: AmazonProductSnapshot) {
  return snapshot.asin;
}

function selectPrimaryImage(snapshot: AmazonProductSnapshot) {
  return snapshot.images.primary ?? snapshot.images.all[0] ?? null;
}

export async function buildWayfairSubmitRequest(input: {
  snapshot: AmazonProductSnapshot;
  classId: number;
  marketContext: WayfairMarketContextInput;
  supplierId: string;
  questions: WayfairProductAdditionQuestion[];
  brandAssociations: WayfairSupplierBrandAssociation[];
  mediaMetaDataTags: WayfairMediaMetaDataTagSet[];
}) {
  const manufacturerId = pickManufacturerId(input.brandAssociations);
  if (!manufacturerId) {
    throw new Error("brandAssociations 为空，无法选择 manufacturerId");
  }
  const supplierPartNumber = buildSupplierPartNumber(input.snapshot);
  const imageUrl = selectPrimaryImage(input.snapshot);
  if (!imageUrl) {
    throw new Error("缺少可用图片 URL，无法提交 Wayfair");
  }

  const answerResult = await generateWayfairAnswers({
    snapshot: input.snapshot,
    questions: input.questions,
    skipQuestionIds: Array.from(coreQuestionIds)
  });

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
            media: { images: [imageUrl] },
            answers: (answerResult.data as { answers: unknown }).answers as
              | { questionId: string; value: string; parentRank?: number; rank?: number }[]
              | []
          }
        ]
      }
    ]
  };

  return { request, answerResult, selected: { manufacturerId, supplierPartNumber, imageUrl } };
}
