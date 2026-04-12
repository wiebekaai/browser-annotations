import { createSignal } from "solid-js";
import { getSourceContext } from "~/sidebar/sources";
import type { SourceContext } from "~/sidebar/sources";
import { evalInspectedWindowJson } from "~/sidebar/eval-inspected-window";

export type PageContext = {
  href: string;
  origin: string;
  userAgent: string;
  devicePixelRatio: number;
  viewport: {
    width: number;
    height: number;
  };
};

export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SelectionContext = {
  page: PageContext;
  boundingBox: BoundingBox;
  source?: SourceContext;
};

function getSelectionContextPayload() {
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

  const getBoundingBox = (element: Element): BoundingBox => {
    const rect = element.getBoundingClientRect();
    let x = rect.x;
    let y = rect.y;
    let currentDocument = element.ownerDocument;

    while (currentDocument.defaultView?.frameElement instanceof Element) {
      const frameElement = currentDocument.defaultView.frameElement;
      const frameRect = frameElement.getBoundingClientRect();

      x += frameRect.x + frameElement.clientLeft;
      y += frameRect.y + frameElement.clientTop;
      currentDocument = frameElement.ownerDocument;
    }

    return { x, y, width: rect.width, height: rect.height };
  };

  const getPageContext = (): PageContext => {
    const url = new URL(window.location.href);
    const viewport = window.visualViewport
      ? {
          width: window.visualViewport.width,
          height: window.visualViewport.height,
        }
      : {
          width: window.innerWidth,
          height: window.innerHeight,
        };

    return {
      href: url.href,
      origin: url.origin,
      userAgent: navigator.userAgent,
      devicePixelRatio: window.devicePixelRatio,
      viewport,
    };
  };

  const selected = (globalThis as { $0?: unknown }).$0 ?? null;

  if (!isElementNode(selected) && !isCommentNode(selected) && !isTextNode(selected)) {
    throw new Error("The current devtools selection is not an element, comment, or text node.");
  }

  const scopeElement = getScopeElement(selected);
  const page = getPageContext();
  const boundingBox = getBoundingBox(scopeElement);
  const source = getSourceContext(scopeElement);

  return JSON.stringify({
    page,
    boundingBox,
    ...(source ? { source } : {}),
  });
}

const resolveSelectionContext = async (): Promise<SelectionContext | null> => {
  const script = `
(() => {
  const getSourceContext = ${getSourceContext};
  return (${getSelectionContextPayload})();
})();
`;

  const { payload, error } = await evalInspectedWindowJson<SelectionContext>(script, "context");

  if (!payload) {
    if (error) {
      console.warn(error);
    }

    return null;
  }

  return payload;
};

export function createSelectionContext() {
  const [selectionContext, setSelectionContext] = createSignal<SelectionContext | null>(null);
  const [isLoading, setIsLoading] = createSignal(false);
  // Ignore stale async results when context is re-loaded before the previous one completes.
  let latestRequestId = 0;

  const load = async () => {
    const requestId = ++latestRequestId;
    setIsLoading(true);

    const context = await resolveSelectionContext();

    if (requestId !== latestRequestId) {
      return selectionContext();
    }

    setSelectionContext(context);
    setIsLoading(false);

    return context;
  };

  return {
    selectionContext,
    isLoading,
    load,
  };
}
