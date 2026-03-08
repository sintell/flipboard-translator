import { sanitizeTranslation } from "../translation-normalizers";
import type { Logger } from "../../shared/logging";

export async function fetchMyMemory(
  log: Logger,
  word: string,
  sourceLang: string,
  targetLang: string,
) {
  const params = new URLSearchParams({
    q: word,
    langpair: `${String(sourceLang).toUpperCase()}|${String(targetLang).toUpperCase()}`,
  });

  try {
    log("fetch.mymemory.start", {
      word,
      sourceLang,
      targetLang,
      requestUrl: `https://api.mymemory.translated.net/get?${params.toString()}`,
    });
    const response = await fetch(
      `https://api.mymemory.translated.net/get?${params.toString()}`,
    );
    if (!response.ok) {
      log("fetch.mymemory.httpError", { word, status: response.status });
      return {
        ok: false,
        translated: word,
        transcription: "",
        cacheable: false,
        reason: `http_${response.status}`,
      };
    }

    const payload = await response.json();
    const translated = sanitizeTranslation(
      payload && payload.responseData && payload.responseData.translatedText,
      word,
    );
    const status = Number(payload && payload.responseStatus);
    const ok = status === 200;
    log("fetch.mymemory.success", {
      word,
      sourceLang,
      targetLang,
      translated,
      responseStatus: status,
    });

    return {
      ok,
      translated,
      transcription: "",
      cacheable: ok,
      reason: ok ? "ok" : `response_${status || "unknown"}`,
    };
  } catch (_err) {
    log("fetch.mymemory.error", { word, sourceLang, targetLang });
    return {
      ok: false,
      translated: word,
      transcription: "",
      cacheable: false,
      reason: "network_error",
    };
  }
}
