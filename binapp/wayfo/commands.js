"use strict";

const path = require("path");
const { execSync } = require("child_process");
const { SERVICE_URL, LOG_FILE, LOG_ERR_FILE } = require("./constants");
const { log, banner } = require("./logger");
const { requestUrl } = require("./http");
const { isRunning, isChildrenHealthy, getChildrenHealthStatus } = require("./health");
const { ensureLogFiles, delay } = require("./fs-utils");
const {
  ensureYarn,
  ensureServiceBuild,
  ensureServiceBuildAlways,
  deleteServerWebBuilds,
} = require("./build");
const { streamLogs } = require("./logs");
const {
  startService,
  waitForService,
  waitForServiceStop,
  waitForChildrenHealthy,
} = require("./service");

async function launch(isDev) {
  banner();
  if (await isRunning()) {
    if (await isChildrenHealthy()) {
      log("Wayfo service already running. Attaching logs...");
      await streamLogs();
      return;
    }
    log("Wayfo service is running but unhealthy. Restarting...");
    await requestUrl(`${SERVICE_URL}/stop`, { method: "POST", timeoutMs: 1000 }).catch(() => null);
    await waitForServiceStop();
  }

  log("Starting Wayfo service...");
  ensureLogFiles(LOG_FILE, LOG_ERR_FILE);
  ensureYarn();
  if (!isDev) {
    ensureServiceBuild();
  } else {
    log("Dev mode enabled. Skipping production build checks.");
  }
  startService(isDev);
  log(`Service log: ${LOG_FILE}`);
  log(`Service error log: ${LOG_ERR_FILE}`);

  await waitForService();
  await waitForChildrenHealthy(isDev);
  await streamLogs();
}

async function stop() {
  if (!(await isRunning())) {
    log("Wayfo service is not running.");
    process.exit(1);
  }
  const err = await requestUrl(`${SERVICE_URL}/stop`, {
    method: "POST",
    timeoutMs: 3000,
  }).catch((e) => e);
  if (err instanceof Error) {
    log("Stop request failed: " + (err.message || err));
    log("Waiting for service to stop...");
  } else {
    log("Stop request sent.");
  }
  await waitForServiceStop();
  log("Wayfo service stopped.");
}

async function update() {
  if (await isRunning()) {
    log("Stopping Wayfo service...");
    await requestUrl(`${SERVICE_URL}/stop`, { method: "POST", timeoutMs: 1000 }).catch(() => null);
    await delay(1000);
  }
  execSync("git pull", { stdio: "inherit" });
  try {
    execSync("yarn install", { stdio: "inherit" });
  } catch {
    log("yarn install failed, continuing update...");
  }
  log("Removing server and web production builds...");
  deleteServerWebBuilds();
  log("Restarting Wayfo service...");
  ensureLogFiles(LOG_FILE, LOG_ERR_FILE);
  ensureYarn();
  ensureServiceBuildAlways();
  startService(false);
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  }
  return `${bytes} B`;
}

async function status() {
  if (!(await isRunning())) {
    log("Wayfo service is not running.");
    return;
  }
  try {
    const res = await requestUrl(`${SERVICE_URL}/status`, { timeoutMs: 2000 });
    if (res.statusCode < 200 || res.statusCode >= 300) {
      log("Wayfo service is running.");
      return;
    }
    const data = JSON.parse(res.body || "{}");
    log("Wayfo service is running.");
    log("");
    log("Process IDs:");
    log(`  Service: ${data.servicePid ?? "—"}`);
    log(`  Server:  ${data.children?.serverPid ?? "—"}`);
    log(`  Web:     ${data.children?.webPid ?? "—"}`);
    log("");
    log("Mode: " + (data.mode ?? "—"));
    if (data.startedAt) {
      const started = new Date(data.startedAt);
      const uptime = Math.floor((Date.now() - started.getTime()) / 1000);
      const hours = Math.floor(uptime / 3600);
      const mins = Math.floor((uptime % 3600) / 60);
      const secs = uptime % 60;
      const uptimeStr = hours > 0 ? `${hours}h ${mins}m ${secs}s` : mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
      log("Started: " + started.toLocaleString() + " (uptime: " + uptimeStr + ")");
    }
    if (data.memory) {
      log("");
      log("Memory:");
      if (data.memory.service) {
        const s = data.memory.service;
        log(`  Service: RSS ${formatBytes(s.rss ?? 0)}, heap ${formatBytes(s.heapUsed ?? 0)} / ${formatBytes(s.heapTotal ?? 0)}`);
      }
      if (data.memory.system) {
        const sys = data.memory.system;
        const used = sys.used ?? (sys.total - sys.free);
        const pct = sys.total > 0 ? ((used / sys.total) * 100).toFixed(1) : "—";
        log(`  System:  ${formatBytes(used)} / ${formatBytes(sys.total ?? 0)} (${pct}% used)`);
      }
    }
  } catch (err) {
    log("Wayfo service is running.");
    log("(Could not fetch detailed status: " + (err?.message ?? err) + ")");
  }
}

function info() {
  banner();
  const pkgPath = path.join(process.cwd(), "package.json");
  let pkg = {};
  try {
    pkg = require(pkgPath);
  } catch {
    // ignore
  }
  let repo = pkg.repository?.url ?? pkg.repository ?? "";
  if (typeof repo === "object" && repo.url) repo = repo.url;
  if (!repo) {
    try {
      repo = execSync("git remote get-url origin", { encoding: "utf8" }).trim();
    } catch {
      repo = "—";
    }
  }
  const license = pkg.license || "—";
  const author = pkg.author || "—";
  log("Project:  " + (pkg.name || "wayfo"));
  log("Repo:     " + repo);
  log("License:  " + license);
  log("Author:   " + author);
}

function usage() {
  log("Usage: wayfo <launch|stop|update|status|info> [--dev]");
  process.exit(1);
}

async function main() {
  process.chdir(path.resolve(__dirname, "..", ".."));
  const args = process.argv.slice(2);
  if (args.length === 0) usage();
  const command = args[0].toLowerCase();
  const isDev = args[1] && args[1].toLowerCase() === "--dev";

  switch (command) {
    case "launch":
      await launch(isDev);
      break;
    case "stop":
      await stop();
      break;
    case "update":
      await update();
      break;
    case "status":
      await status();
      break;
    case "info":
      info();
      break;
    default:
      usage();
  }
}

module.exports = { main };
