"use strict";

const fs = require("fs");
const { spawn } = require("child_process");
const { LOG_FILE, LOG_ERR_FILE, SERVER_URL, WEB_URL } = require("./constants");
const { log } = require("./logger");
const { isRunning, isChildrenHealthy, getChildrenHealthStatus } = require("./health");
const { delay, tailFile } = require("./fs-utils");

function startService(isDev) {
  const args = isDev
    ? ["/c", "yarn", "workspace", "@wayfo/service", "dev"]
    : ["/c", "yarn", "workspace", "@wayfo/service", "start"];
  const outFd = fs.openSync(LOG_FILE, "a");
  const errFd = fs.openSync(LOG_ERR_FILE, "a");
  const child = spawn("cmd.exe", args, {
    cwd: process.cwd(),
    detached: true,
    stdio: ["ignore", outFd, errFd],
    windowsHide: true,
  });
  child.unref();
}

async function waitForService() {
  for (let i = 0; i < 30; i += 1) {
    if (await isRunning()) return;
    await delay(1000);
  }
  log("Wayfo service did not start within 30 seconds.");
  showStartError();
  process.exit(1);
}

async function waitForServiceStop() {
  for (let i = 0; i < 30; i += 1) {
    if (!(await isRunning())) return;
    await delay(1000);
  }
  log("Wayfo service did not stop within 30 seconds.");
  process.exit(1);
}

async function waitForChildrenHealthy(isDev) {
  // Dev mode: Next.js compilation can take 30-60s. Prod: usually 10-20s.
  const maxWait = isDev ? 90 : 45;
  for (let i = 0; i < maxWait; i += 1) {
    if (await isChildrenHealthy()) return;
    await delay(1000);
  }
  const status = await getChildrenHealthStatus();
  log(`Server or web app did not become healthy within ${maxWait} seconds.`);
  log(`Server (${SERVER_URL}): ${status.server.ok ? "OK" : status.server.error ?? "status " + (status.server.status ?? "?")}`);
  log(`Web (${WEB_URL}): ${status.web.ok ? "OK" : status.web.error ?? "status " + (status.web.status ?? "?")}`);
  showStartError();
  process.exit(1);
}

function showStartError() {
  if (!fs.existsSync(LOG_FILE) && !fs.existsSync(LOG_ERR_FILE)) return;
  log("Last logs:");
  if (fs.existsSync(LOG_FILE)) log(tailFile(LOG_FILE, 200));
  if (fs.existsSync(LOG_ERR_FILE)) log(tailFile(LOG_ERR_FILE, 200));
}

module.exports = {
  startService,
  waitForService,
  waitForServiceStop,
  waitForChildrenHealthy,
  showStartError,
};
