import { describe, expect, it } from "vitest";

import { buildQuestEntries } from "../../../src/content/quest-game";
import type { TranslationMap } from "../../../src/shared/messages";
import type { SelectedWordOccurrence } from "../../../src/content/word-selection";

function createOccurrence(
  id: string,
  word: string,
  extra: Partial<SelectedWordOccurrence> = {},
): SelectedWordOccurrence {
  return {
    id,
    word,
    normalizedWord: word.toLocaleLowerCase(),
    phrase: undefined,
    prev: undefined,
    next: undefined,
    node: { nodeValue: word } as Text,
    start: 0,
    end: word.length,
    replaceStart: 0,
    replaceEnd: word.length,
    replaceText: word,
    ...extra,
  };
}

describe("quest game", () => {
  it("builds quest entries with mixed word and phrase targets when possible", () => {
    const occurrences = [
      createOccurrence("word-1", "apple"),
      createOccurrence("phrase-1", "bravo", {
        phrase: "alpha bravo charlie",
        replaceText: "alpha bravo charlie",
        replaceEnd: 19,
      }),
      createOccurrence("word-2", "banana"),
      createOccurrence("phrase-2", "echo", {
        phrase: "delta echo foxtrot",
        replaceText: "delta echo foxtrot",
        replaceEnd: 18,
      }),
      createOccurrence("word-3", "cherry"),
      createOccurrence("word-4", "dragonfruit"),
    ];
    const translationMap: TranslationMap = {
      "word-1": { translated: "pomme", transcription: "" },
      "phrase-1": { translated: "phrase-one", transcription: "" },
      "word-2": { translated: "platano", transcription: "" },
      "phrase-2": { translated: "phrase-two", transcription: "" },
      "word-3": { translated: "cereza", transcription: "" },
      "word-4": { translated: "pitaya", transcription: "" },
    };

    const entries = buildQuestEntries(occurrences, translationMap, {});

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => entry.type === "word")).toBe(true);
    expect(entries.some((entry) => entry.type === "phrase")).toBe(true);
    expect(
      entries.every((entry) => entry.options.includes(entry.sourceText)),
    ).toBe(true);
    expect(entries.every((entry) => entry.options.length === 3)).toBe(true);
  });

  it("reuses session answer state for rebuilt quest entries", () => {
    const occurrences = [
      createOccurrence("word-1", "apple"),
      createOccurrence("word-2", "banana"),
      createOccurrence("word-3", "cherry"),
    ];
    const translationMap: TranslationMap = {
      "word-1": { translated: "pomme", transcription: "" },
      "word-2": { translated: "platano", transcription: "" },
      "word-3": { translated: "cereza", transcription: "" },
    };

    const initialEntries = buildQuestEntries(occurrences, translationMap, {});
    expect(initialEntries).toHaveLength(1);

    const rebuiltEntries = buildQuestEntries(occurrences, translationMap, {
      [initialEntries[0].questId]: {
        answered: true,
        correct: true,
      },
    });

    expect(rebuiltEntries[0]).toMatchObject({
      questId: initialEntries[0].questId,
      answered: true,
      answeredCorrectly: true,
    });
  });

  it("skips quest targets that cannot build enough answer options", () => {
    const occurrences = [createOccurrence("word-1", "apple")];
    const translationMap: TranslationMap = {
      "word-1": { translated: "pomme", transcription: "" },
    };

    expect(buildQuestEntries(occurrences, translationMap, {})).toEqual([]);
  });
});
