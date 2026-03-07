import { log } from "./state";

export function shouldSkipElement(el: Element | null): boolean {
  if (!el) return true;
  if (el.closest("script, style, noscript, textarea, input, select, option, code, pre, a") || el.closest(".rwf-replacement")) {
    return true;
  }
  if ((el as HTMLElement).isContentEditable) return true;

  const style = globalThis.getComputedStyle ? getComputedStyle(el) : null;
  if (!style) return false;
  if (style.visibility === "hidden" || style.display === "none") return true;
  return false;
}

export function collectTextNodes(): Text[] {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      const parent = (node as Text).parentElement;
      if (!parent || shouldSkipElement(parent)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  log("collectTextNodes.complete", { nodeCount: nodes.length });
  return nodes;
}
