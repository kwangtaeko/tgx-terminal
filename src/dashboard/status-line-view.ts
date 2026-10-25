import type { ProviderUsageState } from "../providers/contracts.js";

/** Produces one TGX-owned, background-free status line from verified state only. */
export function createStatusLine(
  state: ProviderUsageState,
  sessionStatus: "running" | "exited" | "error",
  columns: number
): string {
  const usage = state.usage;
  const value = [
    "TGX",
    `${state.provider.toUpperCase()} ${usage.source.providerVersion}`,
    `SESSION ${sessionStatus.toUpperCase()}`,
    `USAGE ${formatUsageStatus(usage.status)}`,
    `SRC ${usage.source.refreshMethod.toUpperCase()}`,
  ].join(" | ");
  return fitPrintableAscii(value, columns);
}

function formatUsageStatus(status: ProviderUsageState["usage"]["status"]): string {
  return status === "unsupported" ? "UNAVAILABLE" : status.toUpperCase();
}

function fitPrintableAscii(value: string, columns: number): string {
  if (!Number.isSafeInteger(columns) || columns <= 0) throw new RangeError("columns must be a positive safe integer");
  return value.replace(/[^\x20-\x7e]/g, "?").slice(0, columns).padEnd(columns, " ");
}
