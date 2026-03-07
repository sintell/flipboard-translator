import { describe, expect, it } from "vitest";

import { clampInt } from "../../../src/shared/number";

describe("clampInt", () => {
  it("rounds valid numbers within range", () => {
    expect(clampInt(7.6, 1, 10, 5)).toBe(8);
  });

  it("clamps values below and above bounds", () => {
    expect(clampInt(-10, 1, 10, 5)).toBe(1);
    expect(clampInt(99, 1, 10, 5)).toBe(10);
  });

  it("falls back for invalid input", () => {
    expect(clampInt("wat", 1, 10, 5)).toBe(5);
  });
});
