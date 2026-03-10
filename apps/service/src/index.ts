import http from "http";
import os from "os";
import path from "path";
import { spawn, execSync, ChildProcessWithoutNullStreams } from "child_process";
import readline from "readline";
import { URL } from "url";

type Mode = "dev" | "prod";
type LogEntry = {
  ts: number;
  source: string;
  line: string;
};

const CONTROL_PORT = 3999;
const LOG_BUFFER_LIMIT = 500;

const mode: Mode = process.argv.includes("--dev") ? "dev" : "prod";
const rootDir = path.resolve(__dirname, "..", "..", "..");

let serverProc: ChildProcessWithoutNullStreams | null = null;
let webProc: ChildProcessWithoutNullStreams | null = null;
let shuttingDown = false;
const startedAt = new Date().toISOString();

const logBuffer: LogEntry[] = [];
const sseClients = new Set<http.ServerResponse>();

function pushLog(entry: LogEntry) {
  logBuffer.push(entry);
  if (logBuffer.length > LOG_BUFFER_LIMIT) {
    logBuffer.shift();
  }
  const payload = JSON.stringify(entry);
  for (const res of sseClients) {
    res.write(`data: ${payload}\n\n`);
  }
}

function logService(line: string) {
  const entry: LogEntry = { ts: Date.now(), source: "service", line };
  pushLog(entry);
}

function attachLogs(source: string, proc: ChildProcessWithoutNullStreams) {
  const stdoutRl = readline.createInterface({ input: proc.stdout });
  const stderrRl = readline.createInterface({ input: proc.stderr });

  stdoutRl.on("line", (line) => pushLog({ ts: Date.now(), source, line }));
  stderrRl.on("line", (line) => pushLog({ ts: Date.now(), source, line }));

  proc.on("exit", (code, signal) => {
    logService(`${source} exited (code=${code ?? "null"}, signal=${signal ?? "null"})`);
  });
}

function spawnWorkspace(name: string, args: string[]) {
  const proc = spawn("yarn", args, {
    cwd: rootDir,
    env: { ...process.env },
    shell: true,
  });
  attachLogs(name, proc);
  logService(`${name} started (pid=${proc.pid ?? "unknown"})`);
  return proc;
}

function startChildren() {
  if (!serverProc) {
    const serverArgs =
      mode === "dev"
        ? ["workspace", "@wayfo/server", "dev"]
        : ["workspace", "@wayfo/server", "start"];
    serverProc = spawnWorkspace("server", serverArgs);
  }
  if (!webProc) {
    const webArgs =
      mode === "dev"
        ? ["workspace", "@wayfo/web", "dev", "-H", "0.0.0.0"]
        : ["workspace", "@wayfo/web", "start"];
    webProc = spawnWorkspace("web", webArgs);
  }
}

function killProcessTree(proc: ChildProcessWithoutNullStreams) {
  const pid = proc.pid;
  if (pid == null) return;
  try {
    if (process.platform === "win32") {
      // On Windows, proc.kill() does not terminate child processes spawned via shell.
      // Use taskkill /F /T to kill the process tree.
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: "ignore" });
    } else {
      proc.kill("SIGTERM");
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill("SIGKILL");
        }
      }, 5000);
    }
  } catch {
    // Process may already be dead
  }
}

function stopChildren() {
  const children = [serverProc, webProc].filter(
    (proc): proc is ChildProcessWithoutNullStreams => Boolean(proc)
  );

  for (const proc of children) {
    killProcessTree(proc);
  }
  serverProc = null;
  webProc = null;
}

function json(res: http.ServerResponse, status: number, data: object) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function handleStatus(res: http.ServerResponse) {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  json(res, 200, {
    running: true,
    mode,
    servicePid: process.pid,
    startedAt,
    memory: {
      service: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
      },
      system: {
        total: totalMem,
        free: freeMem,
        used: totalMem - freeMem,
      },
    },
    children: {
      serverPid: serverProc?.pid ?? null,
      webPid: webProc?.pid ?? null,
    },
  });
}

function handleLogsStream(req: http.IncomingMessage, res: http.ServerResponse) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  for (const entry of logBuffer) {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  }
  sseClients.add(res);
  req.on("close", () => {
    sseClients.delete(res);
  });
}

function handleStop(res: http.ServerResponse) {
  if (shuttingDown) {
    json(res, 200, { ok: true, message: "Already stopping." });
    return;
  }
  shuttingDown = true;
  json(res, 200, { ok: true, message: "Stopping Wayfo service." });
  logService("Stop requested.");
  stopChildren();
  setTimeout(() => {
    process.exit(0);
  }, 300);
}

const server = http.createServer((req, res) => {
  if (!req.url || !req.method) {
    json(res, 400, { ok: false, message: "Invalid request." });
    return;
  }
  const url = new URL(req.url, `http://${req.headers.host ?? "127.0.0.1"}`);

  if (req.method === "GET" && url.pathname === "/status") {
    handleStatus(res);
    return;
  }
  if (req.method === "GET" && url.pathname === "/logs/stream") {
    handleLogsStream(req, res);
    return;
  }
  if (req.method === "POST" && url.pathname === "/stop") {
    handleStop(res);
    return;
  }

  json(res, 404, { ok: false, message: "Not found." });
});

server.listen(CONTROL_PORT, () => {
  logService(`Wayfo service listening on http://127.0.0.1:${CONTROL_PORT}`);
  startChildren();
});
