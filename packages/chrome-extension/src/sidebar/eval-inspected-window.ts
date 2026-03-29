export const evalInspectedWindowJson = <T>(script: string, label: string) =>
  new Promise<{ payload: T | null; error: string | null }>((resolve) => {
    chrome.devtools.inspectedWindow.eval(script, (result, e) => {
      if (e?.isException) {
        const error =
          (typeof e.value === "string" && e.value) ||
          (typeof e.description === "string" && e.description) ||
          `Failed to capture ${label}`;

        resolve({ payload: null, error });
        return;
      }

      if (typeof result !== "string") {
        console.warn(`Failed to capture ${label}`, e);
        resolve({ payload: null, error: `Failed to capture ${label}` });
        return;
      }

      try {
        resolve({ payload: JSON.parse(result) as T, error: null });
      } catch (error) {
        console.warn(`Failed to parse ${label}`, error);
        resolve({ payload: null, error: `Failed to parse ${label}` });
      }
    });
  });
