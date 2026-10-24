import { describe, expect, it } from "vitest";

import { createProviderUsageAdapter } from "../../src/providers/usage-adapter.js";

describe("provider usage adapter", () => {
  it("keeps Codex usage unsupported instead of automating the active-session command", () => {
    const observedAt = new Date("2026-10-18T01:00:00.000Z");
    const adapter = createProviderUsageAdapter(() => observedAt);

    const state = adapter.getUsageState("codex");

    expect(state.provider).toBe("codex");
    expect(state.usage).toMatchObject({
      status: "unsupported",
      observedAt,
      reason: "Codex usage is available through an active session command that TGX does not automate."
    });
    expect(state.usage.source).toEqual({
      provider: "codex",
      documentationUrl: "https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
      providerVersion: "0.164.0",
      refreshMethod: "not-collected"
    });
    expect("value" in state.usage).toBe(false);
  });

  it("keeps Claude Code usage unsupported without an external active-session query", () => {
    const observedAt = new Date("2026-10-18T01:00:00.000Z");
    const adapter = createProviderUsageAdapter(() => observedAt);

    const state = adapter.getUsageState("claude");

    expect(state.provider).toBe("claude");
    expect(state.usage).toMatchObject({
      status: "unsupported",
      observedAt,
      reason: "Claude Code does not document an external usage or limit query for an active interactive session."
    });
    expect(state.usage.source).toEqual({
      provider: "claude",
      documentationUrl: "https://docs.anthropic.com/en/docs/claude-code/cli-usage",
      providerVersion: "2.1.302",
      refreshMethod: "not-collected"
    });
    expect("value" in state.usage).toBe(false);
  });

  it("does not let one caller change the source returned to the next caller", () => {
    const adapter = createProviderUsageAdapter(() => new Date("2026-10-18T01:00:00.000Z"));
    const first = adapter.getUsageState("codex");

    (first.usage.source as { provider: string }).provider = "claude";

    expect(adapter.getUsageState("codex").usage.source.provider).toBe("codex");
  });
});
