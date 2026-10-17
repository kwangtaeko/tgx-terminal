import { describe, expect, it } from "vitest";

describe("project harness", () => {
  it("runs unit tests", () => {
    expect(typeof process.version).toBe("string");
  });
});
