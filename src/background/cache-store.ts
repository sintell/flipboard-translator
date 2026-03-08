import { storageGet, storageSet } from "../shared/browser-api";
import { CACHE_KEY, MAX_CACHE_ENTRIES } from "../shared/constants";

export type TranslationCacheEntry = {
  value: string;
  transcription: string;
  ts: number;
  confirmed: boolean;
  provider: string;
};

export type ContextualTranslationCacheEntry = TranslationCacheEntry & {
  prev?: string;
  next?: string;
};

export type PlainTranslationCache = Record<string, TranslationCacheEntry>;

export type ContextualTranslationCache = Record<
  string,
  ContextualTranslationCacheEntry[]
>;

export type TranslationCache = {
  plain: PlainTranslationCache;
  contextual: ContextualTranslationCache;
};

function createEmptyCache(): TranslationCache {
  return {
    plain: {},
    contextual: {},
  };
}

export async function clearCache(): Promise<boolean> {
  return storageSet("local", { [CACHE_KEY]: createEmptyCache() });
}

export async function loadCache(): Promise<TranslationCache> {
  const result = await storageGet("local", CACHE_KEY);
  const raw = result ? result[CACHE_KEY] : undefined;
  if (!raw || typeof raw !== "object") return createEmptyCache();

  if (raw.plain || raw.contextual) {
    return {
      plain: raw.plain && typeof raw.plain === "object" ? raw.plain : {},
      contextual:
        raw.contextual && typeof raw.contextual === "object"
          ? raw.contextual
          : {},
    };
  }

  return {
    plain: raw as PlainTranslationCache,
    contextual: {},
  };
}

function getCacheEntryCount(cache: TranslationCache): number {
  return (
    Object.keys(cache.plain).length +
    Object.values(cache.contextual).reduce(
      (count, entries) => count + entries.length,
      0,
    )
  );
}

function buildTrimmedCache(
  cache: TranslationCache,
  limit: number,
): TranslationCache {
  const trimmed = createEmptyCache();
  const ordered = [
    ...Object.keys(cache.plain).map((key) => ({
      kind: "plain" as const,
      key,
      ts: cache.plain[key] && cache.plain[key].ts ? cache.plain[key].ts : 0,
    })),
    ...Object.keys(cache.contextual).flatMap((key) =>
      cache.contextual[key].map((entry, index) => ({
        kind: "contextual" as const,
        key,
        index,
        ts: entry && entry.ts ? entry.ts : 0,
      })),
    ),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, Math.max(0, limit));

  for (const entry of ordered) {
    if (entry.kind === "plain") {
      trimmed.plain[entry.key] = cache.plain[entry.key];
      continue;
    }

    if (!trimmed.contextual[entry.key]) {
      trimmed.contextual[entry.key] = [];
    }
    trimmed.contextual[entry.key].push(
      cache.contextual[entry.key][entry.index],
    );
  }

  return trimmed;
}

export async function saveCache(
  cache: TranslationCache,
): Promise<TranslationCache> {
  const totalEntries = getCacheEntryCount(cache);
  let limit = Math.min(totalEntries, MAX_CACHE_ENTRIES);

  while (limit >= 0) {
    const nextCache =
      limit === totalEntries ? cache : buildTrimmedCache(cache, limit);
    const saved = await storageSet("local", { [CACHE_KEY]: nextCache });
    if (saved) {
      return nextCache;
    }
    if (limit === 0) {
      break;
    }
    limit = Math.floor(limit * 0.75);
  }

  return createEmptyCache();
}
