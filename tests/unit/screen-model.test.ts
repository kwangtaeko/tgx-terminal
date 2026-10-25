import { describe, expect, it } from "vitest";

import { OuterRenderer, renderSnapshot } from "../../src/terminal/outer-renderer.js";
import { ScreenModel } from "../../src/terminal/screen-model.js";
import {
  FIXTURE_ALTERNATE_BUFFER,
  FIXTURE_COLOURS,
  FIXTURE_CURSOR_AND_ERASE,
  FIXTURE_KOREAN,
  FIXTURE_OSC_TITLE,
  FIXTURE_STYLED_COLOURS,
  FIXTURE_UNKNOWN_CSI,
  FIXTURE_WINDOW_OPERATION
} from "../fixtures/vt-streams.js";

describe("ScreenModel", () => {
  it("applies visual output while excluding screen-external sequences", async () => {
    const model = new ScreenModel({ columns: 32, rows: 4 });

    await model.write(
      `${FIXTURE_OSC_TITLE}${FIXTURE_WINDOW_OPERATION}${FIXTURE_CURSOR_AND_ERASE}\r\n${FIXTURE_COLOURS} ${FIXTURE_KOREAN}${FIXTURE_UNKNOWN_CSI}`
    );

    const snapshot = model.snapshot();
    const rendered = renderSnapshot(snapshot);

    expect(snapshot.lines.join("\n")).toContain("second line");
    expect(snapshot.lines.join("\n")).toContain("RED 한글 입력");
    expect(rendered).not.toContain(FIXTURE_OSC_TITLE);
    expect(rendered).not.toContain(FIXTURE_WINDOW_OPERATION);
    expect(rendered).not.toContain(FIXTURE_UNKNOWN_CSI);
  });

  it("renders alternate-buffer content without relaying its escape sequence", async () => {
    const model = new ScreenModel({ columns: 24, rows: 4 });

    await model.write(FIXTURE_ALTERNATE_BUFFER);

    const rendered = renderSnapshot(model.snapshot());
    expect(rendered).toContain("ALT SCREEN");
    expect(rendered).not.toContain("\u001b[?1049");
  });

  it("repaints only the current viewport after scrollback advances", async () => {
    const model = new ScreenModel({ columns: 12, rows: 2 });

    await model.write("first\r\nsecond\r\nthird");

    const snapshot = model.snapshot();
    expect(snapshot.lines).toEqual(["second", "third"]);
    expect(renderSnapshot(snapshot)).toBe("\u001b[2J\u001b[Hsecond\r\nthird\u001b[0m\u001b[2;6H\u001b[?25h");
  });

  it("retains palette, RGB, and basic text styles in safe render segments", async () => {
    const model = new ScreenModel({ columns: 16, rows: 2 });

    await model.write(FIXTURE_STYLED_COLOURS);

    const snapshot = model.snapshot();
    expect(snapshot.styledLines[0]?.segments).toEqual([
      { text: "RED", style: { foreground: { kind: "palette", value: 1 } } },
      { text: " ", style: {} },
      {
        text: "X",
        style: {
          foreground: { kind: "rgb", value: 66_051 },
          bold: true,
          underline: true
        }
      }
    ]);
    expect(renderSnapshot(snapshot)).toContain("\u001b[38;5;1mRED\u001b[0m \u001b[1;4;38;2;1;2;3mX\u001b[0m");
  });

  it("updates only changed rows after the initial full frame", () => {
    const renderer = new OuterRenderer();
    const initial = snapshotWithLines(["first", "second"]);
    const changed = snapshotWithLines(["updated", "second"]);

    expect(renderer.render(initial)).toBe("\u001b[2J\u001b[Hfirst\r\nsecond\u001b[0m\u001b[1;1H\u001b[?25h");
    expect(renderer.render(changed)).toBe("\u001b[1;1H\u001b[2Kupdated\u001b[0m\u001b[1;1H\u001b[?25h");
    expect(renderer.render(changed)).toBe("");
  });

  it("restores the child cursor and emits a cursor-only update when text is unchanged", () => {
    const renderer = new OuterRenderer();
    const initial = snapshotWithLines(["first", "second"], { x: 3, y: 1 });
    const cursorMoved = snapshotWithLines(["first", "second"], { x: 1, y: 0 });

    expect(renderer.render(initial)).toMatch(/\u001b\[0m\u001b\[2;4H\u001b\[\?25h$/u);
    expect(renderer.render(cursorMoved)).toBe("\u001b[0m\u001b[1;2H\u001b[?25h");
  });

  it("resizes the current VT viewport", async () => {
    const model = new ScreenModel({ columns: 12, rows: 2 });

    await model.write("first\r\nsecond\r\nthird");
    model.resize({ columns: 12, rows: 3 });

    expect(model.snapshot().rows).toBe(3);
    expect(model.snapshot().lines).toEqual(["first", "second", "third"]);
  });

  it("fully repaints when the viewport row count changes", () => {
    const renderer = new OuterRenderer();

    renderer.render(snapshotWithLines(["first", "second"]));

    expect(renderer.render(snapshotWithLines(["first", "second", "third"]))).toBe(
      "\u001b[2J\u001b[Hfirst\r\nsecond\r\nthird\u001b[0m\u001b[1;1H\u001b[?25h"
    );
  });
});

function snapshotWithLines(lines: readonly string[], cursor = { x: 0, y: 0 }) {
  return {
    columns: 16,
    rows: lines.length,
    lines,
    styledLines: lines.map((text) => ({ segments: [{ text, style: {} }] })),
    cursor
  };
}
