#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { getGeneratedSrcDirs } = require("./clean-utils");

const rootDir = path.resolve(__dirname, "..");
const targetDirs = getGeneratedSrcDirs(rootDir);

for (const targetDir of targetDirs) {
  fs.rmSync(targetDir, { recursive: true, force: true });
}

console.log("Removed generated browser src directories");
