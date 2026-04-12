import { mkdir, symlink, lstat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

try {
  const distDir = join(import.meta.dirname, "..", "dist");
  const targetDir = join(homedir(), "browser-annotations");
  const linkPath = join(targetDir, "chrome");

  await mkdir(targetDir, { recursive: true });

  try {
    const stat = await lstat(linkPath);
    if (stat.isSymbolicLink()) await unlink(linkPath);
  } catch {}

  await symlink(distDir, linkPath);

  console.log(`Linked extension to ${linkPath}`);
  console.log("Load as unpacked extension in chrome://extensions");
} catch (error) {
  console.warn(`browser-annotations: skipped symlink setup (${error.message})`);
}
