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

  it("renders a large TGX wordmark when the terminal has enough height", () => {
    const frame = renderStartupBrandFrame("codex", 80, 8);
    const compactFrame = renderStartupBrandFrame("codex", 80, 3);

    expect(frame).toContain("\u001b[1;1H\u001b[2KTTTTTT  GGGGG  XX   XX");
    expect(frame).toContain("\u001b[5;1H\u001b[2K  TT    GGGGG  XX   XX");
    expect(frame).toContain("\u001b[7;1H\u001b[2K      CONNECTING TO CODEX");
    expect(frame).not.toContain("| TGX |");
    expect(compactFrame).toContain("| TGX |  CONNECTING TO CODEX");
  });

  it("switches from the compact badge to the wordmark at seven rows", () => {
    const sevenRows = renderStartupBrandFrame("claude", 80, 7);
    const sixRows = renderStartupBrandFrame("claude", 80, 6);

    expect(sevenRows).toContain("TTTTTT  GGGGG  XX   XX");
    expect(sevenRows).toContain("\u001b[7;1H\u001b[2K      CONNECTING TO CLAUDE");
    expect(sevenRows).not.toContain("\u001b[8;1H");
    expect(sixRows).toContain("| TGX |  CONNECTING TO CLAUDE");
    expect(sixRows).not.toContain("TTTTTT  GGGGG  XX   XX");
  });
});
