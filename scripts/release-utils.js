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
    throw new Error(`Unsupported current version format: ${currentVersion}`);
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

  throw new Error(
    `Release argument must be patch, minor, major, or an explicit x.y.z version. Received: ${input}`,
  );
}

function updatePackageLockVersion(packageLock, nextVersion) {
  packageLock.version = nextVersion;
  if (packageLock.packages && packageLock.packages[""]) {
    packageLock.packages[""].version = nextVersion;
  }
}

function parseArgs(argv) {
  const args = Array.from(argv);
  let version = null;
  let notes = "";

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--notes" || arg === "--description" || arg === "-n") {
      const nextArg = args[index + 1];
      if (nextArg === undefined) {
        throw new Error(`Missing value for ${arg}.`);
      }
      notes = String(nextArg);
      index += 1;
      continue;
    }

    if (arg.startsWith("--notes=")) {
      notes = arg.slice("--notes=".length);
      continue;
    }

    if (arg.startsWith("--description=")) {
      notes = arg.slice("--description=".length);
      continue;
    }

    if (arg.startsWith("-")) {
      throw new Error(`Unknown option: ${arg}`);
    }

    if (version !== null) {
      throw new Error(`Unexpected release argument: ${arg}`);
    }

    version = arg;
  }

  return {
    version: version || "patch",
    notes: notes.trim(),
  };
}

function getTagMessage(tagName, notes) {
  if (!notes) {
    return `Release ${tagName}`;
  }
  return `Release ${tagName}\n\n${notes}`;
}

module.exports = {
  getNextVersion,
  getTagMessage,
  parseArgs,
  parseVersionParts,
  updatePackageLockVersion,
};
