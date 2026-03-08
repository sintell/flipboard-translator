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
  text: string,
  sourceLang: string,
  targetLang: string,
) {
  log("translateWord.fetch.start", {
    text,
    sourceLang,
    targetLang,
  });
  const gtx = await fetchGoogleGtx(log, text, sourceLang, targetLang);
  log("translateWord.fetch.provider", {
    text,
    provider: "gtx",
    response: gtx,
  });
  if (gtx.ok && !isUnchangedTranslation(text, gtx.translated)) {
    log("translateWord.fetch.selected", {
      text,
      sourceLang,
      targetLang,
      provider: "gtx",
      response: gtx,
    });
    return gtx;
  }

  const mm = await fetchMyMemory(log, text, sourceLang, targetLang);
  log("translateWord.fetch.provider", {
    text,
    provider: "mymemory",
    response: mm,
  });
  if (mm.ok && !isUnchangedTranslation(text, mm.translated)) {
    log("translateWord.fetch.selected", {
      text,
      sourceLang,
      targetLang,
      provider: "mymemory",
      response: mm,
    });
    return mm;
  }
  if (gtx.ok && !shouldTryFallbackOnUnchanged(text, sourceLang)) {
    log("translateWord.fetch.selected", {
      text,
      sourceLang,
      targetLang,
      provider: "gtx_fallback",
      response: gtx,
    });
    return gtx;
  }
  if (mm.ok) {
    log("translateWord.fetch.selected", {
      text,
      sourceLang,
      targetLang,
      provider: "mymemory_fallback",
      response: mm,
    });
    return mm;
  }
  if (gtx.ok) {
    log("translateWord.fetch.selected", {
      text,
      sourceLang,
      targetLang,
      provider: "gtx_last_resort",
      response: gtx,
    });
    return gtx;
  }
  log("translateWord.fetch.selected", {
    text,
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

function getContextualCachedTranslation(
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

function saveContextualTranslation(
  cache: TranslationCache,
  bucketKey: string,
  entry: ContextualTranslationCacheEntry,
): void {
  cache.contextual[bucketKey] = [entry];
}

function getContextWordCount(prev?: string, next?: string): number {
  return Number(Boolean(prev)) + Number(Boolean(next));
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
        text: string;
        isContextual: boolean;
        contextWordCount: number;
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

    for (const request of requests) {
      const requestId = String((request && request.id) || "").trim();
      const originalWord = String((request && request.word) || "").trim();
      const word = originalWord.toLocaleLowerCase();
      if (!requestId || !word) continue;
      const sourceLang = String(
        (request && request.sourceLang) || fallbackSourceLang || "en",
      ).toLowerCase();
      const phrase = String((request && request.phrase) || "").trim();
      const prev = normalizeContextWord(request && request.prev);
      const next = normalizeContextWord(request && request.next);
      const contextWordCount = getContextWordCount(prev, next);
      const isContextual = Boolean(phrase) && contextWordCount > 0;
      const cacheKey = `${sourceLang}|${targetLang}|${word}`;
      const contextualCacheKey = `${sourceLang}|${targetLang}|${phrase}`;
      log("translateWord.request", {
        requestId,
        word: originalWord,
        normalizedWord: word,
        phrase: isContextual ? phrase : undefined,
        sourceLang,
        targetLang,
        prev,
        next,
        cacheKey,
        contextualCacheKey: isContextual ? contextualCacheKey : undefined,
      });
      const contextualTranslation = isContextual
        ? getContextualCachedTranslation(
            cache,
            contextualCacheKey,
            phrase,
            targetLang,
          )
        : null;

      if (contextualTranslation) {
        result[requestId] = {
          ...contextualTranslation.translation,
          debug: createDebugInfo("hit", contextWordCount, "exact"),
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
          contextScore: contextWordCount,
          contextMatch: "exact",
          response: result[requestId],
        });
        cacheHits += 1;
        contextualCacheHits += 1;
        continue;
      }

      const cachedTranslation = isContextual
        ? null
        : getCachedTranslation(cache.plain, cacheKey, word, targetLang);

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

      const pendingKey = isContextual ? contextualCacheKey : cacheKey;
      const cached = isContextual ? undefined : cache.plain[cacheKey];
      if (!pendingByKey.has(pendingKey)) {
        pendingByKey.set(pendingKey, {
          word,
          text: isContextual ? phrase : word,
          isContextual,
          contextWordCount,
          sourceLang,
          cachedTranslated: cached && cached.value ? cached.value : "",
          cachedTranscription: sanitizeTranscription(
            cached && cached.transcription,
          ),
          requests: [],
        });
      }

      pendingByKey.get(pendingKey)?.requests.push({
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
      pendingCount: pending.length,
    });

    await Promise.all(
      pending.map(
        async ({
          word,
          text,
          isContextual,
          contextWordCount,
          sourceLang,
          cachedTranslated,
          cachedTranscription,
          requests: pendingRequests,
        }) => {
          const fetched = await fetchTranslation(
            log,
            text,
            sourceLang,
            targetLang,
          );
          const translated =
            fetched && fetched.translated
              ? fetched.translated
              : cachedTranslated || text;
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
              debug: createDebugInfo(
                "miss",
                isContextual ? contextWordCount : 0,
                isContextual ? "exact" : "none",
              ),
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
              contextScore: isContextual ? contextWordCount : 0,
              contextMatch: isContextual ? "exact" : "none",
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
            if (!isContextual) {
              cache.plain[`${sourceLang}|${targetLang}|${word}`] = cacheEntry;
            }
            if (isContextual) {
              saveContextualTranslation(
                cache,
                `${sourceLang}|${targetLang}|${text}`,
                {
                  ...cacheEntry,
                  prev: pendingRequests[0]?.prev,
                  next: pendingRequests[0]?.next,
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
