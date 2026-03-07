import { fetchGoogleGtx } from "./providers/google-gtx";
import { fetchMyMemory } from "./providers/mymemory";
import { loadCache, saveCache, type TranslationCache } from "./cache-store";
import {
  isUnchangedTranslation,
  sanitizeTranscription,
  shouldRequireTranscription,
  shouldTryFallbackOnUnchanged,
} from "./translation-normalizers";
import type { TranslationMap, TranslationRequest } from "../shared/messages";

async function fetchTranslation(
  log: (step: string, data?: unknown) => void,
  word: string,
  sourceLang: string,
  targetLang: string,
) {
  const gtx = await fetchGoogleGtx(log, word, sourceLang, targetLang);
  if (gtx.ok && !isUnchangedTranslation(word, gtx.translated)) return gtx;

  const mm = await fetchMyMemory(log, word, sourceLang, targetLang);
  if (mm.ok && !isUnchangedTranslation(word, mm.translated)) return mm;
  if (gtx.ok && !shouldTryFallbackOnUnchanged(word, sourceLang)) return gtx;
  if (mm.ok) return mm;
  if (gtx.ok) return gtx;
  return mm;
}

function getCachedTranslation(
  cache: TranslationCache,
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

export async function translateWords(
  log: (step: string, data?: unknown) => void,
  requests: TranslationRequest[],
  targetLang: string,
  fallbackSourceLang: string,
): Promise<TranslationMap> {
  log("translateWords.start", {
    requestCount: requests.length,
    targetLang,
    fallbackSourceLang,
    requests,
  });
  const cache = await loadCache();
  const result: TranslationMap = {};
  const pending: Array<{
    word: string;
    sourceLang: string;
    cachedTranslated: string;
    cachedTranscription: string;
  }> = [];
  let cacheHits = 0;

  for (const request of requests) {
    const word = String(
      request && request.word ? request.word : "",
    ).toLowerCase();
    if (!word) continue;
    const sourceLang = String(
      (request && request.sourceLang) || fallbackSourceLang || "en",
    ).toLowerCase();
    const cacheKey = `${sourceLang}|${targetLang}|${word}`;
    const cachedTranslation = getCachedTranslation(
      cache,
      cacheKey,
      word,
      targetLang,
    );

    if (cachedTranslation) {
      result[word] = cachedTranslation;
      cacheHits += 1;
      continue;
    }

    const cached = cache[cacheKey];
    pending.push({
      word,
      sourceLang,
      cachedTranslated: cached && cached.value ? cached.value : "",
      cachedTranscription: sanitizeTranscription(
        cached && cached.transcription,
      ),
    });
  }

  log("translateWords.cache", { cacheHits, pendingCount: pending.length });

  await Promise.all(
    pending.map(
      async ({ word, sourceLang, cachedTranslated, cachedTranscription }) => {
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
        result[word] = { translated, transcription };

        if (fetched && fetched.cacheable) {
          cache[`${sourceLang}|${targetLang}|${word}`] = {
            value: translated,
            transcription,
            ts: Date.now(),
            confirmed: true,
            provider: fetched.reason || "unknown",
          };
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
}
