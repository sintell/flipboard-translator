import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../../../src/shared/default-settings";
import {
  getDisabledReason,
  isAutoModeEnabled,
  normalizeSettings,
  normalizeSettingsRecord,
  pickBestSettingsRecord,
} from "../../../src/shared/settings";

describe("normalizeSettings", () => {
  it("merges defaults and normalizes fields", () => {
    expect(
      normalizeSettings({
        wordCount: 99,
        refreshSeconds: 2,
        targetLang: "ES",
        debugLogs: true,
        enabled: false,
        disabledDomains: [" Example.com ", "example.com", "", null],
      }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      wordCount: 40,
      refreshSeconds: 5,
      targetLang: "es",
      debugLogs: true,
      enabled: false,
      disabledDomains: ["example.com"],
    });
  });

  it("falls back for unsupported languages and invalid booleans", () => {
    expect(
      normalizeSettings({
        targetLang: "fr",
        debugLogs: "true",
        enabled: 0,
      }),
    ).toEqual(DEFAULT_SETTINGS);
  });
});

describe("normalizeSettingsRecord", () => {
  it("handles wrapped records", () => {
    expect(
      normalizeSettingsRecord({
        value: { wordCount: 12, targetLang: "ka" },
        updatedAt: 123,
      }),
    ).toMatchObject({
      value: {
        ...DEFAULT_SETTINGS,
        wordCount: 12,
        targetLang: "ka",
      },
      updatedAt: 123,
      hasStoredValue: true,
    });
  });

  it("falls back safely for invalid input", () => {
    expect(normalizeSettingsRecord(null)).toMatchObject({
      value: DEFAULT_SETTINGS,
      updatedAt: 0,
      hasStoredValue: false,
    });
  });
});

describe("pickBestSettingsRecord", () => {
  it("prefers the newer record", () => {
    const syncRecord = normalizeSettingsRecord({ updatedAt: 10 });
    const localRecord = normalizeSettingsRecord({ updatedAt: 20 });
    expect(pickBestSettingsRecord(syncRecord, localRecord)).toBe(localRecord);
  });

  it("prefers the record with stored data when timestamps tie", () => {
    const syncRecord = normalizeSettingsRecord(null);
    const localRecord = normalizeSettingsRecord({
      updatedAt: 0,
      enabled: false,
    });
    expect(pickBestSettingsRecord(syncRecord, localRecord)).toBe(localRecord);
  });
});

describe("settings mode helpers", () => {
  it("reports auto mode state", () => {
    expect(isAutoModeEnabled(DEFAULT_SETTINGS, "example.com")).toBe(true);
    expect(
      isAutoModeEnabled(
        {
          ...DEFAULT_SETTINGS,
          disabledDomains: ["example.com"],
        },
        "example.com",
      ),
    ).toBe(false);
  });

  it("reports disabled reason", () => {
    expect(
      getDisabledReason({ ...DEFAULT_SETTINGS, enabled: false }, "example.com"),
    ).toBe("global");
    expect(
      getDisabledReason(
        {
          ...DEFAULT_SETTINGS,
          disabledDomains: ["example.com"],
        },
        "example.com",
      ),
    ).toBe("site");
    expect(getDisabledReason(DEFAULT_SETTINGS, "example.com")).toBeNull();
  });
});
