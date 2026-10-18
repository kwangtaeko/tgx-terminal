import { describe, expect, it } from "vitest";

import { ProcessTerminal } from "../../src/terminal/terminal-state.js";

describe("ProcessTerminal", () => {
  it("restores raw mode and the original paused input state", async () => {
    const events: string[] = [];
    let paused = true;
    const input = {
      isTTY: true,
      isRaw: false,
      setRawMode: (enabled: boolean) => events.push(`raw:${enabled}`),
      isPaused: () => paused,
      resume: () => {
        paused = false;
        events.push("resume");
      },
      pause: () => {
        paused = true;
        events.push("pause");
      },
      on: () => undefined,
      off: () => undefined
    };
    const output = {
      write: (data: string) => {
        events.push(`output:${data}`);
        return true;
      }
    };
    const terminal = new ProcessTerminal(input, output);

    await terminal.enter();
    await terminal.restore();

    expect(events).toEqual([
      "raw:true",
      "resume",
      "output:\u001b[?1049h\u001b[?25l",
      "output:\u001b[0m\u001b[?25h\u001b[?1049l",
      "raw:false",
      "pause"
    ]);
  });

  it("reports the current terminal dimensions when the output resizes", () => {
    let resizeListener: (() => void) | undefined;
    const input = {
      resume: () => undefined,
      on: () => undefined,
      off: () => undefined
    };
    const output = {
      columns: 80,
      rows: 24,
      write: () => true,
      on: (event: "resize", listener: () => void) => {
        if (event === "resize") resizeListener = listener;
      },
      off: () => undefined
    };
    const terminal = new ProcessTerminal(input, output);
    const sizes: Array<{ columns: number; rows: number }> = [];

    const subscription = terminal.onResize((size) => sizes.push(size));
    output.columns = 120;
    output.rows = 40;
    resizeListener?.();
    subscription.dispose();

    expect(sizes).toEqual([{ columns: 120, rows: 40 }]);
  });
});
