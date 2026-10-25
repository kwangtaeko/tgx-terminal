import { describe, expect, it } from "vitest";

import { createStartupBrandLine, renderStartupBrandFrame } from "../../src/dashboard/startup-brand-view.js";

describe("startup branding view", () => {
  it("creates a bounded TGX connecting badge for the tab bar", () => {
    const line = createStartupBrandLine("codex", 24);

    expect(line).toBe("TGX / CONNECTING / CODEX");
    expect(line).toHaveLength(24);
    expect(line).toMatch(/^[\x20-\x7e]*$/);
    expect(createStartupBrandLine("claude", 10)).toBe("TGX / CONN");
  });

  it("renders a three-row TGX badge without child content", () => {
    const frame = renderStartupBrandFrame("claude", 80);

    expect(frame).toContain("\u001b[2J\u001b[H\u001b[1;1H\u001b[2K+-----+  TGX / TERMINAL");
    expect(frame).toContain("\u001b[2;1H\u001b[2K| TGX |  CONNECTING TO CLAUDE");
    expect(frame).toContain("\u001b[3;1H\u001b[2K+-----+  SAFE PTY SESSION");
    expect(frame).toMatch(/\u001b\[0m$/u);
  });

  it("does not move below a one-row terminal during startup", () => {
    const frame = renderStartupBrandFrame("codex", 80, 1);

    expect(frame).toContain("\u001b[1;1H\u001b[2K+-----+  TGX / TERMINAL");
    expect(frame).not.toContain("\u001b[2;1H");
    expect(frame).not.toContain("\u001b[3;1H");
  });
});
