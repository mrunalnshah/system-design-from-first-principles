import { describe, expect, it } from "vitest";
import { currentIndex, readingLine } from "./chapter-menu.ts";

describe("the scrollspy's choice of section", () => {
  // @req REQ-READ-007.AC1
  it("is the last heading that has reached the reading line", () => {
    // 1.1 Components scrolled away above, 1.2 Limitations just under the header, 1.3 Moore's Law further down.
    expect(currentIndex([-900, 80, 260], readingLine(80))).toBe(1);
    expect(currentIndex([-900, -40, 104], readingLine(80))).toBe(2);
  });

  // @req REQ-READ-007.AC1
  it("is none above the first heading, and the first one once it reaches the line", () => {
    expect(currentIndex([300, 900], readingLine(80))).toBe(-1);
    expect(currentIndex([readingLine(80), 900], readingLine(80))).toBe(0);
    expect(currentIndex([], readingLine(80))).toBe(-1);
  });

  it("puts the reading line just under the point a section link brings its heading to", () => {
    expect(readingLine(80)).toBeGreaterThan(80);
    expect(readingLine(80)).toBeLessThan(160);
  });
});
