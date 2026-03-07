import { sendRuntimeMessage } from "../shared/browser-api";
import { MESSAGE_TRANSLATE_REQUEST, type TranslationMap } from "../shared/messages";
import { log } from "./state";
import { detectSourceLangForWord } from "./source-language";

export async function translateWords(words: string[], sourceLang: string, targetLang: string): Promise<TranslationMap> {
  const requests = words.map((word) => ({
    word,
    sourceLang: detectSourceLangForWord(word, sourceLang),
  }));

  log("translateWords.request", { targetLang, fallbackSourceLang: sourceLang, requests });
  const response = await sendRuntimeMessage<{ ok?: boolean; translations?: TranslationMap }>({
    type: MESSAGE_TRANSLATE_REQUEST,
    requests,
    targetLang,
  });
  log("translateWords.response", response);

  if (response && response.ok && response.translations) {
    return response.translations;
  }

  const fallback: TranslationMap = {};
  for (const word of words) {
    fallback[word] = { translated: word, transcription: "" };
  }
  return fallback;
}
