import { wayfairGraphqlRequest, type WayfairEnv } from "../../connectors/wayfair";
import type {
  WayfairBrandAssociationsResponse,
  WayfairMediaMetaDataTagSet,
  WayfairMarketContextInput,
  WayfairProductAdditionQuestion,
  WayfairSupplierBrandAssociation
} from "@wayfo/shared";

type WayfairCredentials = {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
};

const questionsQuery = `
query GetQuestions($request: GetProductAdditionQuestionsRequest!) {
  productAddition {
    questions(request: $request) {
      id
      displayName
      answerType
      isActive
      isMultiValue
      importanceType
      possibleAnswers { key value }
      childQuestions {
        id
        displayName
        answerType
        isActive
        isMultiValue
        importanceType
        possibleAnswers { key value }
      }
      isUnavailableEligible
      isNotApplicableEligible
    }
  }
}
`;

const brandAssociationsQuery = `
query brandAssociations($request: GetSupplierBrandsAssociationsRequest!) {
  supplierBrand {
    brandAssociations(request: $request) {
      brands {
        id
        manufacturer { id name }
      }
      pageInfo { hasNextPage totalPages }
    }
  }
}
`;

const mediaTagsQuery = `
query GetMediaMetaDataTags($input: MediaMetaDataTagInput!) {
  media {
    mediaMetaDataTags(mediaMetaDataTag: $input) {
      metaDataTagType
      metaDataTags { metaDataId name }
    }
  }
}
`;

export async function fetchWayfairQuestions(input: {
  credentials: WayfairCredentials;
  supplierId: string;
  classId: number;
  marketContext: WayfairMarketContextInput;
}) {
  const response = await wayfairGraphqlRequest<{
    productAddition: { questions: WayfairProductAdditionQuestion[] };
  }>({
    env: input.credentials.env,
    clientId: input.credentials.clientId,
    clientSecret: input.credentials.clientSecret,
    audience: input.credentials.audience,
    api: "product-catalog-api",
    query: questionsQuery,
    variables: {
      request: {
        supplierId: Number(input.supplierId),
        classId: input.classId,
        marketContext: input.marketContext
      }
    }
  });
  return response.productAddition.questions ?? [];
}

export async function fetchWayfairBrandAssociations(input: {
  credentials: WayfairCredentials;
  supplierId: string;
  marketContext: WayfairMarketContextInput;
  pageSize?: number;
}) {
  const pageSize = input.pageSize ?? 50;
  let page = 1;
  const all: WayfairSupplierBrandAssociation[] = [];
  let totalPages = 1;
  while (page <= totalPages) {
    const response = await wayfairGraphqlRequest<{
      supplierBrand: { brandAssociations: WayfairBrandAssociationsResponse };
    }>({
      env: input.credentials.env,
      clientId: input.credentials.clientId,
      clientSecret: input.credentials.clientSecret,
      audience: input.credentials.audience,
      api: "product-catalog-api",
      query: brandAssociationsQuery,
      variables: {
        request: {
          supplierId: Number(input.supplierId),
          marketContext: input.marketContext,
          page,
          pageSize
        }
      }
    });
    const payload = response.supplierBrand.brandAssociations;
    all.push(...(payload.brands ?? []));
    totalPages = payload.pageInfo?.totalPages ?? page;
    if (!payload.pageInfo?.hasNextPage) {
      break;
    }
    page += 1;
  }
  return all;
}

export async function fetchWayfairMediaMetaDataTags(input: {
  credentials: WayfairCredentials;
  marketContext: WayfairMarketContextInput;
  metaDataTagTypes?: Array<"DOCUMENT" | "LEGAL_DOCUMENT" | "LANGUAGE" | "REGION">;
}) {
  const types = input.metaDataTagTypes ?? [
    "DOCUMENT",
    "LEGAL_DOCUMENT",
    "LANGUAGE",
    "REGION"
  ];
  const response = await wayfairGraphqlRequest<{
    media: { mediaMetaDataTags: WayfairMediaMetaDataTagSet[] };
  }>({
    env: input.credentials.env,
    clientId: input.credentials.clientId,
    clientSecret: input.credentials.clientSecret,
    audience: input.credentials.audience,
    api: "product-catalog-api",
    query: mediaTagsQuery,
    variables: {
      input: {
        metaDataTagTypes: types,
        marketContext: input.marketContext
      }
    }
  });
  return response.media.mediaMetaDataTags ?? [];
}
