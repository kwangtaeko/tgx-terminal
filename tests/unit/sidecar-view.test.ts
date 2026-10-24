import { describe, expect, it } from "vitest";

import type { ProviderUsageState } from "../../src/providers/contracts.js";
import { createSidecarView } from "../../src/dashboard/sidecar-view.js";

const unsupportedCodexState: ProviderUsageState = {
  provider: "codex",
  usage: {
    status: "unsupported",
    reason: "This internal explanation must not be displayed.",
    observedAt: new Date("2026-10-18T01:00:00.000Z"),
    source: {
      provider: "codex",
      providerVersion: "0.164.0",
      documentationUrl: "https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
      refreshMethod: "not-collected",
    },
  },
};

describe("createSidecarView", () => {
  it("renders a bounded, safe summary for unsupported usage", () => {
    const lines = createSidecarView(unsupportedCodexState, 30, 12);
    const rendered = lines.join("\n");

    expect(lines).toHaveLength(12);
    expect(lines.every((line) => line.length === 30)).toBe(true);
    expect(rendered).toContain("TGX STATUS");
    expect(rendered).toContain("Provider: codex");
    expect(rendered).toContain("CLI: 0.164.0");
    expect(rendered).toContain("Status: Unsupported");
    expect(rendered).toContain("Source: help.openai.com");
    expect(rendered).not.toContain("0%");
    expect(rendered).not.toContain("Reset:");
    expect(rendered).not.toContain("This internal explanation");
  });

  it("truncates rows to the available width and height", () => {
    const lines = createSidecarView(unsupportedCodexState, 12, 3);

    expect(lines).toEqual(["TGX STATUS  ", "            ", "Provider: co"]);
  });
});
