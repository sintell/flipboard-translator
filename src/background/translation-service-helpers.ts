import type {
  ContextualTranslationCacheEntry,
  TranslationCache,
  TranslationCacheEntry,
} from "./cache-store";
import {
  isUnchangedTranslation,
  sanitizeTranscription,
  shouldRequireTranscription,
} from "./translation-normalizers";
import type { TranslationRequest } from "../shared/messages";

export type TranslationDebugInfo = {
  cache: "hit" | "miss";
  contextScore: number;
  contextMatch: "exact" | "fuzzy" | "none";
};

export type PreparedTranslationRequest = {
  requestId: string;
  originalWord: string;
  word: string;
  sourceLang: string;
  prev?: string;
  next?: string;
  phrase?: string;
  contextWordCount: number;
  isContextual: boolean;
  cacheKey: string;
  contextualCacheKey: string;
  pendingKey: string;
};

export type PendingTranslationRequest = {
  id: string;
  word: string;
  normalizedWord: string;
  prev?: string;
  next?: string;
};

export type PendingTranslationBucket = {
  word: string;
  text: string;
  isContextual: boolean;
  contextWordCount: number;
  sourceLang: string;
  cachedTranslated: string;
  cachedTranscription: string;
  requests: PendingTranslationRequest[];
};

export function createDebugInfo(
  cache: "hit" | "miss",
  contextScore: number,
  contextMatch: "exact" | "fuzzy" | "none",
): TranslationDebugInfo {
  return {
    cache,
    contextScore,
    contextMatch,
  };
}

export function normalizeContextWord(word?: string): string | undefined {
  const normalized = String(word || "")
    .trim()
    .toLocaleLowerCase();
  return normalized || undefined;
}

export function getContextWordCount(prev?: string, next?: string): number {
  return Number(Boolean(prev)) + Number(Boolean(next));
}

export function prepareTranslationRequest(
  request: TranslationRequest,
  fallbackSourceLang: string,
  targetLang: string,
): PreparedTranslationRequest | null {
  const requestId = String((request && request.id) || "").trim();
  const originalWord = String((request && request.word) || "").trim();
  const word = originalWord.toLocaleLowerCase();
  if (!requestId || !word) return null;

  const sourceLang = String(
    (request && request.sourceLang) || fallbackSourceLang || "en",
  ).toLowerCase();
  const phrase = String((request && request.phrase) || "").trim() || undefined;
  const prev = normalizeContextWord(request && request.prev);
  const next = normalizeContextWord(request && request.next);
  const contextWordCount = getContextWordCount(prev, next);
  const isContextual = Boolean(phrase) && contextWordCount > 0;
  const cacheKey = `${sourceLang}|${targetLang}|${word}`;
  const contextualCacheKey = `${sourceLang}|${targetLang}|${phrase || ""}`;

  return {
    requestId,
    originalWord,
    word,
    sourceLang,
    prev,
    next,
    phrase,
    contextWordCount,
    isContextual,
    cacheKey,
    contextualCacheKey,
    pendingKey: isContextual ? contextualCacheKey : cacheKey,
  };
}

export function getCachedTranslation(
  cache: Record<string, TranslationCacheEntry>,
  cacheKey: string,
  word: string,
  targetLang: string,
) {
  const cached = cache[cacheKey];
  const hasValue =
    cached && typeof cached.value === "string" && cached.value.length > 0;
  const unchanged = hasValue
    ? isUnchangedTranslation(word, cached.value)
    : false;
  const confirmed = Boolean(cached && cached.confirmed);
  const hasTranscription = Boolean(
    cached &&
    typeof cached.transcription === "string" &&
    cached.transcription.trim(),
  );
  const needsTranscriptionRefresh =
    shouldRequireTranscription(targetLang) && !hasTranscription;

  if (hasValue && (confirmed || !unchanged) && !needsTranscriptionRefresh) {
    cached.ts = Date.now();
    return {
      translated: cached.value,
      transcription: sanitizeTranscription(cached.transcription),
    };
  }

  if (cached && !confirmed && unchanged) {
    delete cache[cacheKey];
  }

  return null;
}

export function getContextualCachedTranslation(
  cache: TranslationCache,
  bucketKey: string,
  word: string,
  targetLang: string,
) {
  const entries = Array.isArray(cache.contextual[bucketKey])
    ? cache.contextual[bucketKey]
    : [];
  let bestEntry: ContextualTranslationCacheEntry | null = null;

  for (const entry of entries) {
    if (!bestEntry || entry.ts > bestEntry.ts) {
      bestEntry = entry;
    }
  }

  if (!bestEntry) return null;

  const translation = getCachedTranslation(
    { [bucketKey]: bestEntry },
    bucketKey,
    word,
    targetLang,
  );
  if (!translation) return null;

  return {
    translation,
    contextScore: 0,
    matchType: "exact" as const,
  };
}

export function saveContextualTranslation(
  cache: TranslationCache,
  bucketKey: string,
  entry: ContextualTranslationCacheEntry,
): void {
  cache.contextual[bucketKey] = [entry];
}

export function createPendingTranslationBucket(
  prepared: PreparedTranslationRequest,
  cached: TranslationCacheEntry | undefined,
): PendingTranslationBucket {
  return {
    word: prepared.word,
    text: prepared.isContextual
      ? prepared.phrase || prepared.word
      : prepared.word,
    isContextual: prepared.isContextual,
    contextWordCount: prepared.contextWordCount,
    sourceLang: prepared.sourceLang,
    cachedTranslated: cached && cached.value ? cached.value : "",
    cachedTranscription: sanitizeTranscription(cached && cached.transcription),
    requests: [],
  };
}
