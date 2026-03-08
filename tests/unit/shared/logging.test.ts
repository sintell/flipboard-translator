import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger, normalizeBoolean } from "../../../src/shared/logging";

describe("normalizeBoolean", () => {
  it("returns booleans as-is and falls back otherwise", () => {
    expect(normalizeBoolean(true, false)).toBe(true);
    expect(normalizeBoolean("true", false)).toBe(false);
  });
});

describe("createLogger", () => {
  const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const groupCollapsedSpy = vi
    .spyOn(console, "groupCollapsed")
    .mockImplementation(() => {});
  const groupEndSpy = vi
    .spyOn(console, "groupEnd")
    .mockImplementation(() => {});

  afterEach(() => {
    logSpy.mockClear();
    groupCollapsedSpy.mockClear();
    groupEndSpy.mockClear();
  });

  it("logs plain messages when enabled", () => {
    const log = createLogger("test", () => true);
    log("step");
    expect(logSpy).toHaveBeenCalledWith("[RWF][test] step");
  });

  it("logs structured data when provided", () => {
    const log = createLogger("test", () => true);
    log("step", { ok: true });
    expect(logSpy).toHaveBeenCalledWith("[RWF][test] step", { ok: true });
  });

  it("does nothing when disabled", () => {
    const log = createLogger("test", () => false);
    log("step", { ok: true });
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("starts and ends groups when enabled", () => {
    const log = createLogger("test", () => true);
    log.groupCollapsed("batch", { size: 2 });
    log.groupEnd();

    expect(groupCollapsedSpy).toHaveBeenCalledWith("[RWF][test] batch", {
      size: 2,
    });
    expect(groupEndSpy).toHaveBeenCalled();
  });
});
