import { describe, expect, it } from "vitest";

import type { ProviderUsageState } from "../../src/providers/contracts.js";
import { createStatusLine } from "../../src/dashboard/status-line-view.js";

const unsupportedCodexState: ProviderUsageState = {
  provider: "codex",
  usage: {
    status: "unsupported",
    reason: "Do not reveal this internal reason.",
    observedAt: new Date("2026-10-25T00:00:00.000Z"),
    source: {
      provider: "codex",
      providerVersion: "0.164.0",
      documentationUrl: "https://help.openai.com/",
      refreshMethod: "not-collected",
    },
  },
};

describe("createStatusLine", () => {
  it("renders ccstatusline-style TGX session metadata without inventing usage", () => {
    const line = createStatusLine(unsupportedCodexState, "running", 80);

    expect(line).toContain("TGX");
    expect(line).toContain("CODEX 0.164.0");
    expect(line).toContain("SESSION RUNNING");
    expect(line).toContain("USAGE UNAVAILABLE");
    expect(line).toContain("SRC NOT-COLLECTED");
    expect(line).not.toContain("0%");
    expect(line).not.toContain("Do not reveal");
    expect(line).toHaveLength(80);
    expect(line).toMatch(/^[\x20-\x7e]*$/);
  });
});
