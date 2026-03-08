import { fetchGoogleGtx } from "./providers/google-gtx";
import { fetchMyMemory } from "./providers/mymemory";
import {
  loadCache,
  saveCache,
  type ContextualTranslationCacheEntry,
  type TranslationCache,
  type TranslationCacheEntry,
} from "./cache-store";
import {
  isUnchangedTranslation,
  sanitizeTranscription,
  shouldRequireTranscription,
  shouldTryFallbackOnUnchanged,
} from "./translation-normalizers";
import type { Logger } from "../shared/logging";
import type { TranslationMap, TranslationRequest } from "../shared/messages";

function createDebugInfo(
  cache: "hit" | "miss",
  contextScore: number,
  contextMatch: "exact" | "fuzzy" | "none",
) {
  return {
    cache,
    contextScore,
    contextMatch,
  };
}

async function fetchTranslation(
  log: Logger,
  word: string,
  sourceLang: string,
  targetLang: string,
) {
  log("translateWord.fetch.start", {
    word,
    sourceLang,
    targetLang,
  });
  const gtx = await fetchGoogleGtx(log, word, sourceLang, targetLang);
  log("translateWord.fetch.provider", {
    word,
    provider: "gtx",
    response: gtx,
  });
  if (gtx.ok && !isUnchangedTranslation(word, gtx.translated)) {
    log("translateWord.fetch.selected", {
      word,
      sourceLang,
      targetLang,
      provider: "gtx",
      response: gtx,
    });
    return gtx;
  }

  const mm = await fetchMyMemory(log, word, sourceLang, targetLang);
  log("translateWord.fetch.provider", {
    word,
    provider: "mymemory",
    response: mm,
  });
  if (mm.ok && !isUnchangedTranslation(word, mm.translated)) {
    log("translateWord.fetch.selected", {
      word,
      sourceLang,
      targetLang,
      provider: "mymemory",
      response: mm,
    });
    return mm;
  }
  if (gtx.ok && !shouldTryFallbackOnUnchanged(word, sourceLang)) {
    log("translateWord.fetch.selected", {
      word,
      sourceLang,
      targetLang,
      provider: "gtx_fallback",
      response: gtx,
    });
    return gtx;
  }
  if (mm.ok) {
    log("translateWord.fetch.selected", {
      word,
      sourceLang,
      targetLang,
      provider: "mymemory_fallback",
      response: mm,
    });
    return mm;
  }
  if (gtx.ok) {
    log("translateWord.fetch.selected", {
      word,
      sourceLang,
      targetLang,
      provider: "gtx_last_resort",
      response: gtx,
    });
    return gtx;
  }
  log("translateWord.fetch.selected", {
    word,
    sourceLang,
    targetLang,
    provider: "mymemory_last_resort",
    response: mm,
  });
  return mm;
}

function normalizeContextWord(word?: string): string | undefined {
  const normalized = String(word || "")
    .trim()
    .toLocaleLowerCase();
  return normalized || undefined;
}

