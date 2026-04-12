import { createSignal, onCleanup, onMount } from "solid-js";
import { evalInspectedWindowJson } from "~/sidebar/eval-inspected-window";

export type Selection = {
  content?: string;
  frame?: string[];
  nodeType?: "comment" | "text";
  selector: string;
};

// Stringified and eval'd in the inspected page via chrome.devtools.inspectedWindow.eval.
// All dependencies must be inlined — external references get mangled by the bundler.
function getSelectionPayload() {
  type QueryRoot = Document | ShadowRoot;

  const isElementNode = (value: unknown): value is Element =>
    !!value &&
    typeof value === "object" &&
    "nodeType" in value &&
    value.nodeType === Node.ELEMENT_NODE;

  const isCommentNode = (value: unknown): value is Comment =>
    !!value &&
    typeof value === "object" &&
    "nodeType" in value &&
    value.nodeType === Node.COMMENT_NODE;

  const isTextNode = (value: unknown): value is Text =>
    !!value &&
    typeof value === "object" &&
    "nodeType" in value &&
    value.nodeType === Node.TEXT_NODE;

  // Escapes arbitrary DOM values so they can be safely used in CSS selectors.
  const escapeCssIdentifier = (value: string): string => {
    if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
      return CSS.escape(value);
    }

    return Array.from(value)
      .map((character, index) => {
        if (/[a-zA-Z0-9_-]/.test(character) && !(index === 0 && /\d/.test(character))) {
          return character;
        }

        const codePoint = character.codePointAt(0);
        return codePoint == null ? "" : "\\" + codePoint.toString(16) + " ";
      })
      .join("");
  };

  const escapeAttributeValue = (value: string): string =>
    value.replaceAll("\\", "\\\\").replaceAll('"', '\\"');

  const getNthChild = (element: Element): number => {
    let index = 1;
    let sibling = element.previousElementSibling;

    while (sibling) {
      index += 1;
      sibling = sibling.previousElementSibling;
    }

    return index;
  };

  const getNthOfType = (element: Element): number => {
    let index = 1;
    let sibling = element.previousElementSibling;

    while (sibling) {
      if (sibling.localName === element.localName) {
        index += 1;
      }

      sibling = sibling.previousElementSibling;
    }

    return index;
  };

  const isUniqueMatch = (root: QueryRoot, selector: string, element: Element): boolean => {
    try {
      const matches = root.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch {
      return false;
    }
  };

  const isUniqueAmongSiblings = (element: Element, selector: string): boolean => {
    const parent = element.parentElement;

    if (!parent) {
      return true;
    }

    try {
      const matches = parent.querySelectorAll(":scope > " + selector);
      return matches.length === 1 && matches[0] === element;
    } catch {
      return false;
    }
  };

  const getAttributeCandidates = (element: Element): string[] => {
    const tagName = escapeCssIdentifier(element.localName);
    const candidates: string[] = [];
    const attributeNames = [
      "data-testid",
      "data-test",
      "data-qa",
      "data-cy",
      "name",
      "aria-label",
      "role",
      "type",
      "for",
      "placeholder",
      "alt",
      "title",
      "href",
      "src",
    ];

    if (element.localName === "script") {
      attributeNames.unshift(
        "src",
        "type",
        "nonce",
        "integrity",
        "crossorigin",
        "referrerpolicy",
        "async",
        "defer",
        "nomodule",
      );
    }

    for (const attributeName of attributeNames) {
      if (!element.hasAttribute(attributeName)) {
        continue;
      }

      const value = element.getAttribute(attributeName);
      const selector =
        value === ""
          ? tagName + "[" + escapeCssIdentifier(attributeName) + "]"
          : tagName +
            "[" +
            escapeCssIdentifier(attributeName) +
            '="' +
            escapeAttributeValue(value ?? "") +
            '"]';

      if (!candidates.includes(selector)) {
        candidates.push(selector);
      }
    }

    return candidates;
  };

  const getClassCandidates = (element: Element): string[] => {
    const tagName = escapeCssIdentifier(element.localName);
    const classNames = [...new Set(Array.from(element.classList).filter(Boolean))].map(
      (className) => escapeCssIdentifier(className),
    );

    if (classNames.length === 0) {
      return [];
    }

    const candidates = [tagName + "." + classNames.join(".")];

    for (const className of classNames) {
      candidates.push(tagName + "." + className);
    }

    return candidates;
  };

  const getSelectorCandidates = (element: Element): string[] => {
    const tagName = escapeCssIdentifier(element.localName);
    const candidates: string[] = [];

    if (element.id) {
      candidates.push("#" + escapeCssIdentifier(element.id));
    }

    if (["html", "head", "body"].includes(element.localName)) {
      candidates.push(tagName);
    }

    candidates.push(...getAttributeCandidates(element));
    candidates.push(...getClassCandidates(element));
    candidates.push(tagName);
    candidates.push(tagName + ":nth-of-type(" + getNthOfType(element) + ")");
    candidates.push(tagName + ":nth-child(" + getNthChild(element) + ")");

    return [...new Set(candidates)];
  };

  const isNthOfTypeCandidate = (candidate: string): boolean => candidate.includes(":nth-of-type(");
  const isNthChildCandidate = (candidate: string): boolean => candidate.includes(":nth-child(");
  const isPositionalCandidate = (candidate: string): boolean =>
    isNthOfTypeCandidate(candidate) || isNthChildCandidate(candidate);

  const getPreferredPathSegment = (element: Element, candidates: string[]): string => {
    for (const candidate of candidates) {
      if (candidate.startsWith("#") || isUniqueAmongSiblings(element, candidate)) {
        return candidate;
      }
    }

    return (
      candidates.find((candidate) => isNthOfTypeCandidate(candidate)) ||
      candidates.find((candidate) => isNthChildCandidate(candidate)) ||
      candidates[candidates.length - 1] ||
      escapeCssIdentifier(element.localName)
    );
  };

  const buildSelectorWithinRoot = (element: Element, root: QueryRoot): string => {
    const segments: string[] = [];
    let current: Element | null = element;

    while (current) {
      const candidates = getSelectorCandidates(current);
      const directCandidates = candidates.filter((candidate) => !isPositionalCandidate(candidate));
      const fallbackCandidates = candidates.filter((candidate) => isPositionalCandidate(candidate));

      for (const candidate of directCandidates) {
        const selector = [candidate, ...segments].join(" > ");

        if (isUniqueMatch(root, selector, element)) {
          return selector;
        }
      }

      if (segments.length > 0) {
        for (const candidate of fallbackCandidates) {
          const selector = [candidate, ...segments].join(" > ");

          if (isUniqueMatch(root, selector, element)) {
            return selector;
          }
        }
      }

      segments.unshift(getPreferredPathSegment(current, candidates));
      current = current.parentElement;
    }

    return segments.join(" > ");
  };

  const getFrameSelectors = (element: Element): string[] => {
    const selectors: string[] = [];
    let currentDocument = element.ownerDocument;

    while (currentDocument.defaultView?.frameElement instanceof Element) {
      const frameElement = currentDocument.defaultView.frameElement;
      const frameRoot = frameElement.getRootNode() as QueryRoot;

      selectors.unshift(buildSelectorWithinRoot(frameElement, frameRoot));
      currentDocument = frameElement.ownerDocument;
    }

    return selectors;
  };

  const getScopeElement = (node: Element | Comment | Text): Element => {
    if (isElementNode(node)) {
      return node;
    }

    if (node.parentElement) {
      return node.parentElement;
    }

    if (node.parentNode instanceof ShadowRoot) {
      return node.parentNode.host;
    }

    return node.ownerDocument.documentElement;
  };

  const getNodeContent = (node: Comment | Text): string => node.data.trim();

  const serializeSelection = (selected: Element | Comment | Text): Selection => {
    const scopeElement = getScopeElement(selected);
    const root = scopeElement.getRootNode() as QueryRoot;
    const selector = buildSelectorWithinRoot(scopeElement, root);
    const frame = getFrameSelectors(scopeElement);

    return {
      selector,
      ...(frame.length > 0 ? { frame } : {}),
      ...(isCommentNode(selected)
        ? { nodeType: "comment" as const, content: getNodeContent(selected) }
        : isTextNode(selected)
          ? { nodeType: "text" as const, content: getNodeContent(selected) }
          : {}),
    };
  };

  const selected = (globalThis as { $0?: unknown }).$0 ?? null;

  if (!isElementNode(selected) && !isCommentNode(selected) && !isTextNode(selected)) {
    throw new Error("The current devtools selection is not an element, comment, or text node.");
  }

  return JSON.stringify({
    selection: serializeSelection(selected),
    origin: new URL(window.location.href).origin,
  });
}

export function createSelection() {
  const [selection, setSelection] = createSignal<Selection | null>(null);
  const [origin, setOrigin] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  // Ignore stale async eval results when the user changes the inspected element quickly.
  let latestSelectionRequestId = 0;

  const handleSelectionChanged = () => {
    const requestId = ++latestSelectionRequestId;

    const script = `
(() => {
  return (${getSelectionPayload})();
})();
`;

    evalInspectedWindowJson<{ selection: Selection; origin: string }>(script, "selection").then(
      ({ payload, error }) => {
        if (requestId !== latestSelectionRequestId) {
          return;
        }

        setError(error);

        if (!payload) {
          setSelection(null);
          return;
        }

        setSelection(payload.selection);
        setOrigin(payload.origin);
      },
    );
  };

  onMount(() => {
    chrome.devtools.panels.elements.onSelectionChanged.addListener(handleSelectionChanged);
    handleSelectionChanged();
  });

  onCleanup(() => {
    chrome.devtools.panels.elements.onSelectionChanged.removeListener(handleSelectionChanged);
  });

  return {
    selection,
    origin,
    error,
  };
}
