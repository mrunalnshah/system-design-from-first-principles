import { describe, expect, it } from "vitest";
import { directionOf, type KeyPlace, type KeyPress } from "./keyboard-nav.ts";

const press = (key: string, more: Partial<KeyPress> = {}): KeyPress => ({
  key,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  isComposing: false,
  defaultPrevented: false,
  ...more,
});
const reading: KeyPlace = { typing: false, dialogOpen: false, scrollsSideways: false };

describe("arrow keys on a chapter", () => {
  // @req REQ-BOOK-005.AC1
  it("go to the next chapter with → and the previous with ←", () => {
    expect(directionOf(press("ArrowRight"), reading)).toBe("next");
    expect(directionOf(press("ArrowLeft"), reading)).toBe("prev");
    expect(directionOf(press("ArrowDown"), reading)).toBeUndefined();
    expect(directionOf(press("l"), reading)).toBeUndefined();
  });

  // @req REQ-BOOK-005.AC2
  it("do nothing while a dialog such as the full-screen diagram view is open", () => {
    expect(directionOf(press("ArrowRight"), { ...reading, dialogOpen: true })).toBeUndefined();
    expect(directionOf(press("ArrowLeft"), { ...reading, dialogOpen: true })).toBeUndefined();
  });

  it("do nothing while the reader types, scrolls a wide box, or holds a modifier", () => {
    expect(directionOf(press("ArrowRight"), { ...reading, typing: true })).toBeUndefined();
    expect(directionOf(press("ArrowRight"), { ...reading, scrollsSideways: true })).toBeUndefined();
    for (const mod of ["altKey", "ctrlKey", "metaKey", "shiftKey"] as const)
      expect(directionOf(press("ArrowRight", { [mod]: true }), reading)).toBeUndefined();
    expect(directionOf(press("ArrowRight", { isComposing: true }), reading)).toBeUndefined();
    expect(directionOf(press("ArrowRight", { defaultPrevented: true }), reading)).toBeUndefined();
  });
});
