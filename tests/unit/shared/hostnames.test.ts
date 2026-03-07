import { describe, expect, it } from "vitest";

import {
  getHostnameFromUrl,
  normalizeHostname,
} from "../../../src/shared/hostnames";

describe("hostnames", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeHostname(" Example.COM ")).toBe("example.com");
  });

  it("extracts hostname from valid urls", () => {
    expect(getHostnameFromUrl("https://Sub.Example.com/path")).toBe(
      "sub.example.com",
    );
  });

  it("returns empty string for invalid urls", () => {
    expect(getHostnameFromUrl("not a url")).toBe("");
  });
});
