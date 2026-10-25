import type { ScreenColor, ScreenSnapshot, ScreenStyle } from "./screen-model.js";

/**
 * Produces a small, fixed outer frame from parsed screen text only. It never
 * relays child-originated control bytes into the parent terminal.
 */
export function renderSnapshot(snapshot: ScreenSnapshot): string {
  return `\u001b[2J\u001b[H${snapshot.styledLines.map(renderStyledLine).join("\r\n")}\u001b[0m${renderCursor(snapshot.cursor, snapshot.columns, snapshot.rows)}`;
}

/** Repaints the first frame fully, then limits later writes to changed rows. */
export class OuterRenderer {
  #previousFrame: RenderedFrame | undefined;

  render(snapshot: ScreenSnapshot): string {
    const currentLines = snapshot.styledLines.map(renderStyledLine);
    const frame: RenderedFrame = { lines: currentLines, cursor: clampCursor(snapshot.cursor, snapshot.columns, snapshot.rows) };
    const previous = this.#previousFrame;
    this.#previousFrame = frame;

    if (previous === undefined || previous.lines.length !== frame.lines.length) {
      return `\u001b[2J\u001b[H${frame.lines.join("\r\n")}\u001b[0m${renderAbsoluteCursor(frame.cursor)}`;
    }

    const changedRows: string[] = [];
    for (let index = 0; index < frame.lines.length; index += 1) {
      if (frame.lines[index] !== previous.lines[index]) {
        changedRows.push(`\u001b[${index + 1};1H\u001b[2K${frame.lines[index]}`);
      }
    }

    if (changedRows.length === 0 && cursorEquals(frame.cursor, previous.cursor)) return "";
    return `${changedRows.join("")}\u001b[0m${renderAbsoluteCursor(frame.cursor)}`;
  }
}

interface CursorPosition {
  readonly column: number;
  readonly row: number;
}

interface RenderedFrame {
  readonly lines: readonly string[];
  readonly cursor: CursorPosition;
}

/** Renders only parsed VT screen segments; it does not accept raw PTY bytes. */
export function renderStyledLine(line: ScreenSnapshot["styledLines"][number]): string {
  return line.segments.map(renderSegment).join("");
}

function renderSegment(segment: { text: string; style: ScreenStyle }): string {
  const sequence = styleSequence(segment.style);
  return sequence === "" ? segment.text : `${sequence}${segment.text}\u001b[0m`;
}

function styleSequence(style: ScreenStyle): string {
  const parameters: number[] = [];
  if (style.bold === true) parameters.push(1);
  if (style.dim === true) parameters.push(2);
  if (style.italic === true) parameters.push(3);
  if (style.underline === true) parameters.push(4);
  appendColor(parameters, 38, style.foreground);
  appendColor(parameters, 48, style.background);

  return parameters.length === 0 ? "" : `\u001b[${parameters.join(";")}m`;
}

function appendColor(parameters: number[], prefix: 38 | 48, color: ScreenColor | undefined): void {
  if (color === undefined) return;

  if (color.kind === "palette" && Number.isInteger(color.value) && color.value >= 0 && color.value <= 255) {
    parameters.push(prefix, 5, color.value);
    return;
  }

  if (color.kind === "rgb" && Number.isInteger(color.value) && color.value >= 0 && color.value <= 0xff_ffff) {
    parameters.push(prefix, 2, color.value >> 16, (color.value >> 8) & 0xff, color.value & 0xff);
  }
}

function renderCursor(cursor: ScreenSnapshot["cursor"], columns: number, rows: number): string {
  return renderAbsoluteCursor(clampCursor(cursor, columns, rows));
}

function renderAbsoluteCursor(cursor: CursorPosition): string {
  return `\u001b[${cursor.row + 1};${cursor.column + 1}H\u001b[?25h`;
}

function clampCursor(cursor: ScreenSnapshot["cursor"], columns: number, rows: number): CursorPosition {
  return {
    column: clamp(cursor.x, columns),
    row: clamp(cursor.y, rows),
  };
}

function clamp(value: number, size: number): number {
  return Math.max(0, Math.min(size - 1, value));
}

function cursorEquals(left: CursorPosition, right: CursorPosition): boolean {
  return left.column === right.column && left.row === right.row;
}
