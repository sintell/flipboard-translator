import { storageGet, storageSet } from "../shared/browser-api";
import { CACHE_KEY, MAX_CACHE_ENTRIES } from "../shared/constants";

export type TranslationCacheEntry = {
  value: string;
  transcription: string;
  ts: number;
  confirmed: boolean;
  provider: string;
};

export type TranslationCache = Record<string, TranslationCacheEntry>;

export async function loadCache(): Promise<TranslationCache> {
  const result = await storageGet("local", CACHE_KEY);
  const raw = result ? result[CACHE_KEY] : undefined;
  if (!raw || typeof raw !== "object") return {};
  return raw;
}

function buildTrimmedCache(cache: TranslationCache, limit: number): TranslationCache {
  const trimmed: TranslationCache = {};
  const ordered = Object.keys(cache)
    .map((key) => ({ key, ts: cache[key] && cache[key].ts ? cache[key].ts : 0 }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, Math.max(0, limit));

  for (const entry of ordered) {
    trimmed[entry.key] = cache[entry.key];
  }

  return trimmed;
}

export async function saveCache(cache: TranslationCache): Promise<TranslationCache> {
  const keys = Object.keys(cache);
  let limit = Math.min(keys.length, MAX_CACHE_ENTRIES);

  while (limit >= 0) {
    const nextCache = limit === keys.length ? cache : buildTrimmedCache(cache, limit);
    const saved = await storageSet("local", { [CACHE_KEY]: nextCache });
    if (saved) {
      return nextCache;
    }
    if (limit === 0) {
      break;
    }
    limit = Math.floor(limit * 0.75);
  }

  return {};
}
