"use strict";

const os = require("os");
const path = require("path");

const SERVICE_URL = "http://127.0.0.1:3999";
const SERVER_URL = "http://127.0.0.1:4000/status";
const WEB_URL = "http://127.0.0.1:3000";
const LOG_FILE = path.join(os.tmpdir(), "wayfo-service.log");
const LOG_ERR_FILE = path.join(os.tmpdir(), "wayfo-service.err.log");

module.exports = {
  SERVICE_URL,
  SERVER_URL,
  WEB_URL,
  LOG_FILE,
  LOG_ERR_FILE,
};
