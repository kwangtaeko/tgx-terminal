import type { SingleSessionLayout } from "../layout/single-session-layout.js";
import type { ScreenLine, ScreenSnapshot } from "./screen-model.js";
import { renderStyledLine } from "./outer-renderer.js";

interface RenderedFrame {
  readonly geometry: string;
  readonly rows: readonly string[];
  readonly cursor: CursorPosition;
}

interface CursorPosition {
  readonly column: number;
  readonly row: number;
}

/**
 * Repaints the first sidecar frame in full and only updates changed rows after
 * that. Child text always comes from the parsed ScreenSnapshot segments.
 */
export class SidecarRenderer {
  #previousFrame: RenderedFrame | undefined;

  reset(): void {
    this.#previousFrame = undefined;
  }

  render(
    snapshot: ScreenSnapshot,
    layout: SingleSessionLayout,
    dashboardLines: readonly string[],
    tabBarLine?: string,
    statusLine?: string
  ): string {
    const frame = createFrame(snapshot, layout, dashboardLines, tabBarLine, statusLine);
    const previous = this.#previousFrame;
    this.#previousFrame = frame;

    if (previous === undefined || previous.geometry !== frame.geometry || previous.rows.length !== frame.rows.length) {
      return `\u001b[2J\u001b[H${frame.rows.map((row, index) => renderRow(index, row)).join("")}\u001b[0m${renderCursor(frame.cursor)}`;
    }

    const changedRows = frame.rows.flatMap((row, index) => (row === previous.rows[index] ? [] : [renderRow(index, row)]));
    if (changedRows.length === 0 && cursorEquals(frame.cursor, previous.cursor)) return "";
    return `${changedRows.join("")}\u001b[0m${renderCursor(frame.cursor)}`;
  }
}

function createFrame(
  snapshot: ScreenSnapshot,
  layout: SingleSessionLayout,
  dashboardLines: readonly string[],
  tabBarLine: string | undefined,
  statusLine: string | undefined
): RenderedFrame {
  const rowOffset = layout.tabBar === undefined ? 0 : 1;
  const rows = layout.tabBar === undefined ? [] : [formatTabBarLine(tabBarLine ?? "", layout.tabBar.columns)];

  rows.push(...Array.from({ length: layout.terminal.rows }, (_, index) => {
    const childLine = snapshot.styledLines[index] ?? EMPTY_LINE;
    const child = renderStyledLine(childLine);
    const physicalRow = index + rowOffset + 1;

    if (layout.dashboard === undefined) {
      return child;
    }

    const dashboard = formatDashboardLine(dashboardLines[index] ?? "", layout.dashboard.columns);
    const separatorColumn = layout.dashboard.startColumn - 1;
    return `${child}\u001b[${physicalRow};${separatorColumn}H|\u001b[${physicalRow};${layout.dashboard.startColumn}H${dashboard}`;
  }));
  if (layout.statusLine !== undefined) {
    rows.push(formatStatusLine(statusLine ?? "", layout.statusLine.columns));
  }

  return {
    geometry: `${layout.tabBar?.columns ?? layout.statusLine?.columns ?? layout.terminal.columns}x${rows.length}:${layout.dashboard?.startColumn ?? "hidden"}`,
    rows,
    cursor: {
      column: clamp(snapshot.cursor.x, layout.terminal.columns),
      row: clamp(snapshot.cursor.y, layout.terminal.rows) + rowOffset,
    },
  };
}

function renderRow(index: number, row: string): string {
  return `\u001b[${index + 1};1H\u001b[2K${row}`;
}

function formatDashboardLine(line: string, columns: number): string {
  return line.replace(/[^\x20-\x7e]/g, "?").slice(0, columns).padEnd(columns, " ");
}

function formatTabBarLine(line: string, columns: number): string {
  return line.replace(/[^\x20-\x7e]/g, "?").slice(0, columns).padEnd(columns, " ");
}

function formatStatusLine(line: string, columns: number): string {
  return line.replace(/[^\x20-\x7e]/g, "?").slice(0, columns).padEnd(columns, " ");
}

function renderCursor(cursor: CursorPosition): string {
  return `\u001b[${cursor.row + 1};${cursor.column + 1}H\u001b[?25h`;
}

function clamp(value: number, size: number): number {
  return Math.max(0, Math.min(size - 1, value));
}

function cursorEquals(left: CursorPosition, right: CursorPosition): boolean {
  return left.column === right.column && left.row === right.row;
}

const EMPTY_LINE: ScreenLine = { segments: [] };
