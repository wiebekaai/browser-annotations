import { TraceMap, originalPositionFor } from "@jridgewell/trace-mapping";
import { createSignal } from "solid-js";
import type { SourceContext, SourceLocation } from "~/sidebar/sources";
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

type EvaluatedSourceContext = SourceContext & {
  generated?: true;
};

const remapReactSourceLocation = async (
  generatedUrl: string,
  location: SourceLocation,
): Promise<SourceLocation> => {
  try {
    const source = await (await fetch(generatedUrl)).text();
    const sourceMap = [
      ...source.matchAll(/sourceMappingURL=data:application\/json;base64,([^\s]+)/g),
    ].at(-1)?.[1];

    if (!sourceMap) {
      return location;
    }

    const original = originalPositionFor(new TraceMap(atob(sourceMap)), {
      line: location.line,
      column: location.column - 1,
    });

    if (!original.source || original.line === null || original.column === null) {
      return location;
    }

    return {
      file: new URL(original.source, generatedUrl).pathname,
      line: original.line,
      column: original.column + 1,
    };
  } catch {
    return location;
  }
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

  const getSourceContext = (element: Element): EvaluatedSourceContext | undefined => {
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
      tag?: number;
      type?: unknown;
      _debugOwner?: ReactFiber | null;
      _debugSource?: {
        fileName?: unknown;
        lineNumber?: unknown;
        columnNumber?: unknown;
      } | null;
      _debugStack?: Error;
    };

    const getFiber = (el: Element): ReactFiber | null => {
      const key = Object.getOwnPropertyNames(el).find((k) => k.startsWith("__reactFiber$"));
      return key ? ((el as unknown as Record<string, ReactFiber>)[key] ?? null) : null;
    };

    const REACT_SOURCE_FILE_REGEX = /\.(jsx|tsx|ts|js)$/;
    const REACT_BUNDLED_FILE_PATTERNS = [
      /(\.min|bundle|chunk|vendor|vendors|runtime|polyfill|polyfills)\.(js|mjs|cjs)$/i,
      /(chunk|bundle|vendor|vendors|runtime|polyfill|polyfills|framework|app|main|index)[-_.][A-Za-z0-9_-]{4,}\.(js|mjs|cjs)$/i,
      /[-_.][\da-f]{20,}\.(js|mjs|cjs)$/i,
      /\/dist\/|\/build\/|\/\.next\/|\/node_modules\/|\.webpack\.|\.vite\.|\.turbopack\./i,
    ];

    const isReactSourceFile = (file: string) =>
      REACT_SOURCE_FILE_REGEX.test(file) &&
      !REACT_BUNDLED_FILE_PATTERNS.some((pattern) => pattern.test(file));

    const toReactSourceFile = (url: string): string | undefined => {
      const webpackPath = url.match(/webpack-internal:\/\/\/(?:\([^)]+\)\/)?\.\/(.+)$/)?.[1];
      const file = (webpackPath ? `/${webpackPath}` : url.replace(/^https?:\/\/[^/]+/, "")).split(
        "?",
      )[0]!;

      return isReactSourceFile(file) ? file : undefined;
    };

    const parseReactStackLocation = (stack: string): SourceLocation | undefined => {
      for (const line of stack.split("\n")) {
        const match = line.match(/at .+? \((.+):(\d+):(\d+)\)/);

        if (!match) {
          continue;
        }

        const file = toReactSourceFile(match[1]!);

        if (!file) {
          continue;
        }

        return { file, line: Number(match[2]!), column: Number(match[3]!) };
      }

      return undefined;
    };

    const getDebugSourceLocation = (fiber: ReactFiber): SourceLocation | undefined => {
      const source = fiber._debugSource;

      if (!source || typeof source.fileName !== "string" || typeof source.lineNumber !== "number") {
        return undefined;
      }

      const file = toReactSourceFile(source.fileName);

      if (!file) {
        return undefined;
      }

      return {
        file,
        line: source.lineNumber,
        column: typeof source.columnNumber === "number" ? source.columnNumber : 1,
      };
    };

    const getReactSourceContext = (): EvaluatedSourceContext | undefined => {
      const fiber = getFiber(element);

      if (!fiber) {
        return undefined;
      }

      let current: ReactFiber | null = fiber;

      while (current) {
        const debugSourceLocation = getDebugSourceLocation(current);

        if (debugSourceLocation) {
          return { framework: "react", location: debugSourceLocation };
        }

        if (current._debugStack) {
          const stackLocation = parseReactStackLocation(current._debugStack.stack ?? "");

          if (stackLocation) {
            return { framework: "react", location: stackLocation, generated: true };
          }
        }

        if (current._debugOwner?._debugStack) {
          const ownerLocation = parseReactStackLocation(
            current._debugOwner._debugStack.stack ?? "",
          );

          if (ownerLocation) {
            return { framework: "react", location: ownerLocation, generated: true };
          }
        }

        current = current.return;
      }

      return { framework: "react" };
    };

    const getSolidSourceContext = (): SourceContext | undefined => {
      if (!(globalThis as { Solid$$?: unknown }).Solid$$) {
        return undefined;
      }

      let next: Element | null = element;

      while (next) {
        const value = next.getAttribute?.("data-source-loc");
        const match = value?.match(/^(.+):(\d+):(\d+)$/);

        if (match) {
          const file = match[1]!.startsWith("/") ? match[1]! : `/${match[1]}`;

          if (!file.includes("/node_modules/")) {
            return {
              framework: "solid",
              location: { file, line: Number(match[2]!), column: Number(match[3]!) },
            };
          }
        }

        next = getParentElement(next);
      }

      return { framework: "solid" };
    };

    return getSvelteSourceContext() ?? getReactSourceContext() ?? getSolidSourceContext();
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

  const { payload, error } = await evalInspectedWindowJson<
    SelectionContext & {
      source?: EvaluatedSourceContext;
    }
  >(script, "context");

  if (!payload) {
    if (error) {
      console.warn(error);
    }

    return null;
  }

  if (
    payload.source?.framework !== "react" ||
    !payload.source.generated ||
    !payload.source.location
  ) {
    return payload;
  }

  const location = payload.source.location;
  const { generated: _generated, ...source } = payload.source;
  const generatedUrl = new URL(location.file, payload.page.href).href;

  return {
    ...payload,
    source: {
      ...source,
      location: await remapReactSourceLocation(generatedUrl, location),
    },
  };
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
