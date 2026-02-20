export type WayfairEnv = "sandbox" | "prod";

export type WayfairBrandInput =
  | "WAYFAIR"
  | "JOSS_AND_MAIN"
  | "PERIGOLD"
  | "ALLMODERN"
  | "BIRCHLANE";

export type WayfairCountryInput =
  | "UNITED_STATES"
  | "UNITED_KINGDOM"
  | "GERMANY"
  | "CANADA";

export type WayfairMarketContextInput = {
  locale: string;
  country: WayfairCountryInput;
  brand: WayfairBrandInput;
};

export type WayfairQuestionAnswerType =
  | "DECIMAL"
  | "BOOLEAN"
  | "SINGLE_CHOICE"
  | "INTEGER"
  | "MULTI_CHOICE"
  | "STRING"
  | "ENUM";

export type WayfairQuestionImportanceType =
  | "OPTIONAL"
  | "REQUIRED"
  | "CONDITIONAL"
  | "RECOMMENDED";

export type WayfairPossibleAnswer = {
  key?: string | null;
  value: string;
};

export type WayfairProductAdditionQuestion = {
  id: string;
  displayName: string;
  answerType: WayfairQuestionAnswerType | null;
  isActive: boolean;
  isMultiValue: boolean;
  importanceType?: WayfairQuestionImportanceType | null;
  possibleAnswers: WayfairPossibleAnswer[];
  childQuestions: WayfairProductAdditionQuestion[];
  isUnavailableEligible?: boolean | null;
  isNotApplicableEligible?: boolean | null;
};

export type WayfairSupplierBrandAssociation = {
  id: string;
  manufacturer: { id: string; name?: string | null };
};

export type WayfairBrandAssociationsPageInfo = {
  hasNextPage: boolean;
  totalPages: number;
};

export type WayfairBrandAssociationsResponse = {
  brands: WayfairSupplierBrandAssociation[];
  pageInfo: WayfairBrandAssociationsPageInfo;
};

export type WayfairMediaMetaDataTagTypeInput =
  | "DOCUMENT"
  | "LEGAL_DOCUMENT"
  | "LANGUAGE"
  | "REGION";

export type WayfairMediaMetaDataTag = {
  metaDataId: string;
  name: string;
};

export type WayfairMediaMetaDataTagSet = {
  metaDataTagType: WayfairMediaMetaDataTagTypeInput;
  metaDataTags: WayfairMediaMetaDataTag[];
};

export type WayfairMediaDocumentTypeInput = "DOCUMENT" | "LEGAL_DOCUMENT";

export type WayfairMediaDocumentInput = {
  mediaDocumentType: WayfairMediaDocumentTypeInput;
  documentUrl: string;
  documentTypes: string[];
  regionType: string;
  language: string;
};

export type WayfairMediaInput = {
  images?: string[] | null;
  videos?: string[] | null;
  documents?: WayfairMediaDocumentInput[] | null;
};

export type WayfairAnswer = {
  questionId: string;
  value: string;
  parentRank?: number;
  rank?: number;
};

export type WayfairProductPartWithAnswers = {
  supplierPartNumber: string;
  answers: WayfairAnswer[];
  manufacturerId?: string | null;
  manufacturerName?: string | null;
  amazonStandardIdentificationNumber?: string | null;
  collectionName?: string | null;
  manufacturerPartNumber?: string | null;
  manufacturerProductUrl?: string | null;
  productName?: string | null;
  universalProductCode?: string | null;
  featureBullets?: string[] | null;
  marketingCopy?: string | null;
  media?: WayfairMediaInput | null;
  ignoreWarnings?: boolean | null;
};

export type WayfairSubmitProductAdditionRequest = {
  classId: number;
  marketContext: WayfairMarketContextInput;
  parts: WayfairProductPartWithAnswers[];
};

export type WayfairSubmitProductAdditionsRequest = {
  supplierId: string;
  proposedProductAdditions: WayfairSubmitProductAdditionRequest[];
  ignoreWarnings?: boolean | null;
  rejectAllOnErrors?: boolean | null;
};

export type WayfairSubmitProductAdditionsResponse = {
  requestIds: string[];
};

export type WayfairOperationStatus = "SUCCEEDED" | "FAILED";

export type WayfairValidationFlawType = "ERROR" | "WARNING";

export type WayfairValidationFlaw = {
  questionId: string;
  flawType: WayfairValidationFlawType;
  flaw: string;
  parentRank?: number | null;
  rank?: number | null;
};

export type WayfairProductAdditionStatus =
  | "VALIDATING"
  | "VALIDATED"
  | "SUBMITTING"
  | "SUBMITTED"
  | "PROCESSING"
  | "LIVE";

export type WayfairProductAdditionSubmission = {
  requestId: string;
  supplierId: string;
  supplierPartNumber?: string | null;
  classId: number;
  marketContext: { locale: string; country: string; brand: string };
  status: WayfairProductAdditionStatus;
  validationStatus?: WayfairOperationStatus | null;
  submissionStatus?: WayfairOperationStatus | null;
  validationFlaws: WayfairValidationFlaw[];
};
