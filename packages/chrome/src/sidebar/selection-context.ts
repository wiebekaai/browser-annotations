import { createSignal } from "solid-js";
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

// Stringified and eval'd in the inspected page via chrome.devtools.inspectedWindow.eval.
// All dependencies must be inlined — external references get mangled by the bundler.
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

  const getSourceContext = (element: Element): SourceContext | undefined => {
    const isRecord = (value: unknown): value is Record<string, unknown> =>
      !!value && typeof value === "object";

    const getParentElement = (current: Element): Element | null => {
      if (current.parentElement) {
        return current.parentElement;
      }

      const root = current.getRootNode();
      return root instanceof ShadowRoot ? root.host : null;
    };

    type SourceLocation = {
      file: string;
      line: number;
      column: number;
    };

    const toSourceLocation = (value: unknown): SourceLocation | undefined => {
      if (!isRecord(value)) {
        return undefined;
      }

      const file = value.file;
      const line = value.line;
      const column = value.column;

      if (typeof file !== "string" || typeof line !== "number" || typeof column !== "number") {
        return undefined;
      }

      return { file, line, column };
    };

    const getSvelteMeta = (current: Element): Record<string, unknown> | undefined => {
      let next: Element | null = current;

      while (next) {
        const meta = (next as Element & { __svelte_meta?: unknown }).__svelte_meta;

        if (isRecord(meta)) {
          return meta;
        }

        next = getParentElement(next);
      }

      return undefined;
    };

    const getSvelteSourceContext = (): SourceContext | undefined => {
      const meta = getSvelteMeta(element);

      if (!meta) {
        return undefined;
      }

      const location = toSourceLocation(meta.loc);

      return {
        framework: "svelte",
        ...(location ? { location } : {}),
      };
    };

    type ReactFiber = {
      return: ReactFiber | null;
      _debugStack?: Error;
    };

    const getFiber = (el: Element): ReactFiber | null => {
      const key = Object.getOwnPropertyNames(el).find((k) => k.startsWith("__reactFiber$"));
      return key ? ((el as unknown as Record<string, ReactFiber>)[key] ?? null) : null;
    };

    const parseSourceLocation = (stack: string): SourceLocation | undefined => {
      for (const line of stack.split("\n")) {
        const match = line.match(/at .+? \(https?:\/\/[^/]+(\/[^?:]+?)(?:\?[^:]*)?:(\d+):(\d+)\)/);

        if (!match) {
          continue;
        }

        const file = match[1]!;
        const lineStr = match[2]!;
        const columnStr = match[3]!;

        if (file.includes("/node_modules/")) {
          continue;
        }

        return { file, line: Number(lineStr), column: Number(columnStr) };
      }

      return undefined;
    };

    const getReactSourceContext = (): SourceContext | undefined => {
      const fiber = getFiber(element);

      if (!fiber) {
        return undefined;
      }

      let current: ReactFiber | null = fiber;

      while (current) {
        if (current._debugStack) {
          const location = parseSourceLocation(current._debugStack.stack ?? "");

          return {
            framework: "react",
            ...(location ? { location } : {}),
          };
        }

        current = current.return;
      }

      return { framework: "react" };
    };

    return getSvelteSourceContext() ?? getReactSourceContext();
  };

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
  const script = `(${getSelectionContextPayload})();`;

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
