import { addRuntimeMessageListener } from "../shared/browser-api";
import type { Logger } from "../shared/logging";
import {
  MESSAGE_CLEAR_CACHE,
  MESSAGE_TRANSLATE_REQUEST,
} from "../shared/messages";
import { clearCache } from "./cache-store";
import { translateWords } from "./translation-service";

export function initBackgroundMessageHandler(log: Logger): void {
  addRuntimeMessageListener((message, _sender, sendResponse) => {
    if (!message) {
      return false;
    }

    if (message.type === MESSAGE_CLEAR_CACHE) {
      clearCache()
        .then((ok) => {
          log("message.clearCache", { ok });
          sendResponse({ ok });
        })
        .catch(() => sendResponse({ ok: false }));
      return true;
    }

    if (message.type !== MESSAGE_TRANSLATE_REQUEST) {
      return false;
    }

    const requests = Array.isArray(message.requests) ? message.requests : [];
    const sourceLang = String(message.sourceLang || "en").toLowerCase();
    const targetLang = String(message.targetLang || "ko").toLowerCase();
    log("message.translateRequest", {
      requestsCount: requests.length,
      sourceLang,
      targetLang,
    });

    translateWords(log, requests, targetLang, sourceLang)
      .then((translations) => sendResponse({ ok: true, translations }))
      .catch(() => sendResponse({ ok: false, translations: {} }));

    return true;
  });
}
