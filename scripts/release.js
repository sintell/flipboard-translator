const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const {
  getNextVersion,
  getTagMessage,
  parseArgs,
  updatePackageLockVersion,
} = require("./release-utils");

const rootDir = path.resolve(__dirname, "..");
const packageJsonPath = path.join(rootDir, "package.json");
const packageLockPath = path.join(rootDir, "package-lock.json");
const chromeManifestPath = path.join(rootDir, "chrome", "manifest.json");
const firefoxManifestPath = path.join(rootDir, "firefox", "manifest.json");
const releaseNotesPath = path.join(rootDir, ".github", "release-notes.md");

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

function writeReleaseNotes(notes) {
  fs.mkdirSync(path.dirname(releaseNotesPath), { recursive: true });
  fs.writeFileSync(releaseNotesPath, notes ? `${notes}\n` : "");
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    fail(error && error.message ? error.message : String(error));
  }

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

  const nextVersion = getNextVersion(currentVersion, options.version);
  const tagName = `v${nextVersion}`;

  ensureTagDoesNotExist(tagName);

  packageJson.version = nextVersion;
  chromeManifest.version = nextVersion;
  firefoxManifest.version = nextVersion;

  writeJson(packageJsonPath, packageJson);
  writeJson(chromeManifestPath, chromeManifest);
  writeJson(firefoxManifestPath, firefoxManifest);
  writeReleaseNotes(options.notes);

  if (packageLock) {
    updatePackageLockVersion(packageLock, nextVersion);
    writeJson(packageLockPath, packageLock);
  }

  const filesToStage = [
    "package.json",
    "chrome/manifest.json",
    "firefox/manifest.json",
    ".github/release-notes.md",
  ];
  if (packageLock) {
    filesToStage.push("package-lock.json");
  }

  runGit(["add", ...filesToStage]);
  runGit(["commit", "-m", `Release v${nextVersion}`]);
  runGit(["tag", "-a", tagName, "-m", getTagMessage(tagName, options.notes)]);
  runGit(["push", "origin", "HEAD"]);
  runGit(["push", "origin", tagName]);

  console.log(`[release] Released ${tagName}`);
}

if (require.main === module) {
  main();
}
