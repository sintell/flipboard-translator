const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageLockPath = path.join(rootDir, "package-lock.json");
const chromeManifestPath = path.join(rootDir, "chrome", "manifest.json");
const firefoxManifestPath = path.join(rootDir, "firefox", "manifest.json");
const versionArg = process.argv[2] || "patch";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

function runGit(args) {
  return execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
  }).trim();
}

function fail(message) {
  console.error(`[release] ${message}`);
  process.exit(1);
}

function parseVersionParts(value) {
  const match = String(value).match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function getNextVersion(currentVersion, input) {
  const current = parseVersionParts(currentVersion);
  if (!current) {
    fail(`Unsupported current version format: ${currentVersion}`);
  }

  const explicit = parseVersionParts(input);
  if (explicit) {
    return input;
  }

  if (input === "patch") {
    return `${current.major}.${current.minor}.${current.patch + 1}`;
  }
  if (input === "minor") {
    return `${current.major}.${current.minor + 1}.0`;
  }
  if (input === "major") {
    return `${current.major + 1}.0.0`;
  }

  fail(`Release argument must be patch, minor, major, or an explicit x.y.z version. Received: ${input}`);
}

function ensureCleanGitTree() {
  const status = runGit(["status", "--porcelain"]);
  if (status) {
    fail("Git working tree must be clean before releasing.");
  }
}

function ensureTagDoesNotExist(tagName) {
  const existingTag = runGit(["tag", "-l", tagName]);
  if (existingTag === tagName) {
    fail(`Tag ${tagName} already exists.`);
  }
}

function updatePackageLockVersion(packageLock, nextVersion) {
  packageLock.version = nextVersion;
  if (packageLock.packages && packageLock.packages[""]) {
    packageLock.packages[""].version = nextVersion;
  }
}

function main() {
  ensureCleanGitTree();

  const packageJson = readJson(packageJsonPath);
  const chromeManifest = readJson(chromeManifestPath);
  const firefoxManifest = readJson(firefoxManifestPath);
  const packageLock = fs.existsSync(packageLockPath)
    ? readJson(packageLockPath)
    : null;

  const currentVersion = String(chromeManifest.version || "");
  if (!currentVersion) {
    fail("chrome/manifest.json is missing a version.");
  }
  if (String(firefoxManifest.version || "") !== currentVersion) {
    fail("Chrome and Firefox manifest versions must match before releasing.");
  }

  const nextVersion = getNextVersion(currentVersion, versionArg);
  const tagName = `v${nextVersion}`;

  ensureTagDoesNotExist(tagName);

  packageJson.version = nextVersion;
  chromeManifest.version = nextVersion;
  firefoxManifest.version = nextVersion;

  writeJson(packageJsonPath, packageJson);
  writeJson(chromeManifestPath, chromeManifest);
  writeJson(firefoxManifestPath, firefoxManifest);

  if (packageLock) {
    updatePackageLockVersion(packageLock, nextVersion);
    writeJson(packageLockPath, packageLock);
  }

  const filesToStage = ["package.json", "chrome/manifest.json", "firefox/manifest.json"];
  if (packageLock) {
    filesToStage.push("package-lock.json");
  }

  runGit(["add", ...filesToStage]);
  runGit(["commit", "-m", `Release v${nextVersion}`]);
  runGit(["tag", "-a", tagName, "-m", `Release ${tagName}`]);
  runGit(["push", "origin", "HEAD"]);
  runGit(["push", "origin", tagName]);

  console.log(`[release] Released ${tagName}`);
}

main();
