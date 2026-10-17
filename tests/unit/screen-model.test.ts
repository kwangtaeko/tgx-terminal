import { describe, expect, it } from "vitest";

import { renderSnapshot } from "../../src/terminal/outer-renderer.js";
import { ScreenModel } from "../../src/terminal/screen-model.js";
import {
  FIXTURE_ALTERNATE_BUFFER,
  FIXTURE_COLOURS,
  FIXTURE_CURSOR_AND_ERASE,
  FIXTURE_KOREAN,
  FIXTURE_OSC_TITLE,
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
});
