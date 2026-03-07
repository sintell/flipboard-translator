import { describe, expect, it } from "vitest";

import { detectSourceLangForWord } from "../../../src/content/source-language";

describe("detectSourceLangForWord", () => {
  it("detects script-specific source languages", () => {
    expect(detectSourceLangForWord("Привет", "en")).toBe("ru");
    expect(detectSourceLangForWord("안녕", "en")).toBe("ko");
    expect(detectSourceLangForWord("ქართული", "en")).toBe("ka");
  });

  it("falls back to latin and provided fallback values", () => {
    expect(detectSourceLangForWord("hello", "ka")).toBe("en");
    expect(detectSourceLangForWord("123", "ka")).toBe("ka");
    expect(detectSourceLangForWord("", "ka")).toBe("ka");
  });
});
