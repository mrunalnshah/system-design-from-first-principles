import { describe, expect, it } from "vitest";
import { keyAction, MAX_SCALE } from "./diagram-viewer.ts";

const key = (k: string, mods: Partial<Pick<KeyboardEvent, "ctrlKey" | "metaKey" | "altKey">> = {}) =>
  keyAction({ key: k, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe("the full-screen view's zoom", () => {
  it("goes up to 400%", () => {
    expect(MAX_SCALE).toBe(4);
  });

  it("zooms with + and −, and 0 goes back to 100%", () => {
    expect(key("+")).toBe("in");
    expect(key("=")).toBe("in");
    expect(key("-")).toBe("out");
    expect(key("_")).toBe("out");
    expect(key("0")).toBe("reset");
  });

  it("leaves every other key, and the browser's own shortcuts, alone", () => {
    expect(key("Escape")).toBeUndefined();
    expect(key("ArrowRight")).toBeUndefined();
    expect(key("+", { ctrlKey: true })).toBeUndefined();
    expect(key("0", { metaKey: true })).toBeUndefined();
  });
});
