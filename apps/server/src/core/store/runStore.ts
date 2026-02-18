import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { nanoid } from "nanoid";
import {
  Artifact,
  Job,
  Run,
  RunStatus,
  Step
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
  createdAt: string;
  updatedAt: string;
};

type JobRow = {
  id: string;
  runId: string;
  step: Step;
  status: Job["status"];
  inputHash: string;
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

export function createRun(input: {
  amazonUrl: string;
  marketContext?: string;
}): Run {
  const now = new Date().toISOString();
  const id = nanoid();
  const run: Run = {
    id,
    amazonUrl: input.amazonUrl,
    marketContext: input.marketContext,
    status: "PENDING",
    createdAt: now,
    updatedAt: now
  };

  const runDir = path.join(runsRoot, id);
  ensureDir(runDir);
  writeJson(path.join(runDir, "run.json"), run);

  const db = getDb();
  db.prepare(
    `
      insert into runs (id, status, currentStep, amazonUrl, marketContext, createdAt, updatedAt)
      values (@id, @status, @currentStep, @amazonUrl, @marketContext, @createdAt, @updatedAt)
    `
  ).run({
    ...run,
    currentStep: null
  });

  return run;
}

export function listRuns(): Run[] {
  const db = getDb();
  const rows = db
    .prepare("select * from runs order by createdAt desc")
    .all() as RunRow[];
  return rows.map((row) => ({
    id: row.id,
    amazonUrl: row.amazonUrl,
    marketContext: row.marketContext ?? undefined,
    status: row.status,
    currentStep: row.currentStep ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }));
}

export function getRun(runId: string): Run | null {
  const runFile = path.join(runsRoot, runId, "run.json");
  const run = readJson<Run>(runFile);
  return run;
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
          updatedAt = @updatedAt
      where id = @id
    `
  ).run({
    id: next.id,
    status: next.status,
    currentStep: next.currentStep ?? null,
    amazonUrl: next.amazonUrl,
    marketContext: next.marketContext ?? null,
    updatedAt: next.updatedAt
  });

  return next;
}

export function createJob(input: {
  runId: string;
  step: Step;
  inputHash: string;
}): Job {
  const now = new Date().toISOString();
  const id = nanoid();
  const job: Job = {
    id,
    runId: input.runId,
    step: input.step,
    status: "PENDING",
    inputHash: input.inputHash,
    attempts: 0,
    artifactIds: [],
    createdAt: now,
    updatedAt: now
  };

  const jobPath = path.join(runsRoot, input.runId, "jobs", `${id}.json`);
  writeJson(jobPath, job);

  const db = getDb();
  db.prepare(
    `
      insert into jobs (id, runId, step, status, inputHash, attempts, errorSummary, createdAt, updatedAt)
      values (@id, @runId, @step, @status, @inputHash, @attempts, @errorSummary, @createdAt, @updatedAt)
    `
  ).run({
    id: job.id,
    runId: job.runId,
    step: job.step,
    status: job.status,
    inputHash: job.inputHash,
    attempts: job.attempts,
    errorSummary: null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt
  });

  return job;
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
          attempts = @attempts,
          errorSummary = @errorSummary,
          updatedAt = @updatedAt
      where id = @id
    `
  ).run({
    id: next.id,
    status: next.status,
    attempts: next.attempts,
    errorSummary: next.errorSummary ?? null,
    updatedAt: next.updatedAt
  });

  return next;
}

export function listJobs(runId: string): Job[] {
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
  writeJson(filePath, input.content);

  const artifact: Artifact = {
    id,
    runId: input.runId,
    jobId: input.jobId,
    type: input.type,
    path: filePath,
    schemaVersion,
    createdAt: now
  };

  const db = getDb();
  db.prepare(
    `
      insert into artifacts (id, runId, jobId, type, path, schemaVersion, createdAt)
      values (@id, @runId, @jobId, @type, @path, @schemaVersion, @createdAt)
    `
  ).run({
    id: artifact.id,
    runId: artifact.runId,
    jobId: artifact.jobId ?? null,
    type: artifact.type,
    path: artifact.path,
    schemaVersion: artifact.schemaVersion,
    createdAt: artifact.createdAt
  });

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
    schemaVersion: row.schemaVersion,
    createdAt: row.createdAt
  }));
}
