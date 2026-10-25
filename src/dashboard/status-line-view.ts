import type { Provider } from "../launch/command.js";

import type { ProjectContext } from "./project-context.js";

export type StatusLifecycle = "connecting" | "running" | "exited" | "error";

export interface LiveStatusLineContext {
  readonly provider: Provider;
  readonly lifecycle: StatusLifecycle;
  readonly startedAt: Date;
  readonly now: Date;
  readonly project: ProjectContext;
  readonly tabs: number;
}

/** Produces one background-free TGX status line from local, verifiable facts. */
export function createStatusLine(context: LiveStatusLineContext, columns: number): string {
  const project = context.project.branch === undefined
    ? context.project.projectName
    : `${context.project.projectName} @ ${context.project.branch}${context.project.dirty ? "*" : ""}`;
  const usage = context.provider === "codex" ? "USAGE /status" : "USAGE UNAVAILABLE";
  const value = [
    "TGX",
    context.provider.toUpperCase(),
    context.lifecycle.toUpperCase(),
    formatElapsed(context.startedAt, context.now),
    `TABS ${context.tabs}`,
    usage,
    project,
  ].join(" | ");
  return fitPrintableAscii(value, columns);
}

function formatElapsed(startedAt: Date, now: Date): string {
  const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 1_000));
  const hours = Math.floor(elapsedSeconds / 3_600);
  const minutes = Math.floor((elapsedSeconds % 3_600) / 60);
  const seconds = elapsedSeconds % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");
  const paddedSeconds = String(seconds).padStart(2, "0");
  return hours === 0 ? `${paddedMinutes}:${paddedSeconds}` : `${String(hours).padStart(2, "0")}:${paddedMinutes}:${paddedSeconds}`;
}

function fitPrintableAscii(value: string, columns: number): string {
  if (!Number.isSafeInteger(columns) || columns <= 0) throw new RangeError("columns must be a positive safe integer");
  return value.replace(/[^\x20-\x7e]/g, "?").slice(0, columns).padEnd(columns, " ");
}
