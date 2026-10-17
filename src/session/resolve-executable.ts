import { existsSync } from "node:fs";
import { win32 } from "node:path";

type FileExists = (candidate: string) => boolean;

/**
 * node-pty's Windows spawn path requires an explicit executable suffix for
 * PATH-installed provider shims. Resolve only the executable file; arguments
 * remain separate and unchanged.
 */
export function resolvePtyExecutable(
  file: string,
  env: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform,
  fileExists: FileExists = existsSync
): string {
  if (platform !== "win32") {
    return file;
  }

  const pathValue = Object.entries(env).find(([name]) => name.toUpperCase() === "PATH")?.[1];
  if (pathValue === undefined) {
    return file;
  }

  const extensions = win32.extname(file) === "" ? [".exe", ".cmd", ".bat"] : [""];
  for (const directory of pathValue.split(";")) {
    const normalizedDirectory = directory.replace(/^"|"$/g, "");
    if (normalizedDirectory === "") {
      continue;
    }

    for (const extension of extensions) {
      const candidate = win32.join(normalizedDirectory, `${file}${extension}`);
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return file;
}
