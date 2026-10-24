import { describe, expect, it } from "vitest";

import { parseTabModeArguments } from "../../src/launch/tab-mode-arguments.js";

describe("parseTabModeArguments", () => {
  it("leaves ordinary provider arguments unchanged by default", () => {
    expect(parseTabModeArguments(["--model", "gpt test", "한글"])).toEqual({
      tabsEnabled: false,
      passthrough: ["--model", "gpt test", "한글"]
    });
  });

  it("consumes only pre-separator wrapper tab options", () => {
    expect(parseTabModeArguments(["--tgx-tabs", "--model", "gpt"])).toEqual({
      tabsEnabled: true,
      passthrough: ["--model", "gpt"]
    });
  });

  it("accepts repeated wrapper tab options without forwarding either", () => {
    expect(parseTabModeArguments(["--tgx-tabs", "--tgx-tabs"])).toEqual({
      tabsEnabled: true,
      passthrough: []
    });
  });

  it("preserves a literal tab option after the provider separator", () => {
    expect(parseTabModeArguments(["--", "--tgx-tabs", "--model"])).toEqual({
      tabsEnabled: false,
      passthrough: ["--", "--tgx-tabs", "--model"]
    });
  });
});
