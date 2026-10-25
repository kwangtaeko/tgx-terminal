import type { Provider } from "../launch/command.js";

const FRONT_STYLE = "\u001b[1;38;5;195m";
const SHADOW_STYLE = "\u001b[38;5;24m";
const DETAIL_STYLE = "\u001b[38;5;67m";

interface BrandRow {
  readonly text: string;
  readonly style: string;
}

/** Produces TGX-owned startup text without consuming provider output. */
export function createStartupBrandLine(provider: Provider, columns: number): string {
  return fitPrintableAscii(`TGX / CONNECTING / ${provider.toUpperCase()}`, columns);
}

/** Produces the initial full frame for a single-session TGX startup. */
export function renderStartupBrandFrame(provider: Provider, columns: number, availableRows = 3): string {
  const compactRows: readonly BrandRow[] = [
    { text: "TGX", style: FRONT_STYLE },
    { text: " TGX", style: SHADOW_STYLE },
    { text: ` CONNECTING TO ${provider.toUpperCase()}`, style: DETAIL_STYLE },
  ];
  const elevatedRows: readonly BrandRow[] = [
    { text: "TGX", style: FRONT_STYLE },
    { text: " TGX", style: SHADOW_STYLE },
    { text: "  TGX", style: SHADOW_STYLE },
    { text: "", style: DETAIL_STYLE },
    { text: `CONNECTING TO ${provider.toUpperCase()}`, style: DETAIL_STYLE },
    { text: "SAFE PTY SESSION", style: DETAIL_STYLE },
  ];
  const safeRows = Number.isSafeInteger(availableRows) && availableRows > 0 ? availableRows : 1;
  const badgeRows = safeRows >= 7 ? elevatedRows : compactRows;
  const visibleRows = badgeRows.slice(0, safeRows);
  const renderedRows = visibleRows
    .map((row, index) => `\u001b[${index + 1};1H\u001b[2K${row.style}${fitPrintableAscii(row.text, columns)}`)
    .join("");

  return `\u001b[2J\u001b[H${renderedRows}\u001b[0m`;
}

function fitPrintableAscii(value: string, columns: number): string {
  const safeColumns = Number.isSafeInteger(columns) && columns > 0 ? columns : 1;
  return value.replace(/[^\x20-\x7e]/g, "?").slice(0, safeColumns).padEnd(safeColumns, " ");
}
