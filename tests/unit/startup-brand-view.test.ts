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

  it("renders a three-row TGX wordmark with a foreground-only shadow", () => {
    const frame = renderStartupBrandFrame("claude", 80);

    expect(frame).toContain("\u001b[2J\u001b[H\u001b[1;1H\u001b[2K\u001b[1;38;5;195mTGX");
    expect(frame).toContain("\u001b[2;1H\u001b[2K\u001b[38;5;24m TGX");
    expect(frame).toContain("\u001b[3;1H\u001b[2K\u001b[38;5;67m CONNECTING TO CLAUDE");
    expect(frame).not.toContain("\u001b[48;");
    expect(frame).toMatch(/\u001b\[0m$/u);
  });

  it("does not move below a one-row terminal during startup", () => {
    const frame = renderStartupBrandFrame("codex", 80, 1);

    expect(frame).toContain("\u001b[1;1H\u001b[2K\u001b[1;38;5;195mTGX");
    expect(frame).not.toContain("\u001b[2;1H");
    expect(frame).not.toContain("\u001b[3;1H");
  });

  it("renders an elevated TGX wordmark when the terminal has enough height", () => {
    const frame = renderStartupBrandFrame("codex", 80, 8);
    const compactFrame = renderStartupBrandFrame("codex", 80, 3);

    expect(frame).toContain("\u001b[1;1H\u001b[2K\u001b[1;38;5;195mTGX");
    expect(frame).toContain("\u001b[2;1H\u001b[2K\u001b[38;5;24m TGX");
    expect(frame).toContain("\u001b[3;1H\u001b[2K\u001b[38;5;24m  TGX");
    expect(frame).toContain("\u001b[5;1H\u001b[2K\u001b[38;5;67mCONNECTING TO CODEX");
    expect(frame).not.toContain("TTTTTT");
    expect(compactFrame).toContain("\u001b[38;5;24m TGX");
  });

  it("switches from the compact badge to the wordmark at seven rows", () => {
    const sevenRows = renderStartupBrandFrame("claude", 80, 7);
    const sixRows = renderStartupBrandFrame("claude", 80, 6);

    expect(sevenRows).toContain("\u001b[38;5;24m  TGX");
    expect(sevenRows).toContain("\u001b[6;1H\u001b[2K\u001b[38;5;67mSAFE PTY SESSION");
    expect(sevenRows).not.toContain("\u001b[8;1H");
    expect(sixRows).toContain("\u001b[38;5;24m TGX");
    expect(sixRows).not.toContain("\u001b[38;5;24m  TGX");
  });
});
