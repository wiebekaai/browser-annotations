export type SourceLocation = {
  file: string;
  line: number;
  column: number;
};

export type SourceContext = {
  framework: "svelte" | "react";
  location?: SourceLocation;
};

/**
 * Returns the first supported framework source context for an element.
 * Checks Svelte first, then React.
 *
 * Svelte: reads `__svelte_meta` from the element or its ancestor chain (dev mode).
 * React: walks the Fiber chain looking for `_debugStack` (dev mode).
 */
export function getSourceContext(element: Element): SourceContext | undefined {
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object";

  const getParentElement = (current: Element): Element | null => {
    if (current.parentElement) {
      return current.parentElement;
    }

    const root = current.getRootNode();
    return root instanceof ShadowRoot ? root.host : null;
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

  /**
   * Reads `__svelte_meta` from the element or its ancestor chain.
   * Only available in Svelte dev mode.
   *
   * @tested Svelte 4, SvelteKit 2
   */
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

  // Parse the first non-node_modules file location from a React debug stack trace.
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

  /**
   * Walks the React Fiber chain looking for `_debugStack`.
   * Only available in React dev mode.
   *
   * @tested React 18, Next.js 14
   */
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
}
