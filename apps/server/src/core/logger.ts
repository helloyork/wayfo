import fs from "fs";
import path from "path";
import { ensureDir, runsRoot } from "./paths";

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  runId?: string;
  jobId?: string;
  step?: string;
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
}
