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

  it("renders a TGX tab bar before offset child and dashboard rows", () => {
    const renderer = new SidecarRenderer();
    const layout: SingleSessionLayout = {
      terminal: { columns: 60, rows: 2 },
      dashboard: { columns: 30, startColumn: 63 },
      tabBar: { columns: 92 },
    };

    const rendered = renderer.render(snapshotWithLines(["child one", "child two"]), layout, ["status one", "status two"], "TGX tabs");

    expect(rendered).toContain("\u001b[1;1H\u001b[2KTGX tabs");
    expect(rendered).toContain("\u001b[2;1H\u001b[2Kchild one");
    expect(rendered).toContain("\u001b[2;62H|");
    expect(rendered).toContain("\u001b[2;63Hstatus one");
  });

  it("restores the child cursor below a tab bar rather than in the TGX row", () => {
    const renderer = new SidecarRenderer();
    const layout: SingleSessionLayout = {
      terminal: { columns: 60, rows: 2 },
      dashboard: undefined,
      tabBar: { columns: 60 },
    };
    const snapshot = snapshotWithLines(["child one", "child two"], 60, undefined, { x: 4, y: 1 });

    const rendered = renderer.render(snapshot, layout, [], "TGX tabs");

    expect(rendered).toMatch(/\u001b\[0m\u001b\[3;5H\u001b\[\?25h$/u);
  });

  it("emits only a clamped cursor update when sidecar text is unchanged", () => {
    const renderer = new SidecarRenderer();
    const initial = snapshotWithLines(["child one", "child two"], 60, undefined, { x: 90, y: 4 });
    const cursorMoved = snapshotWithLines(["child one", "child two"], 60, undefined, { x: -3, y: -2 });

    expect(renderer.render(initial, sidecarLayout, ["TGX STATUS", ""])).toMatch(/\u001b\[2;60H\u001b\[\?25h$/u);
    expect(renderer.render(cursorMoved, sidecarLayout, ["TGX STATUS", ""])).toBe("\u001b[0m\u001b[1;1H\u001b[?25h");
  });
});

function snapshotWithLines(
  lines: readonly string[],
  columns = 60,
  styledLines: readonly string[] | undefined = lines,
  cursor = { x: 0, y: 0 }
): {
  columns: number;
  rows: number;
  lines: readonly string[];
  styledLines: readonly { segments: readonly { text: string; style: {} }[] }[];
  cursor: { x: number; y: number };
} {
  const safeStyledLines = styledLines ?? lines;
  return {
    columns,
    rows: lines.length,
    lines,
    styledLines: safeStyledLines.map((text) => ({ segments: [{ text, style: {} }] })),
    cursor,
  };
}
