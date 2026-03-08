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
  phrase?: string;
  prev?: string;
  next?: string;
  node: Text;
  start: number;
  end: number;
  replaceStart: number;
  replaceEnd: number;
  replaceText: string;
};

function buildContextualOccurrence(
  node: Text,
  nodeIndex: number,
  text: string,
  token: TextToken,
  tokenIndex: number,
  tokens: TextToken[],
): SelectedWordOccurrence {
  const prevToken = tokens[tokenIndex - 1];
  const nextToken = tokens[tokenIndex + 1];
  const replaceStart = prevToken ? prevToken.start : token.start;
  const replaceEnd = nextToken ? nextToken.end : token.end;
  const replaceText = text.slice(replaceStart, replaceEnd);
  const contextWordCount =
    Number(Boolean(prevToken)) + Number(Boolean(nextToken));

  return {
    id: `${nodeIndex}:${token.start}`,
    word: token.word,
    normalizedWord: token.normalizedWord,
    phrase: contextWordCount > 0 ? replaceText : undefined,
    prev: prevToken?.normalizedWord,
    next: nextToken?.normalizedWord,
    node,
    start: token.start,
    end: token.end,
    replaceStart,
    replaceEnd,
    replaceText,
  };
}

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
      occurrences.push(
        buildContextualOccurrence(
          node,
          nodeIndex,
          text,
          token,
          tokenIndex,
          tokens,
        ),
      );
    });
  });

  if (occurrences.length === 0) return [];

  for (let index = occurrences.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const tmp = occurrences[index];
    occurrences[index] = occurrences[swapIndex];
    occurrences[swapIndex] = tmp;
  }

  const selected: SelectedWordOccurrence[] = [];
  const occupiedRangesByNode = new Map<
    Text,
    Array<{ start: number; end: number }>
  >();

  for (const occurrence of occurrences) {
    if (selected.length >= count) break;
    const occupiedRanges = occupiedRangesByNode.get(occurrence.node) || [];
    const overlaps = occupiedRanges.some(
      (range) =>
        occurrence.replaceStart < range.end &&
        occurrence.replaceEnd > range.start,
    );
    if (overlaps) continue;
    occupiedRanges.push({
      start: occurrence.replaceStart,
      end: occurrence.replaceEnd,
    });
    occupiedRangesByNode.set(occurrence.node, occupiedRanges);
    selected.push(occurrence);
  }

  log("pickRandomWordOccurrences.complete", {
    requested: count,
    eligibleOccurrences: occurrences.length,
    selectedCount: selected.length,
    selected: selected.map((occurrence) => ({
      id: occurrence.id,
      word: occurrence.word,
      phrase: occurrence.phrase,
      prev: occurrence.prev,
      next: occurrence.next,
    })),
  });
  return selected;
}
