export function sanitizeTranslation(value: unknown, fallback: string): string {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  const tokenMatch = raw.match(/\p{L}[\p{L}\p{M}'’-]*/u);
  return tokenMatch ? tokenMatch[0] : fallback;
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
