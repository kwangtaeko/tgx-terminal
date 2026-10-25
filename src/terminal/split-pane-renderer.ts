import type { PaneRect, SplitPaneLayout } from "../layout/split-pane-layout.js";
import type { ScreenLine, ScreenSnapshot } from "./screen-model.js";
import { renderStyledLine } from "./outer-renderer.js";

interface RenderedFrame {
  readonly geometry: string;
  readonly rows: readonly string[];
}

interface PositionedContent {
  readonly column: number;
  readonly text: string;
}

/** Safely composes two parsed VT snapshots without letting either pane clear the other. */
export class SplitPaneRenderer {
  #previousFrame: RenderedFrame | undefined;

  reset(): void {
    this.#previousFrame = undefined;
  }

  render(first: ScreenSnapshot, second: ScreenSnapshot, layout: SplitPaneLayout): string {
    validateSnapshotGeometry(first, layout.first, "first");
    validateSnapshotGeometry(second, layout.second, "second");

    const frame = createFrame(first, second, layout);
    const previous = this.#previousFrame;
    this.#previousFrame = frame;

    if (previous === undefined || previous.geometry !== frame.geometry || previous.rows.length !== frame.rows.length) {
      return `\u001b[2J\u001b[H${frame.rows.map((row, index) => renderRow(index, row)).join("")}\u001b[0m`;
    }

    const changedRows = frame.rows.flatMap((row, index) => row === previous.rows[index] ? [] : [renderRow(index, row)]);
    return changedRows.length === 0 ? "" : `${changedRows.join("")}\u001b[0m`;
  }
}

function createFrame(first: ScreenSnapshot, second: ScreenSnapshot, layout: SplitPaneLayout): RenderedFrame {
  const rows = Array.from({ length: frameRows(layout) }, (_, row) => createRow(first, second, layout, row));
  return {
    geometry: `${layout.orientation}:${layout.first.columns}x${layout.first.rows}:${layout.second.columns}x${layout.second.rows}`,
    rows,
  };
}

function createRow(first: ScreenSnapshot, second: ScreenSnapshot, layout: SplitPaneLayout, row: number): string {
  const contents: PositionedContent[] = [];
  addPaneLine(contents, first, layout.first, row);
  addSeparator(contents, layout.separator, layout.orientation, row);
  addPaneLine(contents, second, layout.second, row);
  contents.sort((left, right) => left.column - right.column);

  return contents.map((content) => writeAt(row, content)).join("");
}

function addPaneLine(contents: PositionedContent[], snapshot: ScreenSnapshot, rect: PaneRect, row: number): void {
  const lineIndex = row - rect.row;
  if (lineIndex < 0 || lineIndex >= rect.rows) return;
  const line = snapshot.styledLines[lineIndex] ?? EMPTY_LINE;
  contents.push({ column: rect.column, text: renderStyledLine(line) });
}

function addSeparator(
  contents: PositionedContent[],
  separator: PaneRect,
  orientation: SplitPaneLayout["orientation"],
  row: number
): void {
  if (row < separator.row || row >= separator.row + separator.rows) return;
  const text = orientation === "side-by-side" ? "|" : "-".repeat(separator.columns);
  contents.push({ column: separator.column, text });
}

function writeAt(row: number, content: PositionedContent): string {
  return content.column === 0 ? content.text : `\u001b[${row + 1};${content.column + 1}H${content.text}`;
}

function renderRow(index: number, row: string): string {
  return `\u001b[${index + 1};1H\u001b[2K${row}`;
}

function frameRows(layout: SplitPaneLayout): number {
  return Math.max(
    layout.first.row + layout.first.rows,
    layout.separator.row + layout.separator.rows,
    layout.second.row + layout.second.rows
  );
}

function validateSnapshotGeometry(snapshot: ScreenSnapshot, rect: PaneRect, name: string): void {
  if (snapshot.columns !== rect.columns || snapshot.rows !== rect.rows) {
    throw new RangeError(`${name} snapshot geometry does not match its pane`);
  }
}

const EMPTY_LINE: ScreenLine = { segments: [] };
