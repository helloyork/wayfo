import { nanoid } from "nanoid";
import { Run, RunEvent, Step } from "@wayfo/shared";
import { eventBus } from "../core/events/eventBus";
import { log } from "../core/logger";
import {
  createArtifact,
  createJob,
  hashInput,
  updateJob,
  updateRun
} from "../core/store/runStore";

const mockSteps: Step[] = ["SCRAPE_AMAZON", "WAYFAIR_DISCOVERY"];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emit(event: RunEvent) {
  eventBus.emit(event);
}

export async function startRun(run: Run) {
  const updated = updateRun(run.id, { status: "RUNNING", currentStep: undefined });
  emit({
    id: nanoid(),
    type: "RUN_STARTED",
    runId: updated.id,
    timestamp: new Date().toISOString()
  });
  log({ level: "info", runId: run.id, message: "Run started" });

  for (const step of mockSteps) {
    await runStep(updated.id, step);
  }

  const completed = updateRun(run.id, {
    status: "COMPLETED",
    currentStep: undefined
  });
  emit({
    id: nanoid(),
    type: "RUN_COMPLETED",
    runId: completed.id,
    timestamp: new Date().toISOString()
  });
  log({ level: "info", runId: run.id, message: "Run completed" });
}

async function runStep(runId: string, step: Step) {
  updateRun(runId, { currentStep: step });
  const inputHash = hashInput({ runId, step, version: "mock" });
  const job = createJob({ runId, step, inputHash });

  emit({
    id: nanoid(),
    type: "JOB_STARTED",
    runId,
    jobId: job.id,
    step,
    timestamp: new Date().toISOString()
  });
  log({ level: "info", runId, jobId: job.id, step, message: "Job started" });

  updateJob(runId, job.id, { status: "RUNNING", attempts: 1 });
  await sleep(500);

  createArtifact({
    runId,
    jobId: job.id,
    type: `mock/${step.toLowerCase()}`,
    relativePath: `mock/${step.toLowerCase()}.json`,
    content: {
      step,
      ok: true,
      generatedAt: new Date().toISOString()
    }
  });

  updateJob(runId, job.id, { status: "SUCCEEDED" });
  emit({
    id: nanoid(),
    type: "JOB_PROGRESS",
    runId,
    jobId: job.id,
    step,
    message: "Mock artifact generated",
    timestamp: new Date().toISOString()
  });
  log({
    level: "info",
    runId,
    jobId: job.id,
    step,
    message: "Job succeeded"
  });
}
