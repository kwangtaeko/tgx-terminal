import { describe, expect, it } from "vitest";

import type { SplitPaneLayout } from "../../src/layout/split-pane-layout.js";
import { SplitPaneRenderer } from "../../src/terminal/split-pane-renderer.js";

const sideBySide: SplitPaneLayout = {
  orientation: "side-by-side",
  first: { column: 0, row: 0, columns: 5, rows: 2 },
  separator: { column: 5, row: 0, columns: 1, rows: 2 },
  second: { column: 6, row: 0, columns: 5, rows: 2 },
};

const stacked: SplitPaneLayout = {
  orientation: "stacked",
  first: { column: 0, row: 0, columns: 5, rows: 2 },
  separator: { column: 0, row: 2, columns: 5, rows: 1 },
  second: { column: 0, row: 3, columns: 5, rows: 2 },
};

describe("SplitPaneRenderer", () => {
  it("places both parsed side-by-side snapshots and their separator on one physical row", () => {
    const renderer = new SplitPaneRenderer();
    const rendered = renderer.render(snapshot(["\u001b]0;unsafe\u0007", "left2"], 5, ["LEFT", "L2"]), snapshot(["right", "right2"], 5), sideBySide);

    expect(rendered).toContain("\u001b[1;1H\u001b[2KLEFT\u001b[1;6H|\u001b[1;7Hright");
    expect(rendered).toContain("\u001b[2;1H\u001b[2KL2\u001b[2;6H|\u001b[2;7Hright2");
    expect(rendered).not.toContain("\u001b]0;unsafe\u0007");
  });

  it("renders a full-width stacked separator row", () => {
    const renderer = new SplitPaneRenderer();
    const rendered = renderer.render(snapshot(["top1", "top2"], 5), snapshot(["bot1", "bot2"], 5), stacked);

    expect(rendered).toContain("\u001b[1;1H\u001b[2Ktop1");
    expect(rendered).toContain("\u001b[3;1H\u001b[2K-----");
    expect(rendered).toContain("\u001b[4;1H\u001b[2Kbot1");
  });

  it("repaints only the changed physical row", () => {
    const renderer = new SplitPaneRenderer();
    renderer.render(snapshot(["left", "same"], 5), snapshot(["right", "same"], 5), sideBySide);

    expect(renderer.render(snapshot(["left", "same"], 5), snapshot(["right", "next"], 5), sideBySide)).toBe(
      "\u001b[2;1H\u001b[2Ksame\u001b[2;6H|\u001b[2;7Hnext\u001b[0m"
    );
  });

  it("emits nothing for an identical frame and repaints after reset", () => {
    const renderer = new SplitPaneRenderer();
    const first = snapshot(["left", "same"], 5);
    const second = snapshot(["right", "same"], 5);

    renderer.render(first, second, sideBySide);
    expect(renderer.render(first, second, sideBySide)).toBe("");
    renderer.reset();
    expect(renderer.render(first, second, sideBySide)).toContain("\u001b[2J\u001b[H");
  });

  it("rejects snapshot geometry that could escape its pane", () => {
    const renderer = new SplitPaneRenderer();

    expect(() => renderer.render(snapshot(["wide", "line"], 4), snapshot(["right", "line"], 5), sideBySide)).toThrow(RangeError);
  });
});

function snapshot(lines: readonly string[], columns: number, styledLines = lines) {
  return {
    columns,
    rows: lines.length,
    lines,
    styledLines: styledLines.map((text) => ({ segments: [{ text, style: {} }] })),
    cursor: { x: 0, y: 0 },
  };
}
