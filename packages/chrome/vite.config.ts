import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import solid from "vite-plugin-solid";
import manifest from "./manifest.config";

export default defineConfig({
  resolve: {
    alias: {
      "~": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  plugins: [crx({ manifest }), solid(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        sidebar: "src/sidebar/index.html",
      },
    },
  },
  server: {
    cors: {
      origin: [/chrome-extension:\/\//],
    },
  },
});
