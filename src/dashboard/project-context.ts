import { execFileSync } from "node:child_process";
import { basename } from "node:path";

const GIT_TIMEOUT_MS = 250;

export interface ProjectContext {
  readonly projectName: string;
  readonly branch?: string;
  readonly dirty: boolean;
}

export interface GitCommand {
  readonly args: readonly string[];
  readonly cwd: string;
  readonly timeoutMs: number;
}

export type GitExecutor = (command: GitCommand) => string;

/** Reads a bounded local project summary; failures never affect a child session. */
export function readProjectContext(cwd: string, execute: GitExecutor = executeGit): ProjectContext {
  const projectName = basename(cwd) || cwd;
  try {
    const branch = execute({ args: ["branch", "--show-current"], cwd, timeoutMs: GIT_TIMEOUT_MS }).trim();
    if (branch === "") return { projectName, dirty: false };
    const dirty = execute({ args: ["status", "--porcelain", "--untracked-files=no"], cwd, timeoutMs: GIT_TIMEOUT_MS }).trim() !== "";
    return { projectName, branch, dirty };
  } catch {
    return { projectName, dirty: false };
  }
}

function executeGit(command: GitCommand): string {
  return execFileSync("git", [...command.args], {
    cwd: command.cwd,
    encoding: "utf8",
    timeout: command.timeoutMs,
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });
}
