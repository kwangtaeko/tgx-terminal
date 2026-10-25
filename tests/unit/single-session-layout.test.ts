import { describe, expect, it } from "vitest";

import { computeSingleSessionLayout, computeTabbedSessionLayout } from "../../src/layout/single-session-layout.js";

describe("computeSingleSessionLayout", () => {
  it("reserves a transparent TGX status row while keeping the full width", () => {
    expect(computeSingleSessionLayout({ columns: 80, rows: 24 })).toEqual({
      terminal: { columns: 80, rows: 23 },
      dashboard: undefined,
      statusLine: { columns: 80 },
    });
  });

  it("keeps the only child row when the terminal is one row high", () => {
    expect(computeSingleSessionLayout({ columns: 80, rows: 1 })).toEqual({
      terminal: { columns: 80, rows: 1 },
      dashboard: undefined,
    });
  });

  it("rejects invalid physical terminal dimensions", () => {
    expect(() => computeSingleSessionLayout({ columns: 0, rows: 24 })).toThrow(RangeError);
    expect(() => computeSingleSessionLayout({ columns: 92, rows: 0 })).toThrow(RangeError);
  });

  it("reserves one TGX-owned row only when a tabbed viewport has room", () => {
    expect(computeTabbedSessionLayout({ columns: 80, rows: 3 })).toEqual({
      terminal: { columns: 80, rows: 1 },
      dashboard: undefined,
      statusLine: { columns: 80 },
      tabBar: { columns: 80 },
    });
    expect(computeTabbedSessionLayout({ columns: 80, rows: 1 })).toEqual({
      terminal: { columns: 80, rows: 1 },
      dashboard: undefined,
    });
  });
});
