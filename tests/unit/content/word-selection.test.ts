import { describe, expect, it, vi } from "vitest";

import {
  isCandidateWord,
  pickRandomWordOccurrences,
} from "../../../src/content/word-selection";

describe("word selection", () => {
  it("treats the same word in different contexts as distinct occurrences", () => {
    const node = { nodeValue: "Left bank and right bank" } as Text;

    const occurrences = pickRandomWordOccurrences([node], 10);
    const bankOccurrences = occurrences
      .filter((occurrence) => occurrence.normalizedWord === "bank")
      .sort((a, b) => a.start - b.start);

    expect(bankOccurrences).toHaveLength(2);
    expect(bankOccurrences.map((occurrence) => occurrence.id)).toEqual([
      "0:5",
      "0:20",
    ]);
    expect(bankOccurrences.map((occurrence) => occurrence.prev)).toEqual([
      "left",
      "right",
    ]);
  });

  it("captures one-word left and right context for each occurrence", () => {
    const node = { nodeValue: "Alpha bravo charlie delta" } as Text;

    const occurrences = pickRandomWordOccurrences([node], 10);
    const bravo = occurrences.find(
      (occurrence) => occurrence.normalizedWord === "bravo",
    );
    const charlie = occurrences.find(
      (occurrence) => occurrence.normalizedWord === "charlie",
    );

    expect(bravo).toMatchObject({ prev: "alpha", next: "charlie" });
    expect(charlie).toMatchObject({ prev: "bravo", next: "delta" });
  });

  it("samples occurrences instead of unique words", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0);
    const node = { nodeValue: "apple apple banana cherry" } as Text;

    const occurrences = pickRandomWordOccurrences([node], 2);

    expect(occurrences).toHaveLength(2);
    expect(
      occurrences.every((occurrence) => isCandidateWord(occurrence.word)),
    ).toBe(true);
    expect(new Set(occurrences.map((occurrence) => occurrence.id)).size).toBe(
      2,
    );

    randomSpy.mockRestore();
  });
});
