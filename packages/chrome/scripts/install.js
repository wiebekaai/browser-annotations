#!/usr/bin/env node

import { cp, rm, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const colorEnabled = !process.env.NO_COLOR && (!!process.env.FORCE_COLOR || !!process.stdout.isTTY);
const c = (code, text) => (colorEnabled ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = (text) => c(1, text);
const dim = (text) => c(2, text);
const green = (text) => c(32, text);
const cyan = (text) => c(36, text);
const red = (text) => c(31, text);

const distDir = join(import.meta.dirname, "..", "dist");
const targetDir = join(homedir(), "browser-annotations", "chrome-extension");

const isUpdate = await access(targetDir)
  .then(() => true)
  .catch(() => false);

try {
  await rm(targetDir, { recursive: true, force: true });
  await cp(distDir, targetDir, { recursive: true });

  const manifest = JSON.parse(await readFile(join(targetDir, "manifest.json"), "utf-8"));

  console.log("");
  console.log(bold("browser-annotations"));
  console.log("");
  console.log(`${green(isUpdate ? "Updated to" : "Installed")} v${manifest.version}`);
  console.log(dim(targetDir));
  console.log("");

  if (isUpdate) {
    console.log(` 1. Reload the extension in ${cyan("chrome://extensions")}`);
    console.log(" 2. Update your agent:");
    console.log(`    - pi: ${cyan("pi update")}`);
    console.log(`    - Claude Code: ${cyan("/plugin update claude@browser-annotations")}`);
  } else {
    console.log(` 1. Open ${cyan("chrome://extensions")}`);
    console.log(` 2. Enable "Developer mode" (top right)`);
    console.log(` 3. Click "Load unpacked" and select ${cyan(targetDir)}`);
    console.log(" 4. Set up your agent:");
    console.log(`    - pi: ${cyan("pi install git:github.com/wiebekaai/browser-annotations")}`);
    console.log(
      `    - Claude Code: ${cyan("/plugin marketplace add wiebekaai/browser-annotations")} + ${cyan("/plugin install claude@browser-annotations")}`,
    );
  }

  console.log("");
} catch (error) {
  console.error(`${red("Installation failed:")} ${error.message}`);
  process.exitCode = 1;
}
