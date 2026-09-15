#!/usr/bin/env node
"use strict";

const { spawnSync } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const packageRoot = path.resolve(__dirname, "..");
const infoPath = path.join(packageRoot, "build-info.json");

if (!fs.existsSync(infoPath)) {
  console.error("Typers has not been built. Run node tooling/build-compiler.mjs from the repository.");
  process.exit(1);
}

const info = JSON.parse(fs.readFileSync(infoPath, "utf8"));
if (info.platform !== process.platform || info.arch !== process.arch) {
  console.error(`This local Typers package targets ${info.platform}/${info.arch}; current platform is ${process.platform}/${process.arch}. Rebuild it on this platform.`);
  process.exit(1);
}

const executable = path.join(packageRoot, "native", process.platform === "win32" ? "typers.exe" : "typers");
const result = spawnSync(executable, process.argv.slice(2), { stdio: "inherit" });
if (result.error) {
  console.error(`Could not start Typers: ${result.error.message}`);
  process.exit(1);
}
if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exit(result.status ?? 1);
}
