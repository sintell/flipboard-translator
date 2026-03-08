import { sendRuntimeMessage } from "../shared/browser-api";
import {
  MESSAGE_TRANSLATE_REQUEST,
  type TranslationMap,
} from "../shared/messages";
import { log } from "./state";
import { detectSourceLangForWord } from "./source-language";
import type { SelectedWordOccurrence } from "./word-selection";

export async function translateWordOccurrences(
  occurrences: SelectedWordOccurrence[],
  sourceLang: string,
  targetLang: string,
): Promise<TranslationMap> {
  const requests = occurrences.map((occurrence) => ({
    id: occurrence.id,
    word: occurrence.word,
    sourceLang: detectSourceLangForWord(occurrence.word, sourceLang),
    prev: occurrence.prev,
    next: occurrence.next,
  }));

  log.groupCollapsed("translateWords.batch", {
    requestCount: requests.length,
    sourceLang,
    targetLang,
  });

  for (const request of requests) {
    log("translateWord.request", request);
  }

  try {
    log("translateWordOccurrences.request", {
      targetLang,
      fallbackSourceLang: sourceLang,
      requests,
    });
    const response = await sendRuntimeMessage<{
      ok?: boolean;
      translations?: TranslationMap;
    }>({
      type: MESSAGE_TRANSLATE_REQUEST,
      requests,
      targetLang,
    });
    log("translateWordOccurrences.response", response);

    if (response && response.ok && response.translations) {
      for (const request of requests) {
        log("translateWord.response", {
          request,
          response: response.translations[request.id],
        });
      }
      return response.translations;
    }

    const fallback: TranslationMap = {};
    for (const occurrence of occurrences) {
      fallback[occurrence.id] = {
        translated: occurrence.word,
        transcription: "",
      };
      log("translateWord.response", {
        request: {
          id: occurrence.id,
          word: occurrence.word,
          sourceLang: detectSourceLangForWord(occurrence.word, sourceLang),
          prev: occurrence.prev,
          next: occurrence.next,
        },
        response: fallback[occurrence.id],
      });
    }
    return fallback;
  } finally {
    log.groupEnd();
  }
}
