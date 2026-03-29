import type { ClassValue } from "clsx";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...classLists: ClassValue[]) => twMerge(clsx(classLists));

export const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

export const truncateSelector = (selector: string, maxChars = 40) => {
  if (selector.length <= maxChars) {
    return selector;
  }

  const trimmed = selector.trim();
  const lastPart = trimmed.includes(">") ? (trimmed.split(">").pop()?.trim() ?? trimmed) : trimmed;
  const shortened = trimmed.includes(">") ? `… > ${lastPart}` : trimmed;

  if (shortened.length <= maxChars) {
    return shortened;
  }

  if (maxChars <= 1) {
    return "…".slice(0, maxChars);
  }

  const suffix = "…";
  const prefix = shortened.startsWith("… > ") ? "… > " : "";
  const remaining = shortened.slice(prefix.length);
  const available = maxChars - prefix.length - suffix.length;

  if (available <= 0) {
    return `${prefix}${suffix}`.slice(0, maxChars);
  }

  return `${prefix}${remaining.slice(0, available)}${suffix}`;
};

export const formatHref = (href: string, maxChars = 80) => {
  try {
    const url = new URL(href);
    const clean = url.host + url.pathname.replace(/\/$/, "") + url.search;
    if (clean.length <= maxChars) return clean;
    return clean.slice(0, maxChars) + "…";
  } catch {
    if (href.length <= maxChars) return href;
    return href.slice(0, maxChars) + "…";
  }
};
