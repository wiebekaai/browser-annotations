import type { BoundingBox } from "~/sidebar/selection-context";

const SCREENSHOT_PADDING = 0;

function captureScreenshot(tabId: number): Promise<string | null> {
  return chrome.runtime.sendMessage({ type: "captureVisibleTab", tabId }).catch(() => null);
}

function cropScreenshot(
  dataUrl: string,
  boundingBox: BoundingBox,
  devicePixelRatio: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const padding = SCREENSHOT_PADDING * devicePixelRatio;
      const x = Math.max(0, Math.floor(boundingBox.x * devicePixelRatio - padding));
      const y = Math.max(0, Math.floor(boundingBox.y * devicePixelRatio - padding));
      const right = Math.min(
        img.width,
        Math.ceil((boundingBox.x + boundingBox.width) * devicePixelRatio + padding),
      );
      const bottom = Math.min(
        img.height,
        Math.ceil((boundingBox.y + boundingBox.height) * devicePixelRatio + padding),
      );
      const w = Math.max(1, right - x);
      const h = Math.max(1, bottom - y);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);

      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export async function captureCroppedScreenshot(
  boundingBox: BoundingBox,
  devicePixelRatio: number,
): Promise<string | null> {
  try {
    const dataUrl = await captureScreenshot(chrome.devtools.inspectedWindow.tabId);
    if (!dataUrl) return null;
    return await cropScreenshot(dataUrl, boundingBox, devicePixelRatio);
  } catch {
    return null;
  }
}
