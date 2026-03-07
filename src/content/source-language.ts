export function getBaseSourceLang(): string {
  const raw = (document.documentElement && document.documentElement.lang) || "";
  const candidate = raw.trim().toLowerCase().split(/[-_]/)[0];
  if (/^[a-z]{2,3}$/.test(candidate)) return candidate;
  return "en";
}

export function detectSourceLangForWord(
  word: string,
  fallbackLang: string,
): string {
  if (!word) return fallbackLang;
  if (/\p{Script=Cyrillic}/u.test(word)) return "ru";
  if (/\p{Script=Hangul}/u.test(word)) return "ko";
  if (/\p{Script=Hiragana}|\p{Script=Katakana}/u.test(word)) return "ja";
  if (/\p{Script=Han}/u.test(word)) return "zh";
  if (/\p{Script=Hebrew}/u.test(word)) return "he";
  if (/\p{Script=Arabic}/u.test(word)) return "ar";
  if (/\p{Script=Devanagari}/u.test(word)) return "hi";
  if (/\p{Script=Greek}/u.test(word)) return "el";
  if (/\p{Script=Georgian}/u.test(word)) return "ka";
  if (/\p{Script=Latin}/u.test(word)) return "en";
  return fallbackLang || "en";
}
