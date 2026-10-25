import type { Provider } from "../launch/command.js";

/** Produces TGX-owned startup text without consuming provider output. */
export function createStartupBrandLine(provider: Provider, columns: number): string {
  return fitPrintableAscii(`TGX starting ${provider}...`, columns);
}

/** Produces the initial full frame for a single-session TGX startup. */
export function renderStartupBrandFrame(provider: Provider, columns: number): string {
  return `\u001b[2J\u001b[H\u001b[1;1H\u001b[2K${createStartupBrandLine(provider, columns)}\u001b[0m`;
}

function fitPrintableAscii(value: string, columns: number): string {
  const safeColumns = Number.isSafeInteger(columns) && columns > 0 ? columns : 1;
  return value.replace(/[^\x20-\x7e]/g, "?").slice(0, safeColumns).padEnd(safeColumns, " ");
}