function getCachedTranslation(
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

function getContextMatchScore(
  entry: ContextualTranslationCacheEntry,
  prev?: string,
  next?: string,
): number {
  const exactPrev = entry.prev === prev;
  const exactNext = entry.next === next;
  if (exactPrev && exactNext) return 3;

  const fuzzyPrev = Boolean(prev) && entry.prev === prev;
  const fuzzyNext = Boolean(next) && entry.next === next;
  if (fuzzyPrev || fuzzyNext) return 2;

  return 0;
}

function getContextualCachedTranslation(
  cache: TranslationCache,
  bucketKey: string,
  word: string,
  targetLang: string,
  prev?: string,
  next?: string,
) {
  const entries = Array.isArray(cache.contextual[bucketKey])
    ? cache.contextual[bucketKey]
    : [];
  let bestEntry: ContextualTranslationCacheEntry | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    const score = getContextMatchScore(entry, prev, next);
    if (score < 2) continue;
    if (
      score > bestScore ||
      (score === bestScore && bestEntry && entry.ts > bestEntry.ts) ||
      (score === bestScore && !bestEntry)
    ) {
      bestScore = score;
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
    contextScore: bestScore,
    matchType: (bestScore === 3 ? "exact" : "fuzzy") as "exact" | "fuzzy",
  };
}

function saveContextualTranslation(
  cache: TranslationCache,
  bucketKey: string,
  entry: ContextualTranslationCacheEntry,
): void {
  const existing = Array.isArray(cache.contextual[bucketKey])
    ? cache.contextual[bucketKey]
    : [];
  const nextEntries = existing.filter(
    (item) => !(item.prev === entry.prev && item.next === entry.next),
  );
  nextEntries.push(entry);
  cache.contextual[bucketKey] = nextEntries;
}

export async function translateWords(
  log: Logger,
  requests: TranslationRequest[],
  targetLang: string,
  fallbackSourceLang: string,
): Promise<TranslationMap> {
  log.groupCollapsed("translateWords.batch", {
    requestCount: requests.length,
    targetLang,
    fallbackSourceLang,
    requests,
  });
  try {
    log("translateWords.start", {
      requestCount: requests.length,
      targetLang,
      fallbackSourceLang,
      requests,
    });
    const cache = await loadCache();
    const result: TranslationMap = {};
    const pendingByKey = new Map<
      string,
      {
        word: string;
        sourceLang: string;
        cachedTranslated: string;
        cachedTranscription: string;
        requests: Array<{
          id: string;
          word: string;
          normalizedWord: string;
          prev?: string;
          next?: string;
        }>;
      }
    >();
    let cacheHits = 0;
    let contextualCacheHits = 0;
    let fuzzyCacheHits = 0;

    for (const request of requests) {
      const requestId = String((request && request.id) || "").trim();
      const originalWord = String((request && request.word) || "").trim();
      const word = originalWord.toLocaleLowerCase();
      if (!requestId || !word) continue;
      const sourceLang = String(
        (request && request.sourceLang) || fallbackSourceLang || "en",
      ).toLowerCase();
      const prev = normalizeContextWord(request && request.prev);
      const next = normalizeContextWord(request && request.next);
      const cacheKey = `${sourceLang}|${targetLang}|${word}`;
      log("translateWord.request", {
        requestId,
        word: originalWord,
        normalizedWord: word,
        sourceLang,
        targetLang,
        prev,
        next,
        cacheKey,
      });
      const contextualTranslation = getContextualCachedTranslation(
        cache,
        cacheKey,
        word,
        targetLang,
        prev,
        next,
      );

      if (contextualTranslation) {
        result[requestId] = {
          ...contextualTranslation.translation,
          debug: createDebugInfo(
            "hit",
            contextualTranslation.contextScore,
            contextualTranslation.matchType,
          ),
        };
        log("translateWord.response", {
          requestId,
          word: originalWord,
          normalizedWord: word,
          sourceLang,
          targetLang,
          prev,
          next,
          cache: "contextual",
          contextScore: contextualTranslation.contextScore,
          contextMatch: contextualTranslation.matchType,
          response: result[requestId],
        });
        cacheHits += 1;
        contextualCacheHits += 1;
        if (contextualTranslation.matchType === "fuzzy") {
          fuzzyCacheHits += 1;
        }
        continue;
      }

      const cachedTranslation = getCachedTranslation(
        cache.plain,
        cacheKey,
        word,
        targetLang,
      );

      if (cachedTranslation) {
        result[requestId] = {
          ...cachedTranslation,
          debug: createDebugInfo("hit", 0, "none"),
        };
        log("translateWord.response", {
          requestId,
          word: originalWord,
          normalizedWord: word,
          sourceLang,
          targetLang,
          prev,
          next,
          cache: "plain",
          contextScore: 0,
          contextMatch: "none",
          response: result[requestId],
        });
        cacheHits += 1;
        continue;
      }

      const cached = cache.plain[cacheKey];
      if (!pendingByKey.has(cacheKey)) {
        pendingByKey.set(cacheKey, {
          word,
          sourceLang,
          cachedTranslated: cached && cached.value ? cached.value : "",
          cachedTranscription: sanitizeTranscription(
            cached && cached.transcription,
          ),
          requests: [],
        });
      }

      pendingByKey.get(cacheKey)?.requests.push({
        id: requestId,
        word: originalWord,
        normalizedWord: word,
        prev,
        next,
      });
    }

    const pending = Array.from(pendingByKey.values());
    log("translateWords.cache", {
      cacheHits,
      contextualCacheHits,
      fuzzyCacheHits,
      pendingCount: pending.length,
    });

    await Promise.all(
      pending.map(
        async ({
          word,
          sourceLang,
          cachedTranslated,
          cachedTranscription,
          requests: pendingRequests,
        }) => {
          const fetched = await fetchTranslation(
            log,
            word,
            sourceLang,
            targetLang,
          );
          const translated =
            fetched && fetched.translated
              ? fetched.translated
              : cachedTranslated || word;
          const transcription =
            fetched && fetched.transcription
              ? fetched.transcription
              : cachedTranscription || "";
          const provider =
            fetched && fetched.reason ? fetched.reason : "unknown";

          for (const pendingRequest of pendingRequests) {
            result[pendingRequest.id] = {
              translated,
              transcription,
              debug: createDebugInfo("miss", 0, "none"),
            };
            log("translateWord.response", {
              requestId: pendingRequest.id,
              word: pendingRequest.word,
              normalizedWord: pendingRequest.normalizedWord,
              sourceLang,
              targetLang,
              prev: pendingRequest.prev,
              next: pendingRequest.next,
              cache: "miss",
              provider,
              fetched,
              response: result[pendingRequest.id],
            });
          }

          if (fetched && fetched.cacheable) {
            const cacheEntry = {
              value: translated,
              transcription,
              ts: Date.now(),
              confirmed: true,
              provider,
            };
            cache.plain[`${sourceLang}|${targetLang}|${word}`] = cacheEntry;
            for (const pendingRequest of pendingRequests) {
              saveContextualTranslation(
                cache,
                `${sourceLang}|${targetLang}|${word}`,
                {
                  ...cacheEntry,
                  prev: pendingRequest.prev,
                  next: pendingRequest.next,
                },
              );
            }
          }
        },
      ),
    );

    await saveCache(cache);
    log("translateWords.complete", {
      translatedCount: Object.keys(result).length,
      result,
    });
    return result;
  } finally {
    log.groupEnd();
  }
}
