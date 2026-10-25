import { describe, expect, it } from "vitest";

import { createStartupBrandLine, renderStartupBrandFrame } from "../../src/dashboard/startup-brand-view.js";

describe("startup branding view", () => {
  it("creates bounded ASCII TGX-owned startup text", () => {
    const line = createStartupBrandLine("codex", 24);

    expect(line).toBe("TGX starting codex...   ");
    expect(line).toHaveLength(24);
    expect(line).toMatch(/^[\x20-\x7e]*$/);
  });

  it("renders a safe full startup frame without child content", () => {
    const frame = renderStartupBrandFrame("claude", 80);

    expect(frame).toContain("\u001b[2J\u001b[H\u001b[1;1H\u001b[2KTGX starting claude...");
    expect(frame).toMatch(/\u001b\[0m$/u);
  });
});
