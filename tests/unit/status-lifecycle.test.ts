import { describe, expect, it } from "vitest";

import { resolveStatusLifecycle, type TabRenderState } from "../../src/cli.js";
import type { ManagedSession } from "../../src/session/multi-session-manager.js";
import type { ScreenSnapshot } from "../../src/terminal/screen-model.js";

describe("resolveStatusLifecycle", () => {
  it("keeps a single session running after its screen becomes blank", () => {
    expect(resolveStatusLifecycle(blankSnapshot(), undefined, true)).toBe("running");
  });

  it("shows the retained final tab as exited when no tab remains selected", () => {
    const tabs: TabRenderState = {
      sessions: [session("session-1", "exited", true)],
      selectedSessionId: undefined,
      showStartupBranding: false,
    };

    expect(resolveStatusLifecycle(blankSnapshot(), tabs, false)).toBe("exited");
  });
});

function blankSnapshot(): ScreenSnapshot {
  return { columns: 1, rows: 1, lines: [""], styledLines: [], cursor: { x: 0, y: 0 } };
}

function session(id: string, status: ManagedSession["status"], hasReceivedOutput: boolean): ManagedSession {
  return { id, status, hasReceivedOutput, snapshot: blankSnapshot() };
}
