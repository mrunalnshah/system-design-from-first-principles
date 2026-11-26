import { describe, expect, it } from "vitest";
import { createFileResolver } from "./resolve.ts";

const CHAPTER = "part-1_foundations/chapter-1_computer-architecture.md";

describe("Obsidian's file lookup", () => {
  // @req REQ-CNT-006.AC3
  it("uses the 01-light.svg in the chapter's own part folder when two exist", () => {
    const resolve = createFileResolver(["part-2_networks/diagram/01-light.svg", "part-1_foundations/diagram/01-light.svg", "diagram/01-light.svg"]);
    expect(resolve("01-light.svg", CHAPTER)).toBe("part-1_foundations/diagram/01-light.svg");
    expect(resolve("01-light.svg", "part-2_networks/chapter-2_tcp.md")).toBe("part-2_networks/diagram/01-light.svg");
  });

  it("prefers the shortest path when no candidate shares a folder, then alphabetical order", () => {
    const resolve = createFileResolver(["b/deep/x.svg", "z/x.svg", "a/x.svg"]);
    expect(resolve("x.svg", "articles/a.md")).toBe("a/x.svg");
  });

  it("matches a path ending, prefers exact case, finds notes without .md, and never invents a file", () => {
    const resolve = createFileResolver(["part-1_foundations/diagram/01-light.svg", "notes/Idea.md", "other/X.svg", "other/x.svg"]);
    expect(resolve("diagram/01-light.svg", CHAPTER)).toBe("part-1_foundations/diagram/01-light.svg");
    expect(resolve("x.svg", CHAPTER)).toBe("other/x.svg");
    expect(resolve("01-LIGHT.svg", CHAPTER)).toBe("part-1_foundations/diagram/01-light.svg");
    expect(resolve("Idea", CHAPTER)).toBe("notes/Idea.md");
    expect(resolve("missing.svg", CHAPTER)).toBeUndefined();
    expect(resolve("  ", CHAPTER)).toBeUndefined();
  });
});
