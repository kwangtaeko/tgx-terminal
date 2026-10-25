import { describe, expect, it } from "vitest";

import { computeSingleSessionLayout, computeTabbedSessionLayout } from "../../src/layout/single-session-layout.js";

describe("computeSingleSessionLayout", () => {
  it("uses the full outer terminal when the dashboard does not fit", () => {
    expect(computeSingleSessionLayout({ columns: 91, rows: 24 })).toEqual({
      terminal: { columns: 91, rows: 24 },
      dashboard: undefined,
    });
  });

  it("allocates the child terminal, gutter, and dashboard at the 92-column boundary", () => {
    expect(computeSingleSessionLayout({ columns: 92, rows: 24 })).toEqual({
      terminal: { columns: 60, rows: 24 },
      dashboard: { columns: 30, startColumn: 63 },
    });
  });

  it("rejects invalid physical terminal dimensions", () => {
    expect(() => computeSingleSessionLayout({ columns: 0, rows: 24 })).toThrow(RangeError);
    expect(() => computeSingleSessionLayout({ columns: 92, rows: 0 })).toThrow(RangeError);
  });

  it("reserves one TGX-owned row only when a tabbed viewport has room", () => {
    expect(computeTabbedSessionLayout({ columns: 92, rows: 2 })).toEqual({
      terminal: { columns: 60, rows: 1 },
      dashboard: { columns: 30, startColumn: 63 },
      tabBar: { columns: 92 },
    });
    expect(computeTabbedSessionLayout({ columns: 80, rows: 1 })).toEqual({
      terminal: { columns: 80, rows: 1 },
      dashboard: undefined,
    });
  });
});
