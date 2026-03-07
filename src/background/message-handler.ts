import { addRuntimeMessageListener } from "../shared/browser-api";
import { MESSAGE_TRANSLATE_REQUEST } from "../shared/messages";
import { translateWords } from "./translation-service";

export function initBackgroundMessageHandler(
  log: (step: string, data?: unknown) => void,
): void {
  addRuntimeMessageListener((message, _sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TRANSLATE_REQUEST) {
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
