import type { TranslationMap } from "../shared/messages";
import type { QuestSessionRecord } from "./state";
import type { SelectedWordOccurrence } from "./word-selection";

export type QuestCandidate = {
  occurrenceId: string;
  questId: string;
  sourceText: string;
  translatedText: string;
  type: "word" | "phrase";
};

export type QuestEntry = QuestCandidate & {
  options: string[];
  answered: boolean;
  answeredCorrectly: boolean;
};

const MAX_ACTIVE_QUESTS = 6;
const QUEST_TARGET_RATIO = 0.4;
const MIN_ANSWER_OPTIONS = 3;

function normalizeText(value: string): string {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

function formatAnswerText(value: string): string {
  return normalizeText(value);
}

function dedupeTexts(values: string[], blockedValue: string): string[] {
  const blocked = normalizeText(blockedValue);
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || normalized === blocked || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(
      String(value || "")
        .trim()
        .replace(/\s+/g, " "),
    );
  }

  return result;
}

function buildQuestId(
  occurrence: SelectedWordOccurrence,
  translatedText: string,
  type: "word" | "phrase",
): string {
  return [
    occurrence.id,
    type,
    normalizeText(occurrence.replaceText || occurrence.word),
    normalizeText(translatedText),
  ].join("|");
}

function createQuestCandidate(
  occurrence: SelectedWordOccurrence,
  translationMap: TranslationMap,
): QuestCandidate | null {
  const entry = translationMap[occurrence.id];
  if (!entry) return null;

  const translatedText = String(entry.translated || "").trim();
  const sourceText = formatAnswerText(
    occurrence.replaceText || occurrence.word,
  );
  if (!translatedText || !sourceText) return null;

  const type = occurrence.phrase ? "phrase" : "word";
  return {
    occurrenceId: occurrence.id,
    questId: buildQuestId(occurrence, translatedText, type),
    sourceText,
    translatedText,
    type,
  };
}

function pickQuestCandidates(candidates: QuestCandidate[]): QuestCandidate[] {
  if (candidates.length === 0) return [];

  const targetCount = Math.min(
    MAX_ACTIVE_QUESTS,
    Math.max(1, Math.round(candidates.length * QUEST_TARGET_RATIO)),
  );
  const words = candidates.filter((candidate) => candidate.type === "word");
  const phrases = candidates.filter((candidate) => candidate.type === "phrase");
  const picked: QuestCandidate[] = [];
  const usedIds = new Set<string>();

  function tryAdd(candidate: QuestCandidate | undefined): void {
    if (
      !candidate ||
      usedIds.has(candidate.questId) ||
      picked.length >= targetCount
    ) {
      return;
    }
    usedIds.add(candidate.questId);
    picked.push(candidate);
  }

  if (phrases.length > 0) tryAdd(phrases[0]);
  if (words.length > 0) tryAdd(words[0]);

  for (const candidate of candidates) {
    tryAdd(candidate);
  }

  return picked;
}

function buildOptionsForCandidate(
  candidate: QuestCandidate,
  candidates: QuestCandidate[],
): string[] {
  const sameTypePool = dedupeTexts(
    candidates
      .filter((entry) => entry.type === candidate.type)
      .map((entry) => entry.sourceText),
    candidate.sourceText,
  );
  const fallbackPool = dedupeTexts(
    candidates.map((entry) => entry.sourceText),
    candidate.sourceText,
  ).filter((value) => !sameTypePool.includes(value));
  const distractors = sameTypePool
    .concat(fallbackPool)
    .slice(0, MIN_ANSWER_OPTIONS - 1);

  if (distractors.length < MIN_ANSWER_OPTIONS - 1) {
    return [];
  }

  const options = [candidate.sourceText].concat(distractors);
  const answerIndex = options.findIndex(
    (value) => value === candidate.sourceText,
  );
  const rotation = candidate.questId.length % options.length;
  const rotated = options.slice(rotation).concat(options.slice(0, rotation));
  const rotatedAnswerIndex =
    (answerIndex - rotation + options.length) % options.length;

  if (rotatedAnswerIndex === 0 && rotated.length > 1) {
    const swapped = rotated.slice();
    const swapIndex = 1;
    const temp = swapped[0];
    swapped[0] = swapped[swapIndex];
    swapped[swapIndex] = temp;
    return swapped;
  }

  return rotated;
}

export function buildQuestEntries(
  occurrences: SelectedWordOccurrence[],
  translationMap: TranslationMap,
  sessionRecords: Record<string, QuestSessionRecord>,
): QuestEntry[] {
  const candidates = occurrences
    .map((occurrence) => createQuestCandidate(occurrence, translationMap))
    .filter((candidate): candidate is QuestCandidate => Boolean(candidate));
  const selected = pickQuestCandidates(candidates);

  return selected
    .map((candidate) => {
      const options = buildOptionsForCandidate(candidate, candidates);
      if (options.length < MIN_ANSWER_OPTIONS) return null;
      const session = sessionRecords[candidate.questId];
      return {
        ...candidate,
        options,
        answered: Boolean(session && session.answered),
        answeredCorrectly: Boolean(session && session.correct),
      };
    })
    .filter((entry): entry is QuestEntry => Boolean(entry));
}

export function getQuestProgress(
  sessionRecords: Record<string, QuestSessionRecord>,
): { correct: number; answered: number } | null {
  const recordValues = Object.values(sessionRecords);
  const answered = recordValues.filter((record) => record.answered).length;
  const correct = recordValues.filter((record) => record.correct).length;

  if (answered === 0 && correct === 0) return null;

  return {
    correct,
    answered,
  };
}
