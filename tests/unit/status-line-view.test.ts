import { describe, expect, it } from "vitest";

import { createStatusLine } from "../../src/dashboard/status-line-view.js";

describe("createStatusLine", () => {
  it("renders real TGX session and project facts for Codex without inventing usage", () => {
    const line = createStatusLine({
      provider: "codex",
      lifecycle: "running",
      startedAt: new Date("2026-10-25T00:00:00.000Z"),
      now: new Date("2026-10-25T00:03:42.000Z"),
      project: { projectName: "tgx-terminal", branch: "main", dirty: true },
      tabs: 2
    }, 120);

    expect(line).toContain("TGX | CODEX | RUNNING | 03:42 | TABS 2 | USAGE /status | tgx-terminal @ main*");
    expect(line).not.toContain("0%");
    expect(line).not.toContain("NOT-COLLECTED");
    expect(line).toHaveLength(120);
    expect(line).toMatch(/^[\x20-\x7e]*$/);
  });

  it("uses an hour clock and unavailable usage only for Claude", () => {
    const line = createStatusLine({
      provider: "claude",
      lifecycle: "error",
      startedAt: new Date("2026-10-25T00:00:00.000Z"),
      now: new Date("2026-10-25T01:02:03.000Z"),
      project: { projectName: "scratch", dirty: false },
      tabs: 1
    }, 120);

    expect(line).toContain("CLAUDE | ERROR | 01:02:03 | TABS 1 | USAGE UNAVAILABLE | scratch");
  });

  it("truncates live facts to the physical statusline width", () => {
    const line = createStatusLine({
      provider: "codex",
      lifecycle: "exited",
      startedAt: new Date("2026-10-25T00:00:00.000Z"),
      now: new Date("2026-10-25T00:00:01.000Z"),
      project: { projectName: "project", dirty: false },
      tabs: 1
    }, 20);

    expect(line).toBe("TGX | CODEX | EXITED");
  });
});
