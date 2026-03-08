import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/background/cache-store", () => ({
  loadCache: vi.fn(),
  saveCache: vi.fn(),
}));

vi.mock("../../../src/background/providers/google-gtx", () => ({
  fetchGoogleGtx: vi.fn(),
}));

vi.mock("../../../src/background/providers/mymemory", () => ({
  fetchMyMemory: vi.fn(),
}));

import { loadCache, saveCache } from "../../../src/background/cache-store";
import { fetchGoogleGtx } from "../../../src/background/providers/google-gtx";
import { fetchMyMemory } from "../../../src/background/providers/mymemory";
import { translateWords } from "../../../src/background/translation-service";

const log = Object.assign(vi.fn(), {
  groupCollapsed: vi.fn(),
  groupEnd: vi.fn(),
});

const baseCacheEntry = {
  transcription: "romanized",
  ts: 100,
  confirmed: true,
  provider: "test",
};

describe("translateWords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCache).mockResolvedValue({ plain: {}, contextual: {} });
    vi.mocked(saveCache).mockImplementation(async (cache) => cache);
    vi.mocked(fetchGoogleGtx).mockResolvedValue({
      ok: true,
      translated: "translated",
      transcription: "",
      cacheable: true,
      reason: "gtx",
    });
    vi.mocked(fetchMyMemory).mockResolvedValue({
      ok: false,
      translated: "",
      transcription: "",
      cacheable: false,
      reason: "network_error",
    });
  });

  it("uses contextual phrase cache matches before plain word cache hits", async () => {
    vi.mocked(loadCache).mockResolvedValue({
      plain: {
        "en|ko|bank": { ...baseCacheEntry, value: "plain-bank" },
      },
      contextual: {
        "en|ko|open bank account": [
          {
            ...baseCacheEntry,
            value: "exact-bank",
            prev: "open",
            next: "account",
            ts: 200,
          },
        ],
      },
    });

    const result = await translateWords(
      log,
      [
        {
          id: "1",
          word: "bank",
          phrase: "open bank account",
          sourceLang: "en",
          prev: "open",
          next: "account",
        },
      ],
      "ko",
      "en",
    );

    expect(result["1"].translated).toBe("exact-bank");
    expect(result["1"].debug).toEqual({
      cache: "hit",
      contextScore: 2,
      contextMatch: "exact",
    });
    expect(fetchGoogleGtx).not.toHaveBeenCalled();
  });

  it("uses one-sided contextual phrase cache matches", async () => {
    vi.mocked(loadCache).mockResolvedValue({
      plain: {},
      contextual: {
        "en|ko|river bank": [
          {
            ...baseCacheEntry,
            value: "river-bank",
            prev: "river",
          },
        ],
      },
    });

    const result = await translateWords(
      log,
      [
        {
          id: "1",
          word: "bank",
          phrase: "river bank",
          sourceLang: "en",
          prev: "river",
        },
      ],
      "ko",
      "en",
    );

    expect(result["1"].translated).toBe("river-bank");
    expect(result["1"].debug).toEqual({
      cache: "hit",
      contextScore: 1,
      contextMatch: "exact",
    });
    expect(fetchGoogleGtx).not.toHaveBeenCalled();
  });

  it("falls back to plain cache when there is no contextual phrase", async () => {
    vi.mocked(loadCache).mockResolvedValue({
      plain: {
        "en|ko|bank": { ...baseCacheEntry, value: "plain-bank" },
      },
      contextual: {},
    });

    const result = await translateWords(
      log,
      [
        {
          id: "1",
          word: "bank",
          sourceLang: "en",
        },
      ],
      "ko",
      "en",
    );

    expect(result["1"].translated).toBe("plain-bank");
    expect(result["1"].debug).toEqual({
      cache: "hit",
      contextScore: 0,
      contextMatch: "none",
    });
    expect(fetchGoogleGtx).not.toHaveBeenCalled();
  });

  it("fetches using the contextual phrase and caches it by phrase key", async () => {
    await translateWords(
      log,
      [
        {
          id: "1",
          word: "bank",
          phrase: "river bank shore",
          sourceLang: "en",
          prev: "river",
          next: "shore",
        },
      ],
      "ko",
      "en",
    );

    expect(fetchGoogleGtx).toHaveBeenCalledWith(
      log,
      "river bank shore",
      "en",
      "ko",
    );
    expect(saveCache).toHaveBeenCalledTimes(1);
    const savedCache = vi.mocked(saveCache).mock.calls[0][0];
    expect(savedCache.contextual["en|ko|river bank shore"]).toEqual([
      expect.objectContaining({
        value: "translated",
        prev: "river",
        next: "shore",
      }),
    ]);
    expect(savedCache.plain["en|ko|bank"]).toBeUndefined();
  });

  it("falls back to the original contextual phrase when providers fail", async () => {
    vi.mocked(fetchGoogleGtx).mockResolvedValue({
      ok: false,
      translated: "river bank",
      transcription: "",
      cacheable: false,
      reason: "network_error",
    });
    vi.mocked(fetchMyMemory).mockResolvedValue({
      ok: false,
      translated: "river bank",
      transcription: "",
      cacheable: false,
      reason: "network_error",
    });

    const result = await translateWords(
      log,
      [
        {
          id: "1",
          word: "bank",
          phrase: "river bank",
          sourceLang: "en",
          prev: "river",
        },
      ],
      "ko",
      "en",
    );

    expect(result["1"]).toEqual({
      translated: "river bank",
      transcription: "",
      debug: {
        cache: "miss",
        contextScore: 1,
        contextMatch: "exact",
      },
    });
  });
});
