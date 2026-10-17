import { createRequire } from "node:module";

import type { TerminalSize } from "../session/contracts.js";
import { validateTerminalSize } from "./size.js";
import { sanitizeForOuterRenderer } from "./control-sequence-policy.js";

interface BufferLine {
  translateToString(trimRight?: boolean): string;
}

interface ActiveBuffer {
  readonly cursorX: number;
  readonly cursorY: number;
  readonly length: number;
  getLine(y: number): BufferLine | undefined;
}

interface HeadlessTerminal {
  readonly buffer: { readonly active: ActiveBuffer };
  write(data: string, callback?: () => void): void;
  dispose(): void;
}

type HeadlessTerminalConstructor = new (options: {
  cols: number;
  rows: number;
  scrollback: number;
  allowProposedApi: true;
  logLevel: "off";
}) => HeadlessTerminal;

interface CommonJsHeadlessModule {
  Terminal: HeadlessTerminalConstructor;
}

const require = createRequire(import.meta.url);
const { Terminal } = require("@xterm/headless") as CommonJsHeadlessModule;
const MAX_SNAPSHOT_LINES = 1_000;

export interface ScreenSnapshot {
  columns: number;
  rows: number;
  lines: readonly string[];
  cursor: { x: number; y: number };
}

/** A bounded, in-memory VT screen model for untrusted child-process output. */
export class ScreenModel {
  readonly #size: TerminalSize;
  readonly #terminal: HeadlessTerminal;
  #pendingWrite: Promise<void> = Promise.resolve();

  constructor(size: TerminalSize) {
    this.#size = validateTerminalSize(size);
    this.#terminal = new Terminal({
      cols: size.columns,
      rows: size.rows,
      scrollback: MAX_SNAPSHOT_LINES,
      allowProposedApi: true,
      logLevel: "off"
    });
  }

  write(data: string): Promise<void> {
    const sanitized = sanitizeForOuterRenderer(data);
    const nextWrite = this.#pendingWrite.then(
      () =>
        new Promise<void>((resolve) => {
          this.#terminal.write(sanitized, resolve);
        })
    );

    this.#pendingWrite = nextWrite;
    return nextWrite;
  }

  snapshot(): ScreenSnapshot {
    const active = this.#terminal.buffer.active;
    const firstLine = Math.max(0, active.length - MAX_SNAPSHOT_LINES);
    const lines: string[] = [];

    for (let index = firstLine; index < active.length; index += 1) {
      lines.push(active.getLine(index)?.translateToString(true) ?? "");
    }

    return {
      columns: this.#size.columns,
      rows: this.#size.rows,
      lines,
      cursor: { x: active.cursorX, y: active.cursorY }
    };
  }

  dispose(): void {
    this.#terminal.dispose();
  }
}
