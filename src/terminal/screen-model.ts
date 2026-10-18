import { createRequire } from "node:module";

import type { TerminalSize } from "../session/contracts.js";
import { validateTerminalSize } from "./size.js";
import { sanitizeForOuterRenderer } from "./control-sequence-policy.js";

interface BufferLine {
  translateToString(trimRight?: boolean): string;
  getCell(x: number): BufferCell | undefined;
}

interface BufferCell {
  getWidth(): number;
  getChars(): string;
  getFgColor(): number;
  getBgColor(): number;
  isBold(): number;
  isDim(): number;
  isItalic(): number;
  isUnderline(): number;
  isFgRGB(): boolean;
  isFgPalette(): boolean;
  isBgRGB(): boolean;
  isBgPalette(): boolean;
}

interface ActiveBuffer {
  readonly cursorX: number;
  readonly cursorY: number;
  readonly length: number;
  readonly viewportY: number;
  getLine(y: number): BufferLine | undefined;
}

interface HeadlessTerminal {
  readonly buffer: { readonly active: ActiveBuffer };
  write(data: string, callback?: () => void): void;
  resize(columns: number, rows: number): void;
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
  styledLines: readonly ScreenLine[];
  cursor: { x: number; y: number };
}

export interface ScreenColor {
  kind: "palette" | "rgb";
  value: number;
}

export interface ScreenStyle {
  foreground?: ScreenColor;
  background?: ScreenColor;
  bold?: true;
  dim?: true;
  italic?: true;
  underline?: true;
}

export interface ScreenSegment {
  text: string;
  style: ScreenStyle;
}

export interface ScreenLine {
  segments: readonly ScreenSegment[];
}

/** A bounded, in-memory VT screen model for untrusted child-process output. */
export class ScreenModel {
  #size: TerminalSize;
  readonly #terminal: HeadlessTerminal;
  #pendingWrite: Promise<void> = Promise.resolve();

  constructor(size: TerminalSize) {
    this.#size = validateTerminalSize(size);
    this.#terminal = new Terminal({
      cols: this.#size.columns,
      rows: this.#size.rows,
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

  resize(size: TerminalSize): void {
    const validatedSize = validateTerminalSize(size);
    this.#terminal.resize(validatedSize.columns, validatedSize.rows);
    this.#size = validatedSize;
  }

  snapshot(): ScreenSnapshot {
    const active = this.#terminal.buffer.active;
    const lines: string[] = [];
    const styledLines: ScreenLine[] = [];

    for (let index = active.viewportY; index < active.viewportY + this.#size.rows; index += 1) {
      const line = active.getLine(index);
      lines.push(line?.translateToString(true) ?? "");
      styledLines.push(snapshotLine(line, this.#size.columns));
    }

    return {
      columns: this.#size.columns,
      rows: this.#size.rows,
      lines,
      styledLines,
      cursor: { x: active.cursorX, y: active.cursorY }
    };
  }

  dispose(): void {
    this.#terminal.dispose();
  }
}

function snapshotLine(line: BufferLine | undefined, columns: number): ScreenLine {
  if (line === undefined) {
    return { segments: [] };
  }

  const segments: ScreenSegment[] = [];
  for (let column = 0; column < columns; column += 1) {
    const cell = line.getCell(column);
    if (cell === undefined || cell.getWidth() === 0) {
      continue;
    }

    const style = snapshotStyle(cell);
    const text = cell.getChars() || " ";
    const previous = segments.at(-1);
    if (previous !== undefined && stylesEqual(previous.style, style)) {
      previous.text += text;
    } else {
      segments.push({ text, style });
    }
  }

  trimDefaultWhitespace(segments);
  return { segments };
}

function snapshotStyle(cell: BufferCell): ScreenStyle {
  const style: ScreenStyle = {};
  const foreground = snapshotColor(cell.isFgPalette(), cell.isFgRGB(), cell.getFgColor());
  const background = snapshotColor(cell.isBgPalette(), cell.isBgRGB(), cell.getBgColor());

  if (foreground !== undefined) style.foreground = foreground;
  if (background !== undefined) style.background = background;
  if (cell.isBold() !== 0) style.bold = true;
  if (cell.isDim() !== 0) style.dim = true;
  if (cell.isItalic() !== 0) style.italic = true;
  if (cell.isUnderline() !== 0) style.underline = true;

  return style;
}

function snapshotColor(isPalette: boolean, isRgb: boolean, value: number): ScreenColor | undefined {
  if (isPalette && Number.isInteger(value) && value >= 0 && value <= 255) {
    return { kind: "palette", value };
  }
  if (isRgb && Number.isInteger(value) && value >= 0 && value <= 0xff_ffff) {
    return { kind: "rgb", value };
  }
  return undefined;
}

function stylesEqual(left: ScreenStyle, right: ScreenStyle): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function trimDefaultWhitespace(segments: ScreenSegment[]): void {
  while (segments.length > 0) {
    const last = segments.at(-1);
    if (last === undefined || Object.keys(last.style).length !== 0) {
      return;
    }

    last.text = last.text.replace(/\s+$/u, "");
    if (last.text !== "") {
      return;
    }
    segments.pop();
  }
}
