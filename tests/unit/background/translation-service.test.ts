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

  it("uses exact contextual cache matches before fuzzy or plain hits", async () => {
    vi.mocked(loadCache).mockResolvedValue({
      plain: {
        "en|ko|bank": { ...baseCacheEntry, value: "plain-bank" },
      },
      contextual: {
        "en|ko|bank": [
          {
            ...baseCacheEntry,
            value: "fuzzy-bank",
            prev: "open",
            next: "door",
            ts: 200,
          },
          {
            ...baseCacheEntry,
            value: "exact-bank",
            prev: "open",
            next: "account",
            ts: 150,
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
      contextScore: 3,
      contextMatch: "exact",
    });
    expect(fetchGoogleGtx).not.toHaveBeenCalled();
  });

  it("uses fuzzy single-neighbor contextual cache matches", async () => {
    vi.mocked(loadCache).mockResolvedValue({
      plain: {},
      contextual: {
        "en|ko|bank": [
          {
            ...baseCacheEntry,
            value: "river-bank",
            prev: "river",
            next: "shore",
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
          sourceLang: "en",
          prev: "river",
          next: "guard",
        },
      ],
      "ko",
      "en",
    );

    expect(result["1"].translated).toBe("river-bank");
    expect(result["1"].debug).toEqual({
      cache: "hit",
      contextScore: 2,
      contextMatch: "fuzzy",
    });
    expect(fetchGoogleGtx).not.toHaveBeenCalled();
  });

  it("falls back to plain cache when contextual cache misses", async () => {
    vi.mocked(loadCache).mockResolvedValue({
      plain: {
        "en|ko|bank": { ...baseCacheEntry, value: "plain-bank" },
      },
      contextual: {
        "en|ko|bank": [
          {
            ...baseCacheEntry,
            value: "other-context",
            prev: "river",
            next: "shore",
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
          sourceLang: "en",
          prev: "open",
          next: "account",
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

  it("writes only exact observed contextual entries after fetching", async () => {
    await translateWords(
      log,
      [
        {
          id: "1",
          word: "bank",
          sourceLang: "en",
          prev: "river",
          next: "shore",
        },
      ],
      "ko",
      "en",
    );

    expect(saveCache).toHaveBeenCalledTimes(1);
    const savedCache = vi.mocked(saveCache).mock.calls[0][0];
    expect(savedCache.contextual["en|ko|bank"]).toEqual([
      expect.objectContaining({
        value: "translated",
        prev: "river",
        next: "shore",
      }),
    ]);
  });

  it("falls back to the original word when providers fail", async () => {
    vi.mocked(fetchGoogleGtx).mockResolvedValue({
      ok: false,
      translated: "bank",
      transcription: "",
      cacheable: false,
      reason: "network_error",
    });
    vi.mocked(fetchMyMemory).mockResolvedValue({
      ok: false,
      translated: "bank",
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
          sourceLang: "en",
          prev: "river",
          next: "shore",
        },
      ],
      "ko",
      "en",
    );

    expect(result["1"]).toEqual({
      translated: "bank",
      transcription: "",
      debug: {
        cache: "miss",
        contextScore: 0,
        contextMatch: "none",
      },
    });
  });
});
