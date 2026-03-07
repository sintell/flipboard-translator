import { MIN_WORD_LEN } from "../shared/constants";
import { log } from "./state";

export function isCandidateWord(token: string): boolean {
  if (!token) return false;
  if (token.length < MIN_WORD_LEN) return false;
  if (!/\p{L}/u.test(token)) return false;
  if (/^[\p{Lu}\d]+$/u.test(token)) return false;
  return true;
}

export function pickRandomWords(textNodes: Text[], count: number): string[] {
  const tokenRegex = /\p{L}[\p{L}\p{M}'’-]*/gu;
  const frequency = new Map<string, number>();

  for (const node of textNodes) {
    tokenRegex.lastIndex = 0;
    const text = node.nodeValue || "";
    let match: RegExpExecArray | null;
    while ((match = tokenRegex.exec(text)) !== null) {
      const normalized = match[0].toLocaleLowerCase();
      if (!isCandidateWord(normalized)) continue;
      frequency.set(normalized, (frequency.get(normalized) || 0) + 1);
    }
  }

  const pool = Array.from(frequency.keys());
  if (pool.length === 0) return [];

  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const tmp = pool[index];
    pool[index] = pool[swapIndex];
    pool[swapIndex] = tmp;
  }

  const selected = pool.slice(0, Math.min(count, pool.length));
  log("pickRandomWords.complete", {
    requested: count,
    uniqueEligible: pool.length,
    selectedCount: selected.length,
    selected,
    topFrequency: Array.from(frequency.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20),
  });
  return selected;
}
