import type { TerminalSize } from "../session/contracts.js";
import { validateTerminalSize } from "../terminal/size.js";

export const MIN_TERMINAL_COLUMNS = 60;
export const DASHBOARD_COLUMNS = 30;
export const DASHBOARD_GUTTER_COLUMNS = 2;

export interface DashboardLayout {
  readonly columns: typeof DASHBOARD_COLUMNS;
  /** Absolute ANSI cursor column, using one-based coordinates. */
  readonly startColumn: number;
}

export interface TabBarLayout {
  /** Width of the physical parent-terminal row owned by TGX. */
  readonly columns: number;
}

export interface StatusLineLayout {
  /** Width of the physical parent-terminal row owned by TGX. */
  readonly columns: number;
}

export interface SingleSessionLayout {
  readonly terminal: TerminalSize;
  readonly dashboard: DashboardLayout | undefined;
  /** Present only when TGX reserves a row above the child terminal. */
  readonly tabBar?: TabBarLayout;
  /** Present only when TGX reserves a row below the child terminal. */
  readonly statusLine?: StatusLineLayout;
}

const MIN_SIDECAR_COLUMNS =
  MIN_TERMINAL_COLUMNS + DASHBOARD_GUTTER_COLUMNS + DASHBOARD_COLUMNS;

export function computeSingleSessionLayout(outerSize: TerminalSize): SingleSessionLayout {
  const validatedOuterSize = validateTerminalSize(outerSize);

  if (validatedOuterSize.rows < 2) {
    return {
      terminal: validatedOuterSize,
      dashboard: undefined,
    };
  }

  return {
    terminal: {
      columns: validatedOuterSize.columns,
      rows: validatedOuterSize.rows - 1,
    },
    dashboard: undefined,
    statusLine: { columns: validatedOuterSize.columns },
  };
}

/** Reserves one TGX-owned row for tab mode without shrinking a one-row child viewport. */
export function computeTabbedSessionLayout(outerSize: TerminalSize): SingleSessionLayout {
  const validatedOuterSize = validateTerminalSize(outerSize);
  return addTabBar(computeSingleSessionLayout(validatedOuterSize), validatedOuterSize);
}

/** Applies tab-mode vertical ownership to a custom or standard child layout. */
export function addTabBar(layout: SingleSessionLayout, outerSize: TerminalSize): SingleSessionLayout {
  const validatedOuterSize = validateTerminalSize(outerSize);
  if (validatedOuterSize.rows < 2 || layout.terminal.rows < 2) {
    return layout;
  }

  return {
    ...layout,
    terminal: { columns: layout.terminal.columns, rows: layout.terminal.rows - 1 },
    tabBar: { columns: validatedOuterSize.columns },
  };
}
