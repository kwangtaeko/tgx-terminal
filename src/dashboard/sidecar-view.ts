import type { ProviderUsageState } from "../providers/contracts.js";

/**
 * Produces fixed-width, printable-ASCII rows for the sidecar. This avoids
 * depending on terminal-specific wide-character rules in the P1 layout.
 */
export function createSidecarView(
  state: ProviderUsageState,
  columns: number,
  rows: number
): readonly string[] {
  validateDimension("columns", columns);
  validateDimension("rows", rows);

  const usage = state.usage;
  const content = [
    "TGX STATUS",
    "",
    `Provider: ${state.provider}`,
    `CLI: ${usage.source.providerVersion}`,
    "",
    "Usage",
    `Status: ${formatStatus(usage.status)}`,
    `Source: ${documentationHost(usage.source.documentationUrl)}`,
  ];

  return Array.from({ length: rows }, (_, index) => formatRow(content[index] ?? "", columns));
}

function formatStatus(status: ProviderUsageState["usage"]["status"]): string {
  switch (status) {
    case "available":
      return "Available";
    case "stale":
      return "Stale";
    case "error":
      return "Error";
    case "unsupported":
      return "Unsupported";
  }
}

function documentationHost(documentationUrl: string): string {
  try {
    return toPrintableAscii(new URL(documentationUrl).hostname) || "unavailable";
  } catch {
    return "unavailable";
  }
}

function formatRow(value: string, columns: number): string {
  return toPrintableAscii(value).slice(0, columns).padEnd(columns, " ");
}

function toPrintableAscii(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "?");
}

function validateDimension(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}
