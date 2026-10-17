import { describe, expect, it } from "vitest";

import { buildChildLaunch } from "../../src/launch/command.js";

describe("buildChildLaunch", () => {
  it("preserves each Codex argument without shell quoting", () => {
    expect(
      buildChildLaunch("codex", ["--model", "gpt test", "한글"], "C:/work", {})
    ).toEqual({
      file: "codex",
      args: ["--model", "gpt test", "한글"],
      cwd: "C:/work",
      env: {}
    });
  });

  it("maps Claude to its fixed executable", () => {
    expect(buildChildLaunch("claude", [], "C:/workspace", { TERM: "xterm-256color" })).toEqual({
      file: "claude",
      args: [],
      cwd: "C:/workspace",
      env: { TERM: "xterm-256color" }
    });
  });

  it("rejects an unknown provider before launch", () => {
    expect(() => buildChildLaunch("" as never, [], "C:/work", {})).toThrow("Unsupported provider");
  });

  it("copies and freezes passthrough arguments", () => {
    const source = ["--model", "gpt test"];
    const launch = buildChildLaunch("codex", source, "C:/work", {});

    source[0] = "--dangerous";

    expect(launch.args).toEqual(["--model", "gpt test"]);
    expect(() => (launch.args as string[]).push("--mutate")).toThrow(TypeError);
  });
});
