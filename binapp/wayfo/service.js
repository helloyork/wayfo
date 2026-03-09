"use strict";

const fs = require("fs");
const { spawn } = require("child_process");
const { LOG_FILE, LOG_ERR_FILE } = require("./constants");
const { log } = require("./logger");
const { isRunning, isChildrenHealthy } = require("./health");
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

async function waitForChildrenHealthy() {
  for (let i = 0; i < 60; i += 1) {
    if (await isChildrenHealthy()) return;
    await delay(1000);
  }
  log("Server or web app did not become healthy within 60 seconds.");
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
