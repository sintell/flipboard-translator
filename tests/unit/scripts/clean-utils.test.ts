import { describe, expect, it } from "vitest";

import { getGeneratedSrcDirs } from "../../../scripts/clean-utils.js";

describe("getGeneratedSrcDirs", () => {
  it("builds generated browser src directories", () => {
    expect(getGeneratedSrcDirs("/tmp/project")).toEqual([
      "/tmp/project/chrome/src",
      "/tmp/project/firefox/src",
    ]);
  });
});
