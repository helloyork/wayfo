"use strict";

const { requestUrl } = require("./http");
const { SERVICE_URL, SERVER_URL, WEB_URL } = require("./constants");

async function isRunning() {
  try {
    const res = await requestUrl(`${SERVICE_URL}/status`, { timeoutMs: 1000 });
    return res.statusCode >= 200 && res.statusCode < 300;
  } catch {
    return false;
  }
}

async function isChildrenHealthy() {
  const checks = await Promise.allSettled([
    requestUrl(SERVER_URL, { timeoutMs: 2000 }),
    requestUrl(WEB_URL, { timeoutMs: 2000 }),
  ]);
  const serverOk = checks[0].status === "fulfilled" && checks[0].value.statusCode >= 200 && checks[0].value.statusCode < 300;
  const webOk = checks[1].status === "fulfilled" && checks[1].value.statusCode >= 200 && checks[1].value.statusCode < 400;
  return serverOk && webOk;
}

async function getChildrenHealthStatus() {
  const [serverRes, webRes] = await Promise.all([
    requestUrl(SERVER_URL, { timeoutMs: 2000 }).then(
      (r) => ({ ok: r.statusCode >= 200 && r.statusCode < 300, status: r.statusCode }),
      (e) => ({ ok: false, error: e?.message ?? String(e) })
    ),
    requestUrl(WEB_URL, { timeoutMs: 2000 }).then(
      (r) => ({ ok: r.statusCode >= 200 && r.statusCode < 400, status: r.statusCode }),
      (e) => ({ ok: false, error: e?.message ?? String(e) })
    ),
  ]);
  return { server: serverRes, web: webRes };
}

module.exports = { isRunning, isChildrenHealthy, getChildrenHealthStatus };
