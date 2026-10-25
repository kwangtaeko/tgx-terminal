import type { Provider } from "../launch/command.js";
import type { ManagedSession } from "../session/multi-session-manager.js";

/** Formats TGX-owned tab metadata into one bounded, printable ASCII terminal row. */
export function createTabStripView(
  sessions: readonly ManagedSession[],
  selectedSessionId: string | undefined,
  provider: Provider,
  columns: number
): string {
  const tabs = sessions.map((session, index) => {
    const marker = session.id === selectedSessionId ? "*" : "";
    return `[${index + 1}${marker}] ${provider}:${session.status}`;
  });
  const content = ["TGX", ...tabs, "Ctrl+T n new ] next [ prev x close"].join(" | ");
  return fitPrintableAscii(content, columns);
}

function fitPrintableAscii(value: string, columns: number): string {
  const safeColumns = Number.isSafeInteger(columns) && columns > 0 ? columns : 1;
  return value.replace(/[^\x20-\x7e]/g, "?").slice(0, safeColumns).padEnd(safeColumns, " ");
}
