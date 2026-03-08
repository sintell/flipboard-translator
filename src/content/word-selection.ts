import { MIN_WORD_LEN } from "../shared/constants";
import { log } from "./state";

const TOKEN_REGEX = /\p{L}[\p{L}\p{M}'’-]*/gu;

type TextToken = {
  word: string;
  normalizedWord: string;
  start: number;
  end: number;
};

export type SelectedWordOccurrence = {
  id: string;
  word: string;
  normalizedWord: string;
  prev?: string;
  next?: string;
  node: Text;
  start: number;
  end: number;
};

export function isCandidateWord(token: string): boolean {
  if (!token) return false;
  if (token.length < MIN_WORD_LEN) return false;
  if (!/\p{L}/u.test(token)) return false;
  if (/^[\p{Lu}\d]+$/u.test(token)) return false;
  return true;
}

function collectTokens(text: string): TextToken[] {
  const tokens: TextToken[] = [];
  TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    const word = match[0];
    tokens.push({
      word,
      normalizedWord: word.toLocaleLowerCase(),
      start: match.index,
      end: match.index + word.length,
    });
  }

  return tokens;
}

export function pickRandomWordOccurrences(
  textNodes: Text[],
  count: number,
): SelectedWordOccurrence[] {
  const occurrences: SelectedWordOccurrence[] = [];

  textNodes.forEach((node, nodeIndex) => {
    const text = node.nodeValue || "";
    const tokens = collectTokens(text);

    tokens.forEach((token, tokenIndex) => {
      if (!isCandidateWord(token.normalizedWord)) return;
      occurrences.push({
        id: `${nodeIndex}:${token.start}`,
        word: token.word,
        normalizedWord: token.normalizedWord,
        prev: tokens[tokenIndex - 1]?.normalizedWord,
        next: tokens[tokenIndex + 1]?.normalizedWord,
        node,
        start: token.start,
        end: token.end,
      });
    });
  });

  if (occurrences.length === 0) return [];

  for (let index = occurrences.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const tmp = occurrences[index];
    occurrences[index] = occurrences[swapIndex];
    occurrences[swapIndex] = tmp;
  }

  const selected = occurrences.slice(0, Math.min(count, occurrences.length));
  log("pickRandomWordOccurrences.complete", {
    requested: count,
    eligibleOccurrences: occurrences.length,
    selectedCount: selected.length,
    selected: selected.map((occurrence) => ({
      id: occurrence.id,
      word: occurrence.word,
      prev: occurrence.prev,
      next: occurrence.next,
    })),
  });
  return selected;
}
