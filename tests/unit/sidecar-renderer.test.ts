import { describe, expect, it } from "vitest";

import type { SingleSessionLayout } from "../../src/layout/single-session-layout.js";
import { SidecarRenderer } from "../../src/terminal/sidecar-renderer.js";

const sidecarLayout: SingleSessionLayout = {
  terminal: { columns: 60, rows: 2 },
  dashboard: { columns: 30, startColumn: 63 },
};

describe("SidecarRenderer", () => {
  it("places the child, separator, and dashboard at their absolute coordinates", () => {
    const renderer = new SidecarRenderer();
    const rendered = renderer.render(snapshotWithLines(["child one", "child two"]), sidecarLayout, [
      "TGX STATUS                    ",
      "Status: Unsupported           ",
    ]);

    expect(rendered).toContain("\u001b[2J\u001b[H");
    expect(rendered).toContain("\u001b[1;1H\u001b[2Kchild one");
    expect(rendered).toContain("\u001b[1;62H|");
    expect(rendered).toContain("\u001b[1;63HTGX STATUS");
  });

  it("writes nothing for an identical frame and fully repaints when the panel visibility changes", () => {
    const renderer = new SidecarRenderer();
    const snapshot = snapshotWithLines(["child one", "child two"]);

    renderer.render(snapshot, sidecarLayout, ["TGX STATUS", ""]);
    expect(renderer.render(snapshot, sidecarLayout, ["TGX STATUS", ""])).toBe("");

    const hiddenLayout: SingleSessionLayout = {
      terminal: { columns: 62, rows: 2 },
      dashboard: undefined,
    };
    expect(renderer.render(snapshotWithLines(["child one", "child two"], 62), hiddenLayout, [])).toContain(
      "\u001b[2J\u001b[H"
    );
  });

  it("uses styled snapshot lines rather than the untrusted plain-text field", () => {
    const renderer = new SidecarRenderer();
    const snapshot = snapshotWithLines(["\u001b]0;unsafe\u0007"], 60, ["safe"]);

    const rendered = renderer.render(snapshot, { ...sidecarLayout, terminal: { columns: 60, rows: 1 } }, ["TGX"]);

    expect(rendered).toContain("safe");
    expect(rendered).not.toContain("\u001b]0;unsafe\u0007");
  });
});

function snapshotWithLines(
  lines: readonly string[],
  columns = 60,
  styledLines = lines
): {
  columns: number;
  rows: number;
  lines: readonly string[];
  styledLines: readonly { segments: readonly { text: string; style: {} }[] }[];
  cursor: { x: number; y: number };
} {
  return {
    columns,
    rows: lines.length,
    lines,
    styledLines: styledLines.map((text) => ({ segments: [{ text, style: {} }] })),
    cursor: { x: 0, y: 0 },
  };
}
