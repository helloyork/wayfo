"use strict";

const fs = require("fs");

function ensureLogFiles(logFile, logErrFile) {
  fs.writeFileSync(logFile, "");
  fs.writeFileSync(logErrFile, "");
}

function tailFile(filePath, lineCount) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  return lines.slice(-lineCount).join("\n");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function removeDirIfExists(targetPath) {
  if (fs.existsSync(targetPath)) {
    fs.rmSync(targetPath, { recursive: true, force: true });
  }
}

module.exports = {
  ensureLogFiles,
  tailFile,
  delay,
  removeDirIfExists,
};
