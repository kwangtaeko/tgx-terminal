import { describe, expect, it } from "vitest";

import { readProjectContext, type GitExecutor } from "../../src/dashboard/project-context.js";

describe("project context", () => {
  it("reads the checked-out branch and tracked dirty state once", () => {
    const calls: string[][] = [];
    const execute: GitExecutor = ({ args }) => {
      calls.push([...args]);
      return args[0] === "branch" ? "main\n" : " M src/cli.ts\n";
    };

    expect(readProjectContext("C:\\work\\tgx-terminal", execute)).toEqual({
      projectName: "tgx-terminal",
      branch: "main",
      dirty: true
    });
    expect(calls).toEqual([
      ["branch", "--show-current"],
      ["status", "--porcelain", "--untracked-files=no"]
    ]);
  });

  it("uses the cwd basename when git is unavailable", () => {
    const execute: GitExecutor = () => { throw new Error("not a git repository"); };

    expect(readProjectContext("C:\\work\\scratch", execute)).toEqual({
      projectName: "scratch",
      dirty: false
    });
  });

  it("does not report untracked files as tracked changes", () => {
    const execute: GitExecutor = ({ args }) => args[0] === "branch" ? "feature/tgx\n" : "";

    expect(readProjectContext("C:\\work\\tgx-terminal", execute)).toEqual({
      projectName: "tgx-terminal",
      branch: "feature/tgx",
      dirty: false
    });
  });
});
