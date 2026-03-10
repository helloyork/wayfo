"use strict";

const path = require("path");
const { execSync } = require("child_process");
const { SERVICE_URL, LOG_FILE, LOG_ERR_FILE } = require("./constants");
const { log, banner } = require("./logger");
const { requestUrl } = require("./http");
const { isRunning, isChildrenHealthy } = require("./health");
const { ensureLogFiles, delay } = require("./fs-utils");
const {
  ensureYarn,
  ensureServiceBuild,
  ensureServiceBuildAlways,
  deleteServerWebBuilds,
} = require("./build");
const { streamLogs } = require("./logs");
const { startService, waitForService, waitForServiceStop, waitForChildrenHealthy } = require("./service");

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
  await waitForChildrenHealthy();
  await streamLogs();
}

async function stop() {
  if (!(await isRunning())) {
    log("Wayfo service is not running.");
    process.exit(1);
  }
  await requestUrl(`${SERVICE_URL}/stop`, { method: "POST", timeoutMs: 1000 }).catch(() => null);
  log("Stop request sent.");
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

async function status() {
  if (await isRunning()) {
    log("Wayfo service is running.");
  } else {
    log("Wayfo service is not running.");
  }
}

function usage() {
  log("Usage: wayfo <launch|stop|update|status> [--dev]");
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
    default:
      usage();
  }
}

module.exports = { main };
