import { describe, expect, it } from "vitest";

import { createTabControlDecoder } from "../../src/control/tab-control-decoder.js";

describe("TabControlDecoder", () => {
  it("forwards Korean multiline input and control keys unchanged while disabled", () => {
    const decoder = createTabControlDecoder({ enabled: false });

    expect(decoder.push("한글 입력\nsecond line\u0003\t\u001b\u0014n")).toEqual([
      { kind: "forward", data: "한글 입력\nsecond line\u0003\t\u001b\u0014n" }
    ]);
  });

  it("decodes each enabled Ctrl+T command", () => {
    const decoder = createTabControlDecoder({ enabled: true });

    expect(decoder.push("\u0014n\u0014]\u0014[\u0014x")).toEqual([
      { kind: "command", command: "new-session" },
      { kind: "command", command: "next-session" },
      { kind: "command", command: "previous-session" },
      { kind: "command", command: "close-session" }
    ]);
  });

  it("decodes a command split across input chunks", () => {
    const decoder = createTabControlDecoder({ enabled: true });

    expect(decoder.push("before\u0014")).toEqual([{ kind: "forward", data: "before" }]);
    expect(decoder.push("nafter")).toEqual([
      { kind: "command", command: "new-session" },
      { kind: "forward", data: "after" }
    ]);
  });

  it("returns unknown and doubled prefixes to the selected child unchanged", () => {
    const decoder = createTabControlDecoder({ enabled: true });

    expect(decoder.push("a\u0014z\u0014\u0014b")).toEqual([
      { kind: "forward", data: "a\u0014z\u0014\u0014b" }
    ]);
  });

  it("flushes an unfinished prefix and returns to idle", () => {
    const decoder = createTabControlDecoder({ enabled: true });

    decoder.push("\u0014");
    expect(decoder.flush()).toEqual([{ kind: "forward", data: "\u0014" }]);
    expect(decoder.push("n")).toEqual([{ kind: "forward", data: "n" }]);
  });
});
