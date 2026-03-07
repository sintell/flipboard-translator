export function sanitizeTranslation(value: unknown, fallback: string): string {
  const raw = String(value || "")
    .trim()
    .replace(/\s+/gu, " ");
  if (!raw || !/\p{L}/u.test(raw)) return fallback;

  const cleaned = raw
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .replace(/[^\p{L}\p{M}\p{N}'’ -]+$/u, "")
    .trim();

  return cleaned && /\p{L}/u.test(cleaned) ? cleaned : fallback;
}

export function sanitizeTranscription(value: unknown): string {
  const raw = String(value || "").trim();
  return raw || "";
}

export function shouldRequireTranscription(targetLang: string): boolean {
  return new Set(["ko", "ja", "zh", "ru", "ka", "ar", "he", "hi", "el"]).has(
    String(targetLang || "").toLowerCase(),
  );
}

export function isUnchangedTranslation(
  word: string,
  translated: string,
): boolean {
  return (
    String(word || "").toLowerCase() === String(translated || "").toLowerCase()
  );
}

export function shouldTryFallbackOnUnchanged(
  word: string,
  sourceLang: string,
): boolean {
  return sourceLang === "en" && /^[a-z][a-z'’-]{3,}$/i.test(word);
}
