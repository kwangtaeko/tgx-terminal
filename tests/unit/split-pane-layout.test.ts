import { describe, expect, it } from "vitest";

import { computeSplitPaneLayout } from "../../src/layout/split-pane-layout.js";

const constraints = { minimumColumns: 40, minimumRows: 8 };

describe("computeSplitPaneLayout", () => {
  it("divides an even side-by-side canvas around one separator column", () => {
    expect(computeSplitPaneLayout({ columns: 101, rows: 24 }, "side-by-side", constraints)).toEqual({
      orientation: "side-by-side",
      first: { column: 0, row: 0, columns: 50, rows: 24 },
      separator: { column: 50, row: 0, columns: 1, rows: 24 },
      second: { column: 51, row: 0, columns: 50, rows: 24 },
    });
  });

  it("assigns an odd spare column to the second side-by-side pane", () => {
    expect(computeSplitPaneLayout({ columns: 100, rows: 24 }, "side-by-side", constraints)).toEqual({
      orientation: "side-by-side",
      first: { column: 0, row: 0, columns: 49, rows: 24 },
      separator: { column: 49, row: 0, columns: 1, rows: 24 },
      second: { column: 50, row: 0, columns: 50, rows: 24 },
    });
  });

  it("divides a stacked canvas around one separator row", () => {
    expect(computeSplitPaneLayout({ columns: 40, rows: 17 }, "stacked", constraints)).toEqual({
      orientation: "stacked",
      first: { column: 0, row: 0, columns: 40, rows: 8 },
      separator: { column: 0, row: 8, columns: 40, rows: 1 },
      second: { column: 0, row: 9, columns: 40, rows: 8 },
    });
  });

  it("uses the exact minimum boundary and assigns an odd stacked row to the second pane", () => {
    expect(computeSplitPaneLayout({ columns: 81, rows: 8 }, "side-by-side", constraints)).toMatchObject({
      first: { columns: 40, rows: 8 },
      separator: { column: 40, columns: 1, rows: 8 },
      second: { column: 41, columns: 40, rows: 8 },
    });
    expect(computeSplitPaneLayout({ columns: 40, rows: 18 }, "stacked", constraints)).toMatchObject({
      first: { columns: 40, rows: 8 },
      separator: { row: 8, columns: 40, rows: 1 },
      second: { row: 9, columns: 40, rows: 9 },
    });
  });

  it("returns undefined instead of creating undersized panes", () => {
    expect(computeSplitPaneLayout({ columns: 80, rows: 8 }, "side-by-side", constraints)).toBeUndefined();
    expect(computeSplitPaneLayout({ columns: 40, rows: 16 }, "stacked", constraints)).toBeUndefined();
  });

  it("rejects invalid canvas and constraint dimensions", () => {
    expect(() => computeSplitPaneLayout({ columns: 0, rows: 24 }, "side-by-side", constraints)).toThrow(RangeError);
    expect(() => computeSplitPaneLayout({ columns: 80, rows: 24 }, "side-by-side", { minimumColumns: 0, minimumRows: 8 })).toThrow(RangeError);
    expect(() => computeSplitPaneLayout({ columns: 80, rows: 24 }, "stacked", { minimumColumns: 40, minimumRows: 1.5 })).toThrow(RangeError);
    expect(() => computeSplitPaneLayout({ columns: 80, rows: 24 }, "diagonal" as never, constraints)).toThrow(RangeError);
  });
});
