import type { Annotation } from "~/sidebar/annotations";
import { isValidAnnotation } from "~/sidebar/annotations";

type PersistedState = {
  origin: string;
  webhookEnabled: boolean;
  webhookUrl: string;
  annotations: Annotation[];
};

const storageKey = (origin: string) => `feedback:${origin}`;

const DEFAULT_WEBHOOK_URL = "http://127.0.0.1:3330/";

export async function loadState(origin: string) {
  const key = storageKey(origin);
  const result = await chrome.storage.local.get([key]);
  const raw = result[key] as PersistedState | undefined;

  if (
    !raw ||
    typeof raw.origin !== "string" ||
    raw.origin !== origin ||
    typeof raw.webhookEnabled !== "boolean" ||
    typeof raw.webhookUrl !== "string"
  ) {
    if (raw) await chrome.storage.local.remove(key);
    return {
      webhookEnabled: true,
      webhookUrl: DEFAULT_WEBHOOK_URL,
      annotations: [] as Annotation[],
    };
  }

  return {
    webhookEnabled: raw.webhookEnabled,
    webhookUrl: raw.webhookUrl,
    annotations: Array.isArray(raw.annotations) ? raw.annotations.filter(isValidAnnotation) : [],
  };
}

export async function saveState(
  origin: string,
  state: { webhookEnabled: boolean; webhookUrl: string; annotations: Annotation[] },
) {
  try {
    await chrome.storage.local.set({
      [storageKey(origin)]: {
        origin,
        ...state,
      } satisfies PersistedState,
    });
  } catch (error) {
    console.error("Failed to save sidebar state", error);
  }
}

export function onStorageChange(
  getOrigin: () => string | null,
  apply: (state: {
    webhookEnabled: boolean;
    webhookUrl: string;
    annotations: Annotation[];
  }) => void,
) {
  const listener = (changes: { [key: string]: chrome.storage.StorageChange }, area: string) => {
    const origin = getOrigin();
    if (area !== "local" || !origin) return;

    const raw = changes[storageKey(origin)]?.newValue as PersistedState | undefined;
    if (!raw || typeof raw.webhookEnabled !== "boolean" || typeof raw.webhookUrl !== "string")
      return;

    apply({
      webhookEnabled: raw.webhookEnabled,
      webhookUrl: raw.webhookUrl,
      annotations: Array.isArray(raw.annotations) ? raw.annotations.filter(isValidAnnotation) : [],
    });
  };

  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
