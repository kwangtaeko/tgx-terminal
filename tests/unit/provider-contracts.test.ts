import { describe, expect, it } from "vitest";

import { createUnsupportedStateValue, type DataSource } from "../../src/providers/contracts.js";

describe("provider state contracts", () => {
  it("represents unavailable collection without inventing a usage value", () => {
    const source: DataSource = {
      provider: "codex",
      documentationUrl: "https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
      providerVersion: "0.163.0",
      refreshMethod: "not-collected"
    };
    const observedAt = new Date("2026-10-18T00:00:00.000Z");

    const state = createUnsupportedStateValue(
      "Active-session status is not an automated collection source.",
      source,
      observedAt
    );

    expect(state).toEqual({
      status: "unsupported",
      source,
      observedAt,
      reason: "Active-session status is not an automated collection source."
    });
    expect("value" in state).toBe(false);
    expect("resetAt" in state).toBe(false);
    expect("window" in state).toBe(false);
    expect("unit" in state).toBe(false);
  });

  it("does not permit an unsupported state to contain a usage value", () => {
    const source: DataSource = {
      provider: "codex",
      documentationUrl: "https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan",
      providerVersion: "0.163.0",
      refreshMethod: "not-collected"
    };

    // @ts-expect-error Unsupported state values must never claim a usage value.
    createUnsupportedStateValue("No safe collection source.", source, new Date("2026-10-18T00:00:00.000Z")).value = 10;
  });

  it("rejects an invalid observation timestamp", () => {
    const source: DataSource = {
      provider: "claude",
      documentationUrl: "https://docs.anthropic.com/en/docs/claude-code/cli-usage",
      providerVersion: "2.1.302",
      refreshMethod: "not-collected"
    };

    expect(() => createUnsupportedStateValue("No external usage query is documented.", source, new Date("invalid"))).toThrow(
      "observedAt must be a valid Date"
    );
  });
});
