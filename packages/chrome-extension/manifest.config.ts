import { defineManifest } from "@crxjs/vite-plugin";

const iconSet = {
  16: "icon.png",
  32: "icon.png",
  48: "icon.png",
  128: "icon.png",
} as const;

export default defineManifest({
  manifest_version: 3,
  name: "Browser Annotations",
  description: "Capture feedback from the Chrome DevTools.",
  version: "1.0",
  icons: iconSet,
  permissions: ["storage"],
  host_permissions: ["<all_urls>"],
  devtools_page: "src/devtools/index.html",
  background: {
    service_worker: "src/background.ts",
    type: "module",
  },
});
