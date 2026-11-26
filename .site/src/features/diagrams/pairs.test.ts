import { describe, expect, it } from "vitest";
import { indexOf } from "./index-svg.ts";
import { LARGE_BYTES, planFigure, themeOf } from "./pairs.ts";

const CHAPTER = "part-1_foundations/chapter-1_computer-architecture.md";
const D = "part-1_foundations/diagram";
const svg = (texts: string[] = [], pad = 0) => `<svg viewBox="0 0 490 400">${texts.map((t) => `<text>${t}</text>`).join("")}${pad ? `<!--${"x".repeat(pad)}-->` : ""}</svg>`;
const plan = (svgs: Record<string, string>, files: string[], alias?: string) => planFigure(indexOf(svgs), { files, ...(alias ? { alias } : {}), fromPath: CHAPTER, line: 7 });

describe("figure plans", () => {
  it("puts a pair's light image in the <img> and its dark image in the source, in either order", () => {
    const { plan: p } = plan({ [`${D}/a-light.svg`]: svg(), [`${D}/a-dark.svg`]: svg() }, [`${D}/a-dark.svg`, `${D}/a-light.svg`], "A");
    expect([p!.light.path, p!.dark?.path]).toEqual([`${D}/a-light.svg`, `${D}/a-dark.svg`]);
  });

  it("finds a partner only in the same folder, and lets a lone dark image serve both themes", () => {
    const other = plan({ [`${D}/a-light.svg`]: svg(), ["articles/a-dark.svg"]: svg() }, [`${D}/a-light.svg`], "A");
    expect(other.issues.map((i) => i.code)).toEqual(["W-DIAGRAM-UNPAIRED"]);
    const dark = plan({ [`${D}/a-dark.svg`]: svg() }, [`${D}/a-dark.svg`], "A");
    expect([dark.plan!.light.path, dark.plan!.dark]).toEqual([`${D}/a-dark.svg`, undefined]);
  });

  it("clips long alt text from the SVG's words at a word boundary, and says 'Diagram' when it has none", () => {
    const words = Array.from({ length: 60 }, (_, i) => `Word${i}`);
    const long = plan({ [`${D}/x.svg`]: svg(words) }, [`${D}/x.svg`]).plan!.alt;
    expect(long.length).toBeLessThanOrEqual(210);
    expect(long).toMatch(/^Diagram: Word0, Word1, .*…$/);
    expect(plan({ [`${D}/y.svg`]: svg() }, [`${D}/y.svg`]).plan!.alt).toBe("Diagram");
  });

  it("warns once about the larger variant of a pair over 250 KB, at the embed's line", () => {
    const { issues } = plan({ [`${D}/b-light.svg`]: svg([], LARGE_BYTES), [`${D}/b-dark.svg`]: svg() }, [`${D}/b-light.svg`, `${D}/b-dark.svg`], "B");
    expect(issues.map((i) => [i.code, i.file, i.line])).toEqual([["W-DIAGRAM-LARGE", CHAPTER, 7]]);
    expect(issues[0]!.message).toContain("b-light.svg");
  });

  it("refuses an image that isn't indexed (outside the part folders and articles/)", () => {
    const { plan, issues } = planFigure(indexOf({}), { files: ["Excalidraw/x.svg"], alias: "X", fromPath: CHAPTER, line: 4 });
    expect(plan).toBeUndefined();
    expect(issues.map((i) => [i.code, i.line])).toEqual([["E-EMBED-MISSING", 4]]);
  });

  it("names partners in both naming styles and keeps the author's case", () => {
    expect(themeOf("a/01-light.svg")).toEqual({ theme: "light", partner: "a/01-dark.svg" });
    expect(themeOf("a/x.excalidraw.dark.svg")).toEqual({ theme: "dark", partner: "a/x.excalidraw.light.svg" });
    expect(themeOf("a/01-Light.svg")?.partner).toBe("a/01-Dark.svg");
    expect(themeOf("a/flow.svg")).toBeUndefined();
  });
});
