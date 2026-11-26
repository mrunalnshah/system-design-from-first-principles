import { describe, expect, it } from "vitest";
import { renderObsidian } from "../render.ts";
import { createFileResolver } from "../resolve.ts";
import type { RenderContext } from "../types.ts";

const CHAPTER = "part-1_foundations/chapter-1_computer-architecture.md";
type Drawn = { files: string[]; alias?: string; line: number };

/** A chapter's context over the given vault files, recording every figure it's asked to draw. */
function chapter(files: string[]) {
  const drawn: Drawn[] = [];
  const ctx: RenderContext = {
    filePath: CHAPTER,
    resolveFile: createFileResolver(files),
    resolveNote: () => undefined,
    headingNumbers: { prefix: "1" },
    figure: ({ files: f, alias, line }) => {
      drawn.push({ files: f, line, ...(alias ? { alias } : {}) });
      return { html: `<figure>${f.join(" ")}</figure>`, issues: [] };
    },
  };
  return { ctx, drawn };
}

describe("embeds", () => {
  // @req REQ-CNT-006.AC1
  it("shows ![[01-light.svg]] from part-1_foundations/diagram/ as a figure", async () => {
    const { ctx, drawn } = chapter(["part-1_foundations/diagram/01-light.svg"]);
    const { html, issues, figureCount } = await renderObsidian("Intro.\n\n![[01-light.svg]]", ctx);
    expect(html).toBe("<p>Intro.</p>\n<figure>part-1_foundations/diagram/01-light.svg</figure>");
    expect(drawn).toEqual([{ files: ["part-1_foundations/diagram/01-light.svg"], line: 3 }]);
    expect(issues).toEqual([]);
    expect(figureCount).toBe(1);
  });

  // @req REQ-CNT-006.AC2
  it("stops the build for ![[missing.svg]], naming the entry, the line and the file", async () => {
    const { ctx } = chapter([]);
    const { issues, html } = await renderObsidian("One.\n\n![[missing.svg]]", ctx);
    expect(issues).toEqual([
      { severity: "error", code: "E-EMBED-MISSING", file: CHAPTER, line: 3, column: 1, message: 'The file "missing.svg" can\'t be found in the vault.', fix: "Check the spelling, or add the file." },
    ]);
    expect(html).toBe("<p>One.</p>");
  });

  // @req REQ-CNT-006.AC3
  it("embeds the 01-light.svg in the chapter's own part when another part has one too", async () => {
    const { ctx, drawn } = chapter(["part-2_networks/diagram/01-light.svg", "part-1_foundations/diagram/01-light.svg"]);
    await renderObsidian("![[01-light.svg]]", ctx);
    expect(drawn[0]!.files).toEqual(["part-1_foundations/diagram/01-light.svg"]);
  });

  // @req REQ-DIAG-006.AC2
  it("resolves ![[01_computer-architecture.excalidraw]] to its exported images, never to the drawing", async () => {
    const { ctx, drawn } = chapter([
      "part-1_foundations/excalidraw/01_computer-architecture.excalidraw.md",
      "part-1_foundations/diagram/01_computer-architecture-light.svg",
      "part-1_foundations/diagram/01_computer-architecture-dark.svg",
    ]);
    const asked: string[] = [];
    const resolve = ctx.resolveFile;
    ctx.resolveFile = (name, from) => (asked.push(name), resolve(name, from));
    const { html, issues } = await renderObsidian("![[01_computer-architecture.excalidraw|How a computer is put together]]", ctx);
    expect(drawn).toEqual([
      { files: ["part-1_foundations/diagram/01_computer-architecture-light.svg", "part-1_foundations/diagram/01_computer-architecture-dark.svg"], alias: "How a computer is put together", line: 1 },
    ]);
    expect(asked.every((n) => n.endsWith(".svg"))).toBe(true); // the drawing itself is never looked up, let alone read
    expect(html).not.toContain("excalidraw");
    expect(issues).toEqual([]);
  });

  // @req REQ-DIAG-007.AC2
  it("stops the build for a drawing with no images, naming the entry, line and drawing, and saying to save it and run sync", async () => {
    const { ctx } = chapter(["part-1_foundations/excalidraw/03_cache.excalidraw.md"]);
    const { issues } = await renderObsidian("Text.\n\nMore.\n![[03_cache.excalidraw|Caches]]", ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", code: "E-DRAWING-NOT-EXPORTED", file: CHAPTER, line: 4 });
    expect(issues[0]!.message).toContain('"03_cache.excalidraw"');
    expect(issues[0]!.fix).toBe("Open the drawing in Obsidian, save it (Ctrl+S), then run sync so its images are collected.");
  });

  it("joins a light embed and the dark one after it (as in Chapter 1) into one figure, in either order", async () => {
    const files = ["part-1_foundations/diagram/01-light.svg", "part-1_foundations/diagram/01-dark.svg", "part-1_foundations/diagram/02.light.svg", "part-1_foundations/diagram/02.dark.svg"];
    const { ctx, drawn } = chapter(files);
    await renderObsidian("![[01-light.svg]]\n\n![[01-dark.svg|Caption]]\n\n![[02.dark.svg]] ![[02.light.svg]]", ctx);
    expect(drawn).toEqual([
      { files: [files[0], files[1]], alias: "Caption", line: 1 },
      { files: [files[2], files[3]], line: 5 },
    ]);
  });

  it("splits a paragraph around an embed, ignores a |300 width, and shows other embeds as text with a warning", async () => {
    const { ctx, drawn } = chapter(["part-1_foundations/diagram/01-light.svg", "notes/idea.md"]);
    const { html, issues } = await renderObsidian("- Founders of Intel\n![[01-light.svg|300]]\n\nSee ![[idea]].", ctx);
    expect(html).toBe("<ul>\n<li>Founders of Intel\n<figure>part-1_foundations/diagram/01-light.svg</figure>\n</li>\n</ul>\n<p>See idea.</p>");
    expect(drawn[0]).toEqual({ files: ["part-1_foundations/diagram/01-light.svg"], line: 2 });
    expect(issues.map((i) => [i.code, i.line])).toEqual([["W-SYNTAX-UNKNOWN", 4]]);
  });
});
