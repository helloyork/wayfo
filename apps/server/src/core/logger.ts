import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { Step } from "@wayfo/shared";
import { ensureDir, runsRoot } from "./paths";
import { eventBus } from "./events/eventBus";

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  timestamp?: string;
  level: LogLevel;
  runId?: string;
  jobId?: string;
  step?: Step;
  message: string;
  err?: unknown;
};

export function log(entry: LogEntry) {
  const payload = { ...entry, timestamp: new Date().toISOString() };
  const line = JSON.stringify(payload);
  if (entry.level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }

  if (!entry.runId) {
    return;
  }

  const logsDir = path.join(runsRoot, entry.runId, "logs");
  ensureDir(logsDir);
  const filePath = path.join(logsDir, "run.jsonl");
  fs.appendFileSync(filePath, `${line}\n`);

  eventBus.emit({
    id: nanoid(),
    type: "LOG",
    runId: entry.runId,
    jobId: entry.jobId,
    step: entry.step,
    message: entry.message,
    data: {
      level: entry.level,
      err: entry.err
    },
    timestamp: payload.timestamp
  });
}
