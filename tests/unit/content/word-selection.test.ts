import { describe, expect, it, vi } from "vitest";

import {
  isCandidateWord,
  pickRandomWordOccurrences,
} from "../../../src/content/word-selection";

describe("word selection", () => {
  it("treats the same word in different contexts as distinct occurrences", () => {
    const leftNode = { nodeValue: "x bank y" } as Text;
    const rightNode = { nodeValue: "q bank" } as Text;

    const occurrences = pickRandomWordOccurrences([leftNode, rightNode], 10);
    const bankOccurrences = occurrences
      .filter((occurrence) => occurrence.normalizedWord === "bank")
      .sort((a, b) => a.id.localeCompare(b.id));

    expect(bankOccurrences).toHaveLength(2);
    expect(bankOccurrences.map((occurrence) => occurrence.id)).toEqual([
      "0:2",
      "1:2",
    ]);
    expect(bankOccurrences.map((occurrence) => occurrence.prev)).toEqual([
      "x",
      "q",
    ]);
    expect(bankOccurrences.map((occurrence) => occurrence.phrase)).toEqual([
      "x bank y",
      "q bank",
    ]);
  });

  it("captures left and right phrase context for middle tokens", () => {
    const bravoNode = { nodeValue: "a bravo c" } as Text;
    const charlieNode = { nodeValue: "b charlie d" } as Text;

    const occurrences = pickRandomWordOccurrences([bravoNode, charlieNode], 10);
    const bravo = occurrences.find(
      (occurrence) => occurrence.normalizedWord === "bravo",
    );
    const charlie = occurrences.find(
      (occurrence) => occurrence.normalizedWord === "charlie",
    );

    expect(bravo).toMatchObject({ prev: "a", next: "c" });
    expect(charlie).toMatchObject({ prev: "b", next: "d" });
    expect(bravo?.phrase).toBe("a bravo c");
    expect(bravo?.replaceText).toBe("a bravo c");
    expect(charlie?.phrase).toBe("b charlie d");
  });

  it("uses one-sided contextual phrases at text boundaries", () => {
    const firstNode = { nodeValue: "Alpha b" } as Text;
    const lastNode = { nodeValue: "b charlie" } as Text;

    const occurrences = pickRandomWordOccurrences(
      [firstNode, lastNode],
      10,
    ).sort((a, b) => a.id.localeCompare(b.id));

    expect(occurrences[0]).toMatchObject({
      word: "Alpha",
      prev: undefined,
      next: "b",
      phrase: "Alpha b",
      replaceText: "Alpha b",
    });
    expect(occurrences[1]).toMatchObject({
      word: "charlie",
      prev: "b",
      next: undefined,
      phrase: "b charlie",
      replaceText: "b charlie",
    });
  });

  it("skips overlapping contextual spans when sampling", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const node = { nodeValue: "apple apple banana cherry" } as Text;

    const occurrences = pickRandomWordOccurrences([node], 2);

    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.id).toBe("0:6");
    expect(
      occurrences.every((occurrence) => isCandidateWord(occurrence.word)),
    ).toBe(true);

    randomSpy.mockRestore();
  });
});
