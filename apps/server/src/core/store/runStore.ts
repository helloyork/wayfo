import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import {
  AgentModifiersSchema,
  Artifact,
  Job,
  Run,
  RunStatus,
  Step,
  type AgentModifiers
} from "@wayfo/shared";
import { ensureDir, runsRoot } from "../paths";
import { getDb } from "./sqlite";

const schemaVersion = "v1";

type RunRow = {
  id: string;
  status: RunStatus;
  currentStep: Step | null;
  amazonUrl: string;
  marketContext: string | null;
  manufacturerId: string | null;
  enumerateVariants: number | null;
  groupId: string | null;
  planItemId: string | null;
  agentModifiersJson: string | null;
  createdAt: string;
  updatedAt: string;
};

type JobRow = {
  id: string;
  runId: string;
  step: Step;
  status: Job["status"];
  inputHash: string;
  schemaVersion: string | null;
  attempts: number;
  errorSummary: string | null;
  createdAt: string;
  updatedAt: string;
};

type ArtifactRow = {
  id: string;
  runId: string;
  jobId: string | null;
  type: string;
  path: string;
  contentHash: string | null;
  schemaVersion: string;
  createdAt: string;
};

function writeJson(filePath: string, data: unknown) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
}

export function hashInput(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function hashContent(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

function ensureRunDirs(runId: string) {
  ensureDir(path.join(runsRoot, runId));
  ensureDir(path.join(runsRoot, runId, "jobs"));
  ensureDir(path.join(runsRoot, runId, "artifacts"));
  ensureDir(path.join(runsRoot, runId, "logs"));
}

function parseAgentModifiersJson(raw: string | null | undefined): AgentModifiers | undefined {
  if (!raw?.trim()) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    const result = AgentModifiersSchema.safeParse(parsed);
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

function stringifyAgentModifiersJson(modifiers: AgentModifiers | undefined): string | null {
  if (!modifiers) {
    return null;
  }
  return JSON.stringify(modifiers);
}

function readRunFromDisk(runId: string) {
  const runFile = path.join(runsRoot, runId, "run.json");
  return readJson<Run>(runFile);
}

function readJobFromDisk(runId: string, jobId: string) {
  const jobPath = path.join(runsRoot, runId, "jobs", `${jobId}.json`);
  return readJson<Job>(jobPath);
}

function listJobsFromDisk(runId: string): Job[] {
  const jobsDir = path.join(runsRoot, runId, "jobs");
  if (!fs.existsSync(jobsDir)) {
    return [];
  }
  const entries = fs.readdirSync(jobsDir).filter((file) => file.endsWith(".json"));
  const jobs = entries
    .map((file) => readJson<Job>(path.join(jobsDir, file)))
    .filter(Boolean) as Job[];
  return jobs.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function appendArtifactToJob(runId: string, jobId: string, artifactId: string) {
  const jobPath = path.join(runsRoot, runId, "jobs", `${jobId}.json`);
  const current = readJson<Job>(jobPath);
  if (!current) {
    return;
  }
  if (current.artifactIds.includes(artifactId)) {
    return;
  }
  const next: Job = {
    ...current,
    artifactIds: [...current.artifactIds, artifactId],
    updatedAt: new Date().toISOString()
  };
  writeJson(jobPath, next);
}

export function createRun(input: {
  amazonUrl: string;
  marketContext?: string;
  manufacturerId?: string;
  enumerateVariants?: boolean;
  groupId?: string;
  planItemId?: string;
  agentModifiers?: AgentModifiers;
}): Run {
  const now = new Date().toISOString();
  const id = nanoid();
  const run: Run = {
    id,
    amazonUrl: input.amazonUrl,
    marketContext: input.marketContext,
    manufacturerId: input.manufacturerId,
    enumerateVariants: input.enumerateVariants ?? false,
    groupId: input.groupId,
    planItemId: input.planItemId,
    ...(input.agentModifiers ? { agentModifiers: input.agentModifiers } : {}),
    status: "PENDING",
    createdAt: now,
    updatedAt: now
  };

  ensureRunDirs(id);
  const runDir = path.join(runsRoot, id);
  writeJson(path.join(runDir, "run.json"), run);

  const db = getDb();
  db.prepare(
    `
      insert into runs (
        id,
        status,
        currentStep,
        amazonUrl,
        marketContext,
        manufacturerId,
        enumerateVariants,
        groupId,
        planItemId,
        agentModifiersJson,
        createdAt,
        updatedAt
      )
      values (
        @id,
        @status,
        @currentStep,
        @amazonUrl,
        @marketContext,
        @manufacturerId,
        @enumerateVariants,
        @groupId,
        @planItemId,
        @agentModifiersJson,
        @createdAt,
        @updatedAt
      )
    `
  ).run({
    ...run,
    currentStep: null,
    manufacturerId: run.manufacturerId ?? null,
    enumerateVariants: run.enumerateVariants ? 1 : 0,
    groupId: run.groupId ?? null,
    planItemId: run.planItemId ?? null,
    agentModifiersJson: stringifyAgentModifiersJson(run.agentModifiers)
  });

  return run;
}

export function listRuns(): Run[] {
  if (fs.existsSync(runsRoot)) {
    const dirs = fs
      .readdirSync(runsRoot)
      .map((entry) => path.join(runsRoot, entry))
      .filter((entry) => fs.statSync(entry).isDirectory());
    const runs = dirs
      .map((dir) => readJson<Run>(path.join(dir, "run.json")))
      .filter(Boolean) as Run[];
    if (runs.length > 0) {
      return runs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
  }
  const db = getDb();
  const rows = db
    .prepare("select * from runs order by createdAt desc")
    .all() as RunRow[];
  return rows.map((row) => {
    const agentModifiers = parseAgentModifiersJson(row.agentModifiersJson);
    return {
      id: row.id,
      amazonUrl: row.amazonUrl,
      marketContext: row.marketContext ?? undefined,
      manufacturerId: row.manufacturerId ?? undefined,
      enumerateVariants: row.enumerateVariants ? row.enumerateVariants === 1 : undefined,
      groupId: row.groupId ?? undefined,
      planItemId: row.planItemId ?? undefined,
      ...(agentModifiers ? { agentModifiers } : {}),
      status: row.status,
      currentStep: row.currentStep ?? undefined,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  });
}

export function getRun(runId: string): Run | null {
  return readRunFromDisk(runId);
}

export function hasRunForGroup(groupId: string): boolean {
  const db = getDb();
  const row = db
    .prepare("select id from runs where groupId = ? limit 1")
    .get(groupId) as { id: string } | undefined;
  return Boolean(row?.id);
}

export function updateRun(runId: string, patch: Partial<Run>): Run {
  const runFile = path.join(runsRoot, runId, "run.json");
  const current = readJson<Run>(runFile);
  if (!current) {
    throw new Error(`Run not found: ${runId}`);
  }
  const next: Run = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };

  writeJson(runFile, next);

  const db = getDb();
  db.prepare(
    `
      update runs
      set status = @status,
          currentStep = @currentStep,
          amazonUrl = @amazonUrl,
          marketContext = @marketContext,
          manufacturerId = @manufacturerId,
          enumerateVariants = @enumerateVariants,
          groupId = @groupId,
          planItemId = @planItemId,
          agentModifiersJson = @agentModifiersJson,
          updatedAt = @updatedAt
      where id = @id
    `
  ).run({
    id: next.id,
    status: next.status,
    currentStep: next.currentStep ?? null,
    amazonUrl: next.amazonUrl,
    marketContext: next.marketContext ?? null,
    manufacturerId: next.manufacturerId ?? null,
    enumerateVariants: next.enumerateVariants ? 1 : 0,
    groupId: next.groupId ?? null,
    planItemId: next.planItemId ?? null,
    agentModifiersJson: stringifyAgentModifiersJson(next.agentModifiers),
    updatedAt: next.updatedAt
  });

  return next;
}

export function createJob(input: {
  runId: string;
  step: Step;
  inputHash: string;
  schemaVersion?: string;
}): Job {
  const now = new Date().toISOString();
  const id = nanoid();
  const job: Job = {
    id,
    runId: input.runId,
    step: input.step,
    status: "PENDING",
    inputHash: input.inputHash,
    schemaVersion: input.schemaVersion,
    attempts: 0,
    artifactIds: [],
    createdAt: now,
    updatedAt: now
  };

  const jobPath = path.join(runsRoot, input.runId, "jobs", `${id}.json`);
  ensureRunDirs(input.runId);
  writeJson(jobPath, job);

  const db = getDb();
  db.prepare(
    `
      insert into jobs (id, runId, step, status, inputHash, schemaVersion, attempts, errorSummary, createdAt, updatedAt)
      values (@id, @runId, @step, @status, @inputHash, @schemaVersion, @attempts, @errorSummary, @createdAt, @updatedAt)
    `
  ).run({
    id: job.id,
    runId: job.runId,
    step: job.step,
    status: job.status,
    inputHash: job.inputHash,
    schemaVersion: job.schemaVersion ?? null,
    attempts: job.attempts,
    errorSummary: null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });

  return job;
}

export function getOrCreateJob(input: {
  runId: string;
  step: Step;
  inputHash: string;
  schemaVersion?: string;
}): { job: Job; reused: boolean } {
  const db = getDb();
  const row = input.schemaVersion
    ? (db
        .prepare(
          `
            select * from jobs
            where runId = @runId
              and step = @step
              and inputHash = @inputHash
              and schemaVersion = @schemaVersion
            order by createdAt desc
            limit 1
          `
        )
        .get({
          runId: input.runId,
          step: input.step,
          inputHash: input.inputHash,
          schemaVersion: input.schemaVersion
        }) as JobRow | undefined)
    : (db
        .prepare(
          `
            select * from jobs
            where runId = @runId
              and step = @step
              and inputHash = @inputHash
              and schemaVersion is null
            order by createdAt desc
            limit 1
          `
        )
        .get({
          runId: input.runId,
          step: input.step,
          inputHash: input.inputHash
        }) as JobRow | undefined);
  if (row) {
    const existing = readJobFromDisk(input.runId, row.id);
    if (existing) {
      return { job: existing, reused: true };
    }
    const restored: Job = {
      id: row.id,
      runId: row.runId,
      step: row.step,
      status: row.status,
      inputHash: row.inputHash,
      schemaVersion: row.schemaVersion ?? undefined,
      attempts: row.attempts,
      errorSummary: row.errorSummary ?? undefined,
      artifactIds: [],
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
    const jobPath = path.join(runsRoot, input.runId, "jobs", `${row.id}.json`);
    ensureRunDirs(input.runId);
    writeJson(jobPath, restored);
    return { job: restored, reused: true };
  }
  return { job: createJob(input), reused: false };
}

export function updateJob(
  runId: string,
  jobId: string,
  patch: Partial<Job>
): Job {
  const jobPath = path.join(runsRoot, runId, "jobs", `${jobId}.json`);
  const current = readJson<Job>(jobPath);
  if (!current) {
    throw new Error(`Job not found: ${jobId}`);
  }
  const next: Job = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  writeJson(jobPath, next);

  const db = getDb();
  db.prepare(
    `
      update jobs
      set status = @status,
          schemaVersion = @schemaVersion,
          attempts = @attempts,
          errorSummary = @errorSummary,
          updatedAt = @updatedAt
      where id = @id
    `
  ).run({
    id: next.id,
    status: next.status,
    schemaVersion: next.schemaVersion ?? null,
    attempts: next.attempts,
    errorSummary: next.errorSummary ?? null,
    updatedAt: next.updatedAt
  });

  return next;
}

export function listJobs(runId: string): Job[] {
  const fromDisk = listJobsFromDisk(runId);
  if (fromDisk.length > 0) {
    return fromDisk;
  }
  const db = getDb();
  const rows = db
    .prepare("select * from jobs where runId = ? order by createdAt asc")
    .all(runId) as JobRow[];
  return rows.map((row) => ({
    id: row.id,
    runId: row.runId,
    step: row.step,
    status: row.status,
    inputHash: row.inputHash,
    schemaVersion: row.schemaVersion ?? undefined,
    attempts: row.attempts,
    errorSummary: row.errorSummary ?? undefined,
    artifactIds: [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export function createArtifact(input: {
  runId: string;
  jobId?: string;
  type: string;
  relativePath: string;
  content: unknown;
}): Artifact {
  const now = new Date().toISOString();
  const id = nanoid();
  const filePath = path.join(runsRoot, input.runId, "artifacts", input.relativePath);
  const contentHash = hashContent(input.content);
  const db = getDb();
  const existing = db
    .prepare(
      `
        select * from artifacts
        where runId = @runId
          and type = @type
          and contentHash = @contentHash
        order by createdAt desc
        limit 1
      `
    )
    .get({
      runId: input.runId,
      type: input.type,
      contentHash
    }) as ArtifactRow | undefined;
  if (existing && fs.existsSync(existing.path)) {
    if (input.jobId) {
      appendArtifactToJob(input.runId, input.jobId, existing.id);
    }
    return {
      id: existing.id,
      runId: existing.runId,
      jobId: existing.jobId ?? undefined,
      type: existing.type,
      path: existing.path,
      contentHash: existing.contentHash ?? undefined,
      schemaVersion: existing.schemaVersion,
      createdAt: existing.createdAt
    };
  }

  ensureRunDirs(input.runId);
  writeJson(filePath, input.content);

  const artifact: Artifact = {
    id,
    runId: input.runId,
    jobId: input.jobId,
    type: input.type,
    path: filePath,
    contentHash,
    schemaVersion,
    createdAt: now
  };

  db.prepare(
    `
      insert into artifacts (id, runId, jobId, type, path, contentHash, schemaVersion, createdAt)
      values (@id, @runId, @jobId, @type, @path, @contentHash, @schemaVersion, @createdAt)
    `
  ).run({
    id: artifact.id,
    runId: artifact.runId,
    jobId: artifact.jobId ?? null,
    type: artifact.type,
    path: artifact.path,
    contentHash: artifact.contentHash ?? null,
    schemaVersion: artifact.schemaVersion,
    createdAt: artifact.createdAt
  });

  if (artifact.jobId) {
    appendArtifactToJob(artifact.runId, artifact.jobId, artifact.id);
  }

  return artifact;
}

export function listArtifacts(runId: string): Artifact[] {
  const db = getDb();
  const rows = db
    .prepare("select * from artifacts where runId = ? order by createdAt asc")
    .all(runId) as ArtifactRow[];
  return rows.map((row) => ({
    id: row.id,
    runId: row.runId,
    jobId: row.jobId ?? undefined,
    type: row.type,
    path: row.path,
    contentHash: row.contentHash ?? undefined,
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt
  }));
}
