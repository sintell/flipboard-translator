import { fetchGoogleGtx } from "./providers/google-gtx";
import { fetchMyMemory } from "./providers/mymemory";
import { loadCache, saveCache } from "./cache-store";
import {
  isUnchangedTranslation,
  shouldTryFallbackOnUnchanged,
} from "./translation-normalizers";
import {
  createDebugInfo,
  createPendingTranslationBucket,
  getCachedTranslation,
  getContextualCachedTranslation,
  prepareTranslationRequest,
  saveContextualTranslation,
  type PendingTranslationBucket,
} from "./translation-service-helpers";
import type { Logger } from "../shared/logging";
import type { TranslationMap, TranslationRequest } from "../shared/messages";

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
    const pendingByKey = new Map<string, PendingTranslationBucket>();
    let cacheHits = 0;
    let contextualCacheHits = 0;

    for (const request of requests) {
      const prepared = prepareTranslationRequest(
        request,
        fallbackSourceLang,
        targetLang,
      );
      if (!prepared) continue;

      log("translateWord.request", {
        requestId: prepared.requestId,
        word: prepared.originalWord,
        normalizedWord: prepared.word,
        phrase: prepared.isContextual ? prepared.phrase : undefined,
        sourceLang: prepared.sourceLang,
        targetLang,
        prev: prepared.prev,
        next: prepared.next,
        cacheKey: prepared.cacheKey,
        contextualCacheKey: prepared.isContextual
          ? prepared.contextualCacheKey
          : undefined,
      });
      const contextualTranslation = prepared.isContextual
        ? getContextualCachedTranslation(
          cache,
          prepared.contextualCacheKey,
          prepared.phrase || prepared.word,
          targetLang,
        )
        : null;

      if (contextualTranslation) {
        result[prepared.requestId] = {
          ...contextualTranslation.translation,
          debug: createDebugInfo("hit", prepared.contextWordCount, "exact"),
        };
        log("translateWord.response", {
          requestId: prepared.requestId,
          word: prepared.originalWord,
          normalizedWord: prepared.word,
          sourceLang: prepared.sourceLang,
          targetLang,
          prev: prepared.prev,
          next: prepared.next,
          cache: "contextual",
          contextScore: prepared.contextWordCount,
          contextMatch: "exact",
          response: result[prepared.requestId],
        });
        cacheHits += 1;
        contextualCacheHits += 1;
        continue;
      }

      const cachedTranslation = prepared.isContextual
        ? null
        : getCachedTranslation(
          cache.plain,
          prepared.cacheKey,
          prepared.word,
          targetLang,
        );

      if (cachedTranslation) {
        result[prepared.requestId] = {
          ...cachedTranslation,
          debug: createDebugInfo("hit", 0, "none"),
        };
        log("translateWord.response", {
          requestId: prepared.requestId,
          word: prepared.originalWord,
          normalizedWord: prepared.word,
          sourceLang: prepared.sourceLang,
          targetLang,
          prev: prepared.prev,
          next: prepared.next,
          cache: "plain",
          contextScore: 0,
          contextMatch: "none",
          response: result[prepared.requestId],
        });
        cacheHits += 1;
        continue;
      }

      const cached = prepared.isContextual
        ? undefined
        : cache.plain[prepared.cacheKey];
      if (!pendingByKey.has(prepared.pendingKey)) {
        pendingByKey.set(
          prepared.pendingKey,
          createPendingTranslationBucket(prepared, cached),
        );
      }

      pendingByKey.get(prepared.pendingKey)?.requests.push({
        id: prepared.requestId,
        word: prepared.originalWord,
        normalizedWord: prepared.word,
        prev: prepared.prev,
        next: prepared.next,
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
