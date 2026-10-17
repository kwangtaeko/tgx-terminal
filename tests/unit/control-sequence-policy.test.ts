import { describe, expect, it } from "vitest";

import { sanitizeForOuterRenderer } from "../../src/terminal/control-sequence-policy.js";
import {
  FIXTURE_COLOURS,
  FIXTURE_OSC_CLIPBOARD,
  FIXTURE_OSC_TITLE,
  FIXTURE_WINDOW_OPERATION
} from "../fixtures/vt-streams.js";

describe("sanitizeForOuterRenderer", () => {
  it("blocks OSC sequences terminated by BEL and ST", () => {
    expect(sanitizeForOuterRenderer(`${FIXTURE_OSC_TITLE}visible`)).toBe("visible");
    expect(sanitizeForOuterRenderer(`${FIXTURE_OSC_CLIPBOARD}visible`)).toBe("visible");
  });

  it("blocks screen-external CSI window operations", () => {
    expect(sanitizeForOuterRenderer(`${FIXTURE_WINDOW_OPERATION}visible`)).toBe("visible");
  });

  it("preserves visual terminal control sequences for the screen model", () => {
    expect(sanitizeForOuterRenderer(FIXTURE_COLOURS)).toBe(FIXTURE_COLOURS);
  });
});
