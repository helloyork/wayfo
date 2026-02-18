import { Router, Response } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { RunEvent } from "@wayfo/shared";
import { eventBus } from "../../core/events/eventBus";
import { log } from "../../core/logger";
import {
  createRun,
  getRun,
  listArtifacts,
  listJobs,
  listRuns,
  updateRun
} from "../../core/store/runStore";
import { startRun } from "../../orchestrator/orchestrator";

export const runsRouter = Router();

const createRunSchema = z.object({
  amazonUrl: z.string().min(1),
  marketContext: z.string().optional()
});

const actionSchema = z.object({
  action: z.enum(["pause", "resume", "cancel"])
});

function sendError(
  res: Response,
  input: { code: string; message: string; retryable?: boolean; suggestion?: string },
  status = 400
) {
  res.status(status).json({
    code: input.code,
    message: input.message,
    retryable: input.retryable ?? false,
    suggestion: input.suggestion
  });
}

runsRouter.post("/", async (req, res) => {
  const parsed = createRunSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_INPUT",
      message: "amazonUrl is required"
    });
  }

  const run = createRun(parsed.data);
  startRun(run).catch((error) => {
    log({
      level: "error",
      runId: run.id,
      message: "Run failed",
      err: error
    });
    updateRun(run.id, { status: "FAILED" });
    eventBus.emit({
      id: nanoid(),
      type: "RUN_FAILED",
      runId: run.id,
      message: "Run failed",
      timestamp: new Date().toISOString()
    });
  });

  res.status(201).json(run);
});

runsRouter.get("/", (_req, res) => {
  res.json(listRuns());
});

runsRouter.get("/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(res, {
      code: "RUN_NOT_FOUND",
      message: "Run not found"
    }, 404);
  }

  res.json({
    run,
    jobs: listJobs(run.id),
    artifacts: listArtifacts(run.id)
  });
});

runsRouter.get("/:runId/artifacts", (req, res) => {
  res.json(listArtifacts(req.params.runId));
});

runsRouter.post("/:runId/actions", (req, res) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, {
      code: "INVALID_ACTION",
      message: "action must be pause, resume, or cancel"
    });
  }

  const run = getRun(req.params.runId);
  if (!run) {
    return sendError(res, {
      code: "RUN_NOT_FOUND",
      message: "Run not found"
    }, 404);
  }

  const action = parsed.data.action;
  const nextStatus =
    action === "pause" ? "PAUSED" : action === "resume" ? "RUNNING" : "CANCELLED";
  const updated = updateRun(run.id, { status: nextStatus });

  const event: RunEvent = {
    id: nanoid(),
    type: "RUN_PROGRESS",
    runId: run.id,
    message: `Run ${action}d`,
    data: { status: updated.status },
    timestamp: new Date().toISOString()
  };
  eventBus.emit(event);
  res.json(updated);
});

runsRouter.get("/:runId/events", (req, res) => {
  const runId = req.params.runId;
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  res.write("event: ready\n");
  res.write("data: {}\n\n");

  const run = getRun(runId);
  if (run) {
    const initEvent: RunEvent = {
      id: nanoid(),
      type: "RUN_PROGRESS",
      runId,
      data: { status: run.status, currentStep: run.currentStep },
      timestamp: new Date().toISOString()
    };
    res.write(`data: ${JSON.stringify(initEvent)}\n\n`);
  }

  const unsubscribe = eventBus.subscribe(runId, (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  });

  const keepAlive = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    unsubscribe();
  });
});
