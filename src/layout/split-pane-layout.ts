import type { TerminalSize } from "../session/contracts.js";
import { validateTerminalSize } from "../terminal/size.js";

export type SplitOrientation = "side-by-side" | "stacked";

/** A zero-based rectangle within the child terminal canvas. */
export interface PaneRect {
  readonly column: number;
  readonly row: number;
  readonly columns: number;
  readonly rows: number;
}

export interface SplitPaneLayout {
  readonly orientation: SplitOrientation;
  readonly first: PaneRect;
  readonly separator: PaneRect;
  readonly second: PaneRect;
}

export interface SplitPaneConstraints {
  readonly minimumColumns: number;
  readonly minimumRows: number;
}

/**
 * Divides an already-owned child canvas into two non-overlapping panes and a
 * one-cell separator. Undefined signals that a caller should use one pane.
 */
export function computeSplitPaneLayout(
  canvas: TerminalSize,
  orientation: SplitOrientation,
  constraints: SplitPaneConstraints
): SplitPaneLayout | undefined {
  const validatedCanvas = validateTerminalSize(canvas);
  validateOrientation(orientation);
  validateConstraints(constraints);

  return orientation === "side-by-side"
    ? computeSideBySide(validatedCanvas, constraints)
    : computeStacked(validatedCanvas, constraints);
}

function computeSideBySide(
  canvas: TerminalSize,
  constraints: SplitPaneConstraints
): SplitPaneLayout | undefined {
  if (canvas.columns < 2 * constraints.minimumColumns + 1 || canvas.rows < constraints.minimumRows) {
    return undefined;
  }

  const firstColumns = Math.floor((canvas.columns - 1) / 2);
  const secondColumns = canvas.columns - firstColumns - 1;
  return {
    orientation: "side-by-side",
    first: { column: 0, row: 0, columns: firstColumns, rows: canvas.rows },
    separator: { column: firstColumns, row: 0, columns: 1, rows: canvas.rows },
    second: { column: firstColumns + 1, row: 0, columns: secondColumns, rows: canvas.rows },
  };
}

function computeStacked(canvas: TerminalSize, constraints: SplitPaneConstraints): SplitPaneLayout | undefined {
  if (canvas.rows < 2 * constraints.minimumRows + 1 || canvas.columns < constraints.minimumColumns) {
    return undefined;
  }

  const firstRows = Math.floor((canvas.rows - 1) / 2);
  const secondRows = canvas.rows - firstRows - 1;
  return {
    orientation: "stacked",
    first: { column: 0, row: 0, columns: canvas.columns, rows: firstRows },
    separator: { column: 0, row: firstRows, columns: canvas.columns, rows: 1 },
    second: { column: 0, row: firstRows + 1, columns: canvas.columns, rows: secondRows },
  };
}

function validateConstraints(constraints: SplitPaneConstraints): void {
  validatePositiveSafeInteger("minimumColumns", constraints.minimumColumns);
  validatePositiveSafeInteger("minimumRows", constraints.minimumRows);
}

function validateOrientation(orientation: SplitOrientation): void {
  if (orientation !== "side-by-side" && orientation !== "stacked") {
    throw new RangeError(`Unsupported split orientation: ${String(orientation)}`);
  }
}

function validatePositiveSafeInteger(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}
