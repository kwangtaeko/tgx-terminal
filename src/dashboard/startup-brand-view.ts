import type { Provider } from "../launch/command.js";

/** Produces TGX-owned startup text without consuming provider output. */
export function createStartupBrandLine(provider: Provider, columns: number): string {
  return fitPrintableAscii(`TGX / CONNECTING / ${provider.toUpperCase()}`, columns);
}

/** Produces the initial full frame for a single-session TGX startup. */
export function renderStartupBrandFrame(provider: Provider, columns: number, availableRows = 3): string {
  const compactRows = [
    "+-----+  TGX / TERMINAL",
    `| TGX |  CONNECTING TO ${provider.toUpperCase()}`,
    "+-----+  SAFE PTY SESSION",
  ];
  const wordmarkRows = [
    "TTTTTT  GGGGG  XX   XX",
    "  TT   GG        XX XX ",
    "  TT   GG  GGG    XXX  ",
    "  TT   GG   GG   XX XX ",
    "  TT    GGGGG  XX   XX",
    "",
    `      CONNECTING TO ${provider.toUpperCase()}`,
    "      SAFE PTY SESSION",
  ];
  const safeRows = Number.isSafeInteger(availableRows) && availableRows > 0 ? availableRows : 1;
  const badgeRows = safeRows >= 7 ? wordmarkRows : compactRows;
  const visibleRows = badgeRows.slice(0, safeRows);
  const renderedRows = visibleRows
    .map((row, index) => `\u001b[${index + 1};1H\u001b[2K${fitPrintableAscii(row, columns)}`)
    .join("");

  return `\u001b[2J\u001b[H${renderedRows}\u001b[0m`;
}

function fitPrintableAscii(value: string, columns: number): string {
  const safeColumns = Number.isSafeInteger(columns) && columns > 0 ? columns : 1;
  return value.replace(/[^\x20-\x7e]/g, "?").slice(0, safeColumns).padEnd(safeColumns, " ");
}
