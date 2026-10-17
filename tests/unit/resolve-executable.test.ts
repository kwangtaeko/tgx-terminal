import { describe, expect, it } from "vitest";

import { resolvePtyExecutable } from "../../src/session/resolve-executable.js";

describe("resolvePtyExecutable", () => {
  it("uses a concrete Windows executable from PATH before spawning a PTY", () => {
    const found = new Set(["C:\\tools\\codex.cmd", "C:\\tools\\claude.exe"]);
    const exists = (candidate: string): boolean => found.has(candidate);

    expect(resolvePtyExecutable("codex", { Path: "C:\\tools;C:\\other" }, "win32", exists)).toBe(
      "C:\\tools\\codex.cmd"
    );
    expect(resolvePtyExecutable("claude", { Path: "C:\\tools;C:\\other" }, "win32", exists)).toBe(
      "C:\\tools\\claude.exe"
    );
  });

  it("leaves an executable unchanged when a platform-specific resolution is unavailable", () => {
    expect(resolvePtyExecutable("codex", { PATH: "/usr/bin" }, "linux", () => false)).toBe("codex");
    expect(resolvePtyExecutable("codex", { Path: "C:\\tools" }, "win32", () => false)).toBe("codex");
  });
});
