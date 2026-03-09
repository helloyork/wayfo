"use strict";

const http = require("http");
const { SERVICE_URL } = require("./constants");
const { log } = require("./logger");

async function streamLogs() {
  return new Promise((resolve, reject) => {
    const req = http.get(`${SERVICE_URL}/logs/stream`, (res) => {
      res.setEncoding("utf8");
      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk;
        let index = buffer.indexOf("\n");
        while (index !== -1) {
          const line = buffer.slice(0, index).trimEnd();
          buffer = buffer.slice(index + 1);
          if (line.startsWith("data:")) {
            const json = line.slice(5).trim();
            if (json) {
              try {
                const entry = JSON.parse(json);
                const time = new Date(Number(entry.ts)).toLocaleTimeString("en-GB", { hour12: false });
                const source = String(entry.source || "");
                const text = entry.line != null ? String(entry.line) : "";
                log(`[${time}][${source}] ${text}`);
              } catch {
                log(line);
              }
            }
          }
          index = buffer.indexOf("\n");
        }
      });
      res.on("end", resolve);
    });
    req.on("error", reject);
  });
}

module.exports = { streamLogs };
