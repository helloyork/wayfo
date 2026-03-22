import { z } from "zod";

export const RunStatusSchema = z.enum([
  "INITIALIZING",
  "PENDING",
  "RUNNING",
  "PAUSED",
  "CANCELLED",
  "FAILED",
  "COMPLETED",
  "NEEDS_REVIEW",
  "WAITING_FOR_REVIEW"
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const JobStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "SKIPPED",
  "CANCELLED"
]);
export type JobStatus = z.infer<typeof JobStatusSchema>;

export const StepSchema = z.enum([
  "SCRAPE_AMAZON",
  "DIMENSION_ENRICH",
  "WAYFAIR_CLASSIFY",
  "IMAGE_PLAN",
  "IMAGE_GENERATE",
  "IMAGE_UPLOAD",
  "WAYFAIR_DISCOVERY",
  "WAYFAIR_SUBMIT",
  "WAYFAIR_POLL"
]);
export type Step = z.infer<typeof StepSchema>;

export const ArtifactSchema = z.object({
  id: z.string(),
  runId: z.string(),
  jobId: z.string().optional(),
  type: z.string(),
  path: z.string(),
  contentHash: z.string().optional(),
  schemaVersion: z.string(),
  createdAt: z.string()
});
export type Artifact = z.infer<typeof ArtifactSchema>;

export const JobSchema = z.object({
  id: z.string(),
  runId: z.string(),
  step: StepSchema,
  status: JobStatusSchema,
  inputHash: z.string(),
  schemaVersion: z.string().optional(),
  attempts: z.number(),
  errorSummary: z.string().optional(),
  artifactIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Job = z.infer<typeof JobSchema>;

/** Optional per-step prompt injection (e.g. Wayfair catalog answer hints). */
export const AgentModifiersSchema = z.object({
  wayfairAnswers: z.array(z.string()).optional()
});
export type AgentModifiers = z.infer<typeof AgentModifiersSchema>;

/** Limits for Wayfair answer prompt modifier blocks (aligned with server enforcement). */
export const WAYFAIR_ANSWERS_MODIFIER_MAX_ITEMS = 20;
export const WAYFAIR_ANSWERS_MODIFIER_MAX_CHARS_PER_ITEM = 4000;
export const WAYFAIR_ANSWERS_MODIFIER_MAX_TOTAL_CHARS = 12000;

export const RunSchema = z.object({
  id: z.string(),
  amazonUrl: z.string(),
  marketContext: z.string().optional(),
  manufacturerId: z.string().optional(),
  enumerateVariants: z.boolean().optional(),
  groupId: z.string().optional(),
  planItemId: z.string().optional(),
  agentModifiers: AgentModifiersSchema.optional(),
  status: RunStatusSchema,
  currentStep: StepSchema.optional(),
  costUsd: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Run = z.infer<typeof RunSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  retryable: z.boolean().default(false),
  suggestion: z.string().optional()
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export const EventTypeSchema = z.enum([
  "RUN_STARTED",
  "RUN_PROGRESS",
  "RUN_FAILED",
  "RUN_COMPLETED",
  "JOB_STARTED",
  "JOB_PROGRESS",
  "JOB_FAILED",
  "RUN_INITIALIZING",
  "WAITING_FOR_REVIEW",
  "NEEDS_REVIEW",
  "LOG"
]);
export type EventType = z.infer<typeof EventTypeSchema>;

export const RunEventSchema = z.object({
  id: z.string(),
  type: EventTypeSchema,
  runId: z.string(),
  jobId: z.string().optional(),
  step: StepSchema.optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
  timestamp: z.string()
});
export type RunEvent = z.infer<typeof RunEventSchema>;

export const AgentResultSchema = z.object({
  data: z.unknown(),
  confidence: z.number().optional(),
  evidence: z.unknown().optional(),
  model: z.string().optional(),
  cost: z.unknown().optional(),
  errors: z.unknown().optional()
});
export type AgentResult = z.infer<typeof AgentResultSchema>;

export const WayfairEnvSchema = z.enum(["sandbox", "prod"]);
export type WayfairEnv = z.infer<typeof WayfairEnvSchema>;

export type {
  WayfairAnswer,
  WayfairBrandAssociationsPageInfo,
  WayfairBrandAssociationsResponse,
  WayfairBrandInput,
  WayfairCountryInput,
  WayfairMarketContextInput,
  WayfairMediaDocumentInput,
  WayfairMediaDocumentTypeInput,
  WayfairMediaInput,
  WayfairMediaMetaDataTag,
  WayfairMediaMetaDataTagSet,
  WayfairMediaMetaDataTagTypeInput,
  WayfairOperationStatus,
  WayfairPossibleAnswer,
  WayfairProductAdditionQuestion,
  WayfairProductAdditionStatus,
  WayfairProductAdditionSubmission,
  WayfairProductPartWithAnswers,
  WayfairQuestionAnswerType,
  WayfairQuestionImportanceType,
  WayfairSubmitProductAdditionRequest,
  WayfairSubmitProductAdditionsRequest,
  WayfairSubmitProductAdditionsResponse,
  WayfairSupplierBrandAssociation,
  WayfairValidationFlaw,
  WayfairValidationFlawType
} from "./wayfair";

export type {
  HasDataAmazonProductResponse,
  HasDataBadges,
  HasDataPrice,
  HasDataProduct,
  HasDataRequestMetadata,
  HasDataReview,
  HasDataReviewAspect,
  HasDataReviewsInfo,
  HasDataSpecificationEntry,
  HasDataVariant
} from "./hasdata";
