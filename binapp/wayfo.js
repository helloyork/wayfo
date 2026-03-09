#!/usr/bin/env node
"use strict";

const { main } = require("./wayfo/commands");

main().catch((err) => {
  process.stdout.write(String(err && err.message ? err.message : err) + "\n");
  process.exit(1);
});
