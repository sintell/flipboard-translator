#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const targetDirs = [
  path.join(rootDir, "chrome", "src"),
  path.join(rootDir, "firefox", "src"),
];

for (const targetDir of targetDirs) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}

console.log("Removed generated browser src directories");
