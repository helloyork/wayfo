import type {
  WayfairProductAdditionSubmission,
  WayfairSubmitProductAdditionsRequest,
  WayfairSubmitProductAdditionsResponse
} from "@wayfo/shared";
import { wayfairGraphqlRequest, type WayfairEnv } from "../../connectors/wayfair";

type WayfairCredentials = {
  env: WayfairEnv;
  clientId: string;
  clientSecret: string;
  audience: string;
};

const submitMutation = `
mutation submit($request: SubmitProductAdditionsRequest!) {
  productAddition {
    submit(request: $request) {
      requestIds
    }
  }
}
`;

const submissionsQuery = `
query submissions($request: GetProductAdditionsRequest!) {
  productAddition {
    submissions(request: $request) {
      requestId
      supplierId
      supplierPartNumber
      classId
      marketContext { locale country brand }
      status
      validationStatus
      submissionStatus
      validationFlaws {
        questionId
        parentRank
        rank
        flawType
        flaw
      }
    }
  }
}
`;

export async function submitWayfairProductAdditions(input: {
  credentials: WayfairCredentials;
  request: WayfairSubmitProductAdditionsRequest;
}) {
  const response = await wayfairGraphqlRequest<{
    productAddition: { submit: WayfairSubmitProductAdditionsResponse };
  }>({
    env: input.credentials.env,
    clientId: input.credentials.clientId,
    clientSecret: input.credentials.clientSecret,
    audience: input.credentials.audience,
    api: "product-catalog-api",
    query: submitMutation,
    variables: {
      request: input.request
    }
  });
  return response.productAddition.submit;
}

export async function fetchWayfairSubmissions(input: {
  credentials: WayfairCredentials;
  supplierId: string;
  requestIds: string[];
}) {
  const response = await wayfairGraphqlRequest<{
    productAddition: { submissions: WayfairProductAdditionSubmission[] };
  }>({
    env: input.credentials.env,
    clientId: input.credentials.clientId,
    clientSecret: input.credentials.clientSecret,
    audience: input.credentials.audience,
    api: "product-catalog-api",
    query: submissionsQuery,
    variables: {
      request: {
        supplierId: input.supplierId,
        ids: input.requestIds
      }
    }
  });
  return response.productAddition.submissions ?? [];
}
