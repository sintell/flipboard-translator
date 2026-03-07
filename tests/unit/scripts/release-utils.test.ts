import { describe, expect, it } from "vitest";

import {
  getNextVersion,
  getTagMessage,
  parseArgs,
  parseVersionParts,
  updatePackageLockVersion,
} from "../../../scripts/release-utils.js";

describe("release utils", () => {
  it("parses valid version strings", () => {
    expect(parseVersionParts("1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
    });
    expect(parseVersionParts("wat")).toBeNull();
  });

  it("computes the next release version", () => {
    expect(getNextVersion("1.2.3", "patch")).toBe("1.2.4");
    expect(getNextVersion("1.2.3", "minor")).toBe("1.3.0");
    expect(getNextVersion("1.2.3", "major")).toBe("2.0.0");
    expect(getNextVersion("1.2.3", "3.4.5")).toBe("3.4.5");
  });

  it("rejects invalid release version inputs", () => {
    expect(() => getNextVersion("bad", "patch")).toThrow(
      "Unsupported current version format",
    );
    expect(() => getNextVersion("1.2.3", "beta")).toThrow(
      "Release argument must be patch, minor, major, or an explicit x.y.z version.",
    );
  });

  it("parses release args and notes", () => {
    expect(parseArgs([])).toEqual({ version: "patch", notes: "" });
    expect(parseArgs(["minor", "--notes", "  shipped  "])).toEqual({
      version: "minor",
      notes: "shipped",
    });
    expect(parseArgs(["--description=hello"])).toEqual({
      version: "patch",
      notes: "hello",
    });
  });

  it("rejects invalid release args", () => {
    expect(() => parseArgs(["patch", "minor"])).toThrow(
      "Unexpected release argument: minor",
    );
    expect(() => parseArgs(["--wat"])).toThrow("Unknown option: --wat");
    expect(() => parseArgs(["--notes"])).toThrow("Missing value for --notes.");
  });

  it("builds tag messages and updates package-lock versions", () => {
    expect(getTagMessage("v1.2.3", "")).toBe("Release v1.2.3");
    expect(getTagMessage("v1.2.3", "Hello")).toBe("Release v1.2.3\n\nHello");

    const packageLock = {
      version: "1.0.0",
      packages: {
        "": {
          version: "1.0.0",
        },
      },
    };
    updatePackageLockVersion(packageLock, "1.2.3");
    expect(packageLock).toEqual({
      version: "1.2.3",
      packages: {
        "": {
          version: "1.2.3",
        },
      },
    });
  });
});
