import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/content/state", () => ({
  contentState: {
    currentSettings: {
      debugLogs: false,
    },
  },
  log: vi.fn(),
}));

import { replaceWordsOnPage } from "../../../src/content/replacements";
import type { TranslationMap } from "../../../src/shared/messages";
import type { SelectedWordOccurrence } from "../../../src/content/word-selection";

type FakeTextNode = {
  nodeValue: string;
  replacedWith: FakeDocumentFragment | null;
  replaceWith: (fragment: FakeDocumentFragment) => void;
};

type FakeElement = {
  className: string;
  textContent: string;
  attributes: Record<string, string>;
  setAttribute: (name: string, value: string) => void;
};

type FakeDocumentFragment = {
  children: Array<FakeTextNode | FakeElement>;
  appendChild: (child: FakeTextNode | FakeElement) => void;
};

function createFakeTextNode(nodeValue: string): FakeTextNode {
  return {
    nodeValue,
    replacedWith: null,
    replaceWith(fragment) {
      this.replacedWith = fragment;
    },
  };
}

function createFakeDocument() {
  return {
    createDocumentFragment(): FakeDocumentFragment {
      return {
        children: [],
        appendChild(child) {
          this.children.push(child);
        },
      };
    },
    createTextNode(text: string): FakeTextNode {
      return createFakeTextNode(text);
    },
    createElement(): FakeElement {
      return {
        className: "",
        textContent: "",
        attributes: {},
        setAttribute(name: string, value: string) {
          this.attributes[name] = value;
        },
      };
    },
  };
}

function serializeFragment(fragment: FakeDocumentFragment | null): string {
  if (!fragment) return "";
  return fragment.children
    .map((child) => {
      if ("nodeValue" in child) {
        return child.nodeValue;
      }

      return `<abbr data-original="${child.attributes["data-original"]}">${child.textContent}</abbr>`;
    })
    .join("");
}

function getFirstAbbrAttributes(fragment: FakeDocumentFragment | null) {
  if (!fragment) return null;
  return fragment.children.find((child) => "attributes" in child) || null;
}

function createOccurrence(
  node: FakeTextNode,
  id: string,
  word: string,
  start: number,
  end: number,
): SelectedWordOccurrence {
  return {
    id,
    word,
    normalizedWord: word.toLocaleLowerCase(),
    prev: undefined,
    next: undefined,
    node: node as unknown as Text,
    start,
    end,
  };
}

describe("replaceWordsOnPage", () => {
  beforeEach(() => {
    vi.stubGlobal("document", createFakeDocument());
  });

  it("replaces only the targeted occurrence", () => {
    const node = createFakeTextNode("apple banana apple");
    const occurrences = [createOccurrence(node, "target", "apple", 13, 18)];
    const translationMap: TranslationMap = {
      target: { translated: "pomme", transcription: "" },
    };

    replaceWordsOnPage(occurrences, translationMap);

    expect(serializeFragment(node.replacedWith)).toBe(
      'apple banana <abbr data-original="apple">pomme</abbr>',
    );
  });

  it("skips stale ranges and still applies valid replacements safely", () => {
    const node = createFakeTextNode("apple banana");
    const occurrences = [
      createOccurrence(node, "stale", "orange", 0, 6),
      createOccurrence(node, "valid", "banana", 6, 12),
    ];
    const translationMap: TranslationMap = {
      stale: { translated: "naranja", transcription: "" },
      valid: { translated: "platano", transcription: "" },
    };

    replaceWordsOnPage(occurrences, translationMap);

    expect(serializeFragment(node.replacedWith)).toBe(
      'apple <abbr data-original="banana">platano</abbr>',
    );
  });

  it("adds cache debug details to the tooltip in debug mode", async () => {
    const { contentState } = await import("../../../src/content/state");
    contentState.currentSettings.debugLogs = true;

    const node = createFakeTextNode("apple");
    const occurrences = [createOccurrence(node, "target", "apple", 0, 5)];
    const translationMap: TranslationMap = {
      target: {
        translated: "pomme",
        transcription: "pom",
        debug: {
          cache: "hit",
          contextScore: 3,
          contextMatch: "exact",
        },
      },
    };

    replaceWordsOnPage(occurrences, translationMap);

    const abbr = getFirstAbbrAttributes(node.replacedWith);
    expect(abbr && abbr.attributes.title).toBe(
      "apple (pom)\ncache: hit\nctx: exact (3)",
    );

    contentState.currentSettings.debugLogs = false;
  });
});
