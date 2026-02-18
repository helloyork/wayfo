import { z } from "zod";

export const RunStatusSchema = z.enum([
  "PENDING",
  "RUNNING",
  "PAUSED",
  "CANCELLED",
  "FAILED",
  "COMPLETED",
  "NEEDS_REVIEW"
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
  "IMAGE_CLASSIFY",
  "IMAGE_PLAN",
  "IMAGE_GENERATE",
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
  attempts: z.number(),
  errorSummary: z.string().optional(),
  artifactIds: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string()
});
export type Job = z.infer<typeof JobSchema>;

export const RunSchema = z.object({
  id: z.string(),
  amazonUrl: z.string(),
  marketContext: z.string().optional(),
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
