import type { TranslationMap } from "../shared/messages";
import { collectTextNodes } from "./dom-scan";
import { log } from "./state";

function adjustCase(sourceWord: string, translatedWord: string): string {
  if (!translatedWord) return sourceWord;
  if (/^[\p{Lu}]+$/u.test(sourceWord))
    return translatedWord.toLocaleUpperCase();
  if (/^[\p{Lu}][\p{Ll}]/u.test(sourceWord)) {
    return (
      translatedWord.charAt(0).toLocaleUpperCase() + translatedWord.slice(1)
    );
  }
  return translatedWord;
}

export function restorePreviousReplacements(): void {
  const replaced = document.querySelectorAll(".rwf-replacement");
  log("restorePreviousReplacements.start", { count: replaced.length });
  const parentSet = new Set<Node & ParentNode>();

  for (const el of replaced) {
    if (el.parentNode) parentSet.add(el.parentNode as Node & ParentNode);
    const original = el.getAttribute("data-original") || el.textContent || "";
    el.replaceWith(document.createTextNode(original));
  }

  for (const parent of parentSet) {
    if (parent && typeof parent.normalize === "function") {
      parent.normalize();
    }
  }
}

function createReplacementElement(
  originalWord: string,
  translatedWord: string,
  transcription: string,
): HTMLElement {
  const wrapper = document.createElement("abbr");
  wrapper.className = "rwf-replacement";
  wrapper.setAttribute("data-original", originalWord);
  if (transcription) {
    wrapper.setAttribute("data-transcription", transcription);
    wrapper.setAttribute("title", `${originalWord} (${transcription})`);
  } else {
    wrapper.setAttribute("title", originalWord);
  }
  wrapper.textContent = translatedWord;
  return wrapper;
}

export function replaceWordsOnPage(translationMap: TranslationMap): void {
  const nodes = collectTextNodes();
  const tokenRegex = /\p{L}[\p{L}\p{M}'’-]*/gu;
  const replacementByWord: Record<string, number> = {};
  let totalReplacements = 0;

  for (const node of nodes) {
    const text = node.nodeValue || "";
    tokenRegex.lastIndex = 0;
    let match: RegExpExecArray | null;
    let hasAny = false;
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();

    while ((match = tokenRegex.exec(text)) !== null) {
      const matchedWord = match[0];
      const lower = matchedWord.toLocaleLowerCase();
      const entry = translationMap[lower];
      if (!entry) continue;

      const translated =
        typeof entry === "string" ? entry : String(entry.translated || "");
      const transcription =
        typeof entry === "string" ? "" : String(entry.transcription || "");
      if (!translated) continue;

      hasAny = true;
      if (match.index > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, match.index)),
        );
      }

      fragment.appendChild(
        createReplacementElement(
          matchedWord,
          adjustCase(matchedWord, translated),
          transcription,
        ),
      );
      lastIndex = match.index + matchedWord.length;
      replacementByWord[lower] = (replacementByWord[lower] || 0) + 1;
      totalReplacements += 1;
    }

    if (!hasAny) continue;
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }
    node.replaceWith(fragment);
  }

  log("replaceWordsOnPage.complete", {
    translatedWordsCount: Object.keys(translationMap).length,
    totalReplacements,
    replacementByWord,
    translationMap,
  });
}
