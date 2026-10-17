import type { ScreenSnapshot } from "./screen-model.js";

/**
 * Produces a small, fixed outer frame from parsed screen text only. It never
 * relays child-originated control bytes into the parent terminal.
 */
export function renderSnapshot(snapshot: ScreenSnapshot): string {
  return `\u001b[H${snapshot.lines.join("\r\n")}\u001b[0m`;
}
