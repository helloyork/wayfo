"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { log } = require("./logger");
const { removeDirIfExists } = require("./fs-utils");

function ensureYarn() {
  const result = spawnSync("where", ["yarn"], { stdio: "ignore", shell: true });
  if (result.status !== 0) {
    log("Yarn not found in PATH.");
    process.exit(1);
  }
}

function runWorkspaceBuild(name) {
  const result = spawnSync("yarn", ["workspace", name, "build"], { stdio: "inherit", shell: true });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function ensureServiceBuild() {
  const needBuild = {
    shared: !fs.existsSync(path.join("packages", "shared", "dist", "index.js")),
    server: !fs.existsSync(path.join("apps", "server", "dist", "index.js")),
    web: !fs.existsSync(path.join("apps", "web", ".next", "BUILD_ID")),
    service: !fs.existsSync(path.join("apps", "service", "dist", "index.js")),
  };

  if (!needBuild.shared && !needBuild.server && !needBuild.web && !needBuild.service) {
    return;
  }

  log("Production build artifacts not found. Building required workspaces...");
  if (needBuild.shared) runWorkspaceBuild("@wayfo/shared");
  if (needBuild.server) runWorkspaceBuild("@wayfo/server");
  if (needBuild.web) runWorkspaceBuild("@wayfo/web");
  if (needBuild.service) runWorkspaceBuild("@wayfo/service");
}

function ensureServiceBuildAlways() {
  log("Building shared...");
  runWorkspaceBuild("@wayfo/shared");
  log("Building server...");
  runWorkspaceBuild("@wayfo/server");
  log("Building web...");
  runWorkspaceBuild("@wayfo/web");
  log("Building service...");
  runWorkspaceBuild("@wayfo/service");
}

function deleteServerWebBuilds() {
  removeDirIfExists(path.join("apps", "server", "dist"));
  removeDirIfExists(path.join("apps", "web", ".next"));
}

module.exports = {
  ensureYarn,
  ensureServiceBuild,
  ensureServiceBuildAlways,
  runWorkspaceBuild,
  deleteServerWebBuilds,
};
