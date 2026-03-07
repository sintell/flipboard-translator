import { describe, expect, it } from "vitest";

import {
  isUnchangedTranslation,
  sanitizeTranscription,
  sanitizeTranslation,
  shouldRequireTranscription,
  shouldTryFallbackOnUnchanged,
} from "../../../src/background/translation-normalizers";

describe("translation normalizers", () => {
  it("sanitizes translation tokens", () => {
    expect(sanitizeTranslation("  hola!  ", "fallback")).toBe("hola");
    expect(sanitizeTranslation("good morning", "fallback")).toBe(
      "good morning",
    );
    expect(sanitizeTranslation("  ?one two three four!  ", "fallback")).toBe(
      "one two three four",
    );
    expect(sanitizeTranslation("!!!", "fallback")).toBe("fallback");
  });

  it("sanitizes transcriptions", () => {
    expect(sanitizeTranscription("  annyeong  ")).toBe("annyeong");
    expect(sanitizeTranscription(null)).toBe("");
  });

  it("detects languages that require transcription", () => {
    expect(shouldRequireTranscription("ko")).toBe(true);
    expect(shouldRequireTranscription("es")).toBe(false);
  });

  it("detects unchanged translations case-insensitively", () => {
    expect(isUnchangedTranslation("House", "house")).toBe(true);
    expect(isUnchangedTranslation("House", "home")).toBe(false);
  });

  it("applies unchanged fallback heuristic for english words", () => {
    expect(shouldTryFallbackOnUnchanged("word", "en")).toBe(true);
    expect(shouldTryFallbackOnUnchanged("cat", "en")).toBe(false);
    expect(shouldTryFallbackOnUnchanged("word", "es")).toBe(false);
  });
});
