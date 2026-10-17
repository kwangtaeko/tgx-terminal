import type { ChildLaunch } from "../launch/command.js";

export interface Disposable {
  dispose(): void;
}

export interface TerminalSize {
  columns: number;
  rows: number;
}

export interface SessionExit {
  exitCode: number;
  signal?: number;
}

export interface PtyProcess {
  write(data: string): void;
  resize(columns: number, rows: number): void;
  kill(signal?: string): void;
  onData(listener: (data: string) => void): Disposable;
  onExit(listener: (event: SessionExit) => void): Disposable;
}

export type PtyFactory = (launch: ChildLaunch, size: TerminalSize) => PtyProcess;
