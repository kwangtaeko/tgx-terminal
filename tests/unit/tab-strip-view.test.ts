import { describe, expect, it } from "vitest";

import { createTabStripView } from "../../src/dashboard/tab-strip-view.js";
import type { ManagedSession } from "../../src/session/multi-session-manager.js";

describe("createTabStripView", () => {
  it("shows selection and lifecycle state using TGX-owned ASCII text", () => {
    const rendered = createTabStripView(
      [session("session-1", "running"), session("session-2", "exited")],
      "session-1",
      "codex",
      120
    );

    expect(rendered).toContain("TGX");
    expect(rendered).toContain("[1*] codex:running");
    expect(rendered).toContain("[2] codex:exited");
    expect(rendered).toMatch(/^[\x20-\x7e]*$/);
    expect(rendered).toHaveLength(120);
  });

  it("truncates and pads to the physical terminal width", () => {
    const rendered = createTabStripView([session("session-1", "running")], "session-1", "claude", 12);

    expect(rendered).toBe("TGX | [1*] c");
    expect(rendered).toHaveLength(12);
  });
});

function session(id: string, status: ManagedSession["status"]): ManagedSession {
  return {
    id,
    status,
    snapshot: { columns: 1, rows: 1, lines: [], styledLines: [], cursor: { x: 0, y: 0 } },
  };
}
