import type { TranslationMap } from "../shared/messages";
import { contentState, log } from "./state";
import type { QuestEntry } from "./quest-game";
import type { SelectedWordOccurrence } from "./word-selection";

function buildReplacementTitle(
  originalWord: string,
  transcription: string,
  translatedFrom?: string,
  debug?: {
    cache: "hit" | "miss";
    contextScore: number;
    contextMatch: "exact" | "fuzzy" | "none";
  },
): string {
  const lines = [
    transcription ? `${originalWord} (${transcription})` : originalWord,
  ];

  if (contentState.currentSettings.debugLogs && debug) {
    if (translatedFrom && debug.contextScore > 0) {
      lines.push(`from: ${translatedFrom}`);
    }
    lines.push(`cache: ${debug.cache}`);
    lines.push(`ctx: ${debug.contextMatch} (${debug.contextScore})`);
  }

  return lines.join("\n");
}

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

function getOccurrenceReplaceStart(occurrence: SelectedWordOccurrence): number {
  return occurrence.replaceStart ?? occurrence.start;
}

function getOccurrenceReplaceEnd(occurrence: SelectedWordOccurrence): number {
  return occurrence.replaceEnd ?? occurrence.end;
}

function getOccurrenceReplaceText(occurrence: SelectedWordOccurrence): string {
  return occurrence.replaceText || occurrence.word;
}

export function restorePreviousReplacements(): void {
  const replaced = document.querySelectorAll(".rwf-replacement");
  log("restorePreviousReplacements.start", { count: replaced.length });
  const parentSet = new Set<Node & ParentNode>();

  for (const el of Array.from(replaced)) {
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
  questEntry?: QuestEntry,
  translatedFrom?: string,
  debug?: {
    cache: "hit" | "miss";
    contextScore: number;
    contextMatch: "exact" | "fuzzy" | "none";
  },
): HTMLElement {
  const wrapper = document.createElement(questEntry ? "button" : "abbr");
  wrapper.className = questEntry
    ? "rwf-replacement rwf-quest-target"
    : "rwf-replacement";
  wrapper.setAttribute("data-original", originalWord);
  if (transcription) {
    wrapper.setAttribute("data-transcription", transcription);
  }
  wrapper.setAttribute(
    "title",
    buildReplacementTitle(originalWord, transcription, translatedFrom, debug),
  );
  wrapper.textContent = translatedWord;

  if (questEntry) {
    wrapper.setAttribute("data-rwf-quest-id", questEntry.questId);
    wrapper.setAttribute("data-rwf-quest-type", questEntry.type);
    wrapper.setAttribute("tabindex", "0");
    wrapper.setAttribute("type", "button");
    wrapper.setAttribute("aria-haspopup", "dialog");
    wrapper.classList.toggle("is-answered", questEntry.answered);
    wrapper.classList.toggle(
      "is-correct",
      questEntry.answered && questEntry.answeredCorrectly,
    );
    wrapper.classList.toggle(
      "is-incorrect",
      questEntry.answered && !questEntry.answeredCorrectly,
    );
  }

  return wrapper;
}

export function replaceWordsOnPage(
  occurrences: SelectedWordOccurrence[],
  translationMap: TranslationMap,
  questEntryByOccurrenceId: Record<string, QuestEntry> = {},
): void {
  const occurrencesByNode = new Map<Text, SelectedWordOccurrence[]>();
  const replacementByWord: Record<string, number> = {};
  let totalReplacements = 0;
  let staleOccurrences = 0;
  let overlappingOccurrences = 0;

  for (const occurrence of occurrences) {
    if (!occurrencesByNode.has(occurrence.node)) {
      occurrencesByNode.set(occurrence.node, []);
    }
    occurrencesByNode.get(occurrence.node)?.push(occurrence);
  }

  for (const [node, nodeOccurrences] of occurrencesByNode.entries()) {
    const text = node.nodeValue || "";
    let hasAny = false;
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();
    const validOccurrences = nodeOccurrences
      .filter((occurrence) => {
        const entry = translationMap[occurrence.id];
        if (!entry) return false;
        if (
          text.slice(
            getOccurrenceReplaceStart(occurrence),
            getOccurrenceReplaceEnd(occurrence),
          ) !== getOccurrenceReplaceText(occurrence)
        ) {
          staleOccurrences += 1;
          return false;
        }
        const translated =
          typeof entry === "string" ? entry : String(entry.translated || "");
        return Boolean(translated);
      })
      .sort(
        (a, b) =>
          getOccurrenceReplaceStart(a) - getOccurrenceReplaceStart(b) ||
          getOccurrenceReplaceEnd(a) - getOccurrenceReplaceEnd(b),
      );

    for (const occurrence of validOccurrences) {
      const entry = translationMap[occurrence.id];
      if (!entry) continue;
      const translated =
        typeof entry === "string" ? entry : String(entry.translated || "");
      const transcription =
        typeof entry === "string" ? "" : String(entry.transcription || "");
      const debug = typeof entry === "string" ? undefined : entry.debug;
      const replaceStart = getOccurrenceReplaceStart(occurrence);
      const replaceEnd = getOccurrenceReplaceEnd(occurrence);
      const replaceText = getOccurrenceReplaceText(occurrence);
      if (replaceStart < lastIndex) {
        overlappingOccurrences += 1;
        continue;
      }
      hasAny = true;
      if (replaceStart > lastIndex) {
        fragment.appendChild(
          document.createTextNode(text.slice(lastIndex, replaceStart)),
        );
      }

      fragment.appendChild(
        createReplacementElement(
          replaceText,
          replaceText === occurrence.word
            ? adjustCase(occurrence.word, translated)
            : translated,
          transcription,
          questEntryByOccurrenceId[occurrence.id],
          occurrence.phrase,
          debug,
        ),
      );
      lastIndex = replaceEnd;
      replacementByWord[occurrence.normalizedWord] =
        (replacementByWord[occurrence.normalizedWord] || 0) + 1;
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
    staleOccurrences,
    overlappingOccurrences,
    replacementByWord,
    translationMap,
  });
}
