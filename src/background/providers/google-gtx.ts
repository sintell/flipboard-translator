import { sanitizeTranscription, sanitizeTranslation } from "../translation-normalizers";

export async function fetchGoogleGtx(
  log: (step: string, data?: unknown) => void,
  word: string,
  sourceLang: string,
  targetLang: string,
) {
  const params = new URLSearchParams();
  params.append("client", "gtx");
  params.append("sl", sourceLang);
  params.append("tl", targetLang);
  params.append("dt", "t");
  params.append("dt", "rm");
  params.append("q", word);

  try {
    log("fetch.gtx.start", { word, sourceLang, targetLang });
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params.toString()}`);
    if (!response.ok) {
      log("fetch.gtx.httpError", { word, status: response.status });
      return { ok: false, translated: word, transcription: "", cacheable: false, reason: `http_${response.status}` };
    }

    const payload = await response.json();
    const firstChunk = Array.isArray(payload) && Array.isArray(payload[0]) ? payload[0] : [];
    const combined = firstChunk
      .map((row) => (Array.isArray(row) && typeof row[0] === "string" ? row[0] : ""))
      .join(" ")
      .trim();
    const translated = sanitizeTranslation(combined, word);

    let transcription = "";
    for (const row of firstChunk) {
      if (Array.isArray(row) && typeof row[2] === "string" && row[2].trim()) {
        transcription = sanitizeTranscription(row[2]);
        break;
      }
    }

    log("fetch.gtx.success", { word, sourceLang, targetLang, translated, transcription });
    return { ok: true, translated, transcription, cacheable: true, reason: "gtx" };
  } catch (_err) {
    log("fetch.gtx.error", { word, sourceLang, targetLang });
    return { ok: false, translated: word, transcription: "", cacheable: false, reason: "network_error" };
  }
}
