import { describe, expect, it } from "vitest";
import { createFigureRenderer, indexOf } from "../src/features/diagrams/index.ts";
import { createFileResolver, renderObsidian, type RenderContext } from "../src/features/markdown/index.ts";

/**
 * Diagrams through the Markdown renderer, as the vault loader will join them (REQ-DIAG-001, -004, -007): the embeds
 * MOD-obsidian-markdown finds, drawn by MOD-diagrams' real figure renderer. Cross-module, so it lives here.
 */
const CHAPTER = "part-1_foundations/chapter-1_computer-architecture.md";
const D = "part-1_foundations/diagram";
const svg = (texts: string[] = [], pad = 0) => `<svg viewBox="0 0 490 400">${texts.map((t) => `<text>${t}</text>`).join("")}${pad ? `<!--${"x".repeat(pad)}-->` : ""}</svg>`;

/** What one rendered figure shows: the light image's and dark image's file names, alt text and caption. */
type Shown = { light: string; dark?: string; alt: string; caption?: string };
const name = (u: string) => u.split("/").pop()!.replace(/^[0-9a-f]{8}-/, "");

async function render(md: string, svgs: Record<string, string>) {
  const figure = createFigureRenderer(indexOf(svgs));
  const ctx: RenderContext = { filePath: CHAPTER, resolveFile: createFileResolver(Object.keys(svgs)), resolveNote: () => undefined, headingNumbers: { prefix: "1" }, figure };
  const { html, issues } = await renderObsidian(md, ctx);
  const figures: Shown[] = [...html.matchAll(/<figure class="diagram"[^>]*>([\s\S]*?)<\/figure>/g)].map(([, inner]) => {
    const shown: Shown = { light: name(/<img src="([^"]+)"/.exec(inner!)![1]!), alt: /alt="([^"]*)"/.exec(inner!)![1]! };
    const dark = /srcset="([^"]+)"/.exec(inner!)?.[1];
    const caption = /<figcaption>([\s\S]*?)<\/figcaption>/.exec(inner!)?.[1];
    if (dark) shown.dark = name(dark);
    if (caption) shown.caption = caption;
    return shown;
  });
  return { figures, issues };
}

describe("diagrams in rendered entries", () => {
  // @req REQ-DIAG-001.AC1
  it("shows Chapter 1's ![[01-light.svg]] then ![[01-dark.svg]] as exactly one figure", async () => {
    const { figures } = await render("![[01-light.svg]]\n\n![[01-dark.svg]]", { [`${D}/01-light.svg`]: svg(), [`${D}/01-dark.svg`]: svg() });
    expect(figures).toHaveLength(1);
    expect([figures[0]!.light, figures[0]!.dark]).toEqual(["01-light.svg", "01-dark.svg"]);
  });

  // @req REQ-DIAG-001.AC3
  it("still follows the theme when only ![[01-light.svg]] is embedded but 01-dark.svg is next to it", async () => {
    const { figures, issues } = await render("![[01-light.svg|Parts]]", { [`${D}/01-light.svg`]: svg(), [`${D}/01-dark.svg`]: svg() });
    expect(figures[0]!.dark).toBe("01-dark.svg");
    expect(issues).toEqual([]);
  });

  // @req REQ-DIAG-001.AC4
  it("shows an SVG with no light/dark partner in both themes, without a warning", async () => {
    const { figures, issues } = await render("![[flow.svg|Flow]]", { [`${D}/flow.svg`]: svg() });
    expect(figures[0]!.dark).toBeUndefined();
    expect(issues).toEqual([]);
  });

  // @req REQ-DIAG-001.AC6
  it("pairs the plugin's 02_moores-law.excalidraw.light.svg with its .dark.svg", async () => {
    const svgs = { [`${D}/02_moores-law.excalidraw.light.svg`]: svg(), [`${D}/02_moores-law.excalidraw.dark.svg`]: svg() };
    const { figures } = await render("![[02_moores-law.excalidraw.light.svg|Moore's law]]", svgs);
    expect(figures[0]!.dark).toBe("02-moores-law.excalidraw.dark.svg"); // published names are URL-safe
  });

  // @req REQ-DIAG-004.AC1
  it("uses the alias of ![[01-light.svg|How a computer is built]] as alt text and caption", async () => {
    const { figures } = await render("![[01-light.svg|How a computer is built]]", { [`${D}/01-light.svg`]: svg(["CPU"]), [`${D}/01-dark.svg`]: svg() });
    expect([figures[0]!.alt, figures[0]!.caption]).toEqual(["How a computer is built", "How a computer is built"]);
  });

  // @req REQ-DIAG-004.AC2
  it("takes alt text from the SVG's words when there's no alias, and warns suggesting a caption", async () => {
    const { figures, issues } = await render("Intro.\n\n![[01-light.svg]]", { [`${D}/01-light.svg`]: svg(["Disk", "RAM", "CPU", "Cache"]), [`${D}/01-dark.svg`]: svg() });
    expect(figures[0]!.alt).toBe("Diagram: Disk, RAM, CPU, Cache");
    expect(figures[0]!.caption).toBeUndefined();
    expect(issues).toEqual([expect.objectContaining({ severity: "warning", code: "W-DIAGRAM-NO-CAPTION", file: CHAPTER, line: 3 })]);
    expect(issues[0]!.fix).toMatch(/^Add a caption: !\[\[file\.svg\|Caption\]\]\./);
  });

  // @req REQ-DIAG-007.AC1
  it("shows ![[01_computer-architecture.excalidraw|How a computer is put together]] as one themed figure with that caption", async () => {
    const svgs = { [`${D}/01_computer-architecture-light.svg`]: svg(), [`${D}/01_computer-architecture-dark.svg`]: svg() };
    const { figures, issues } = await render("![[01_computer-architecture.excalidraw|How a computer is put together]]", svgs);
    expect(figures).toEqual([{ light: "01-computer-architecture-light.svg", dark: "01-computer-architecture-dark.svg", alt: "How a computer is put together", caption: "How a computer is put together" }]);
    expect(issues).toEqual([]);
  });

  it("warns about a light image with no dark partner, and about an image over 250 KB", async () => {
    const unpaired = await render("![[01-light.svg|Parts]]", { [`${D}/01-light.svg`]: svg() });
    expect(unpaired.issues.map((i) => i.code)).toEqual(["W-DIAGRAM-UNPAIRED"]);
    expect(unpaired.issues[0]!.message).toContain("01-dark.svg");
    const large = await render("![[big.svg|Big]]", { [`${D}/big.svg`]: svg([], 250 * 1024) });
    expect(large.issues.map((i) => i.code)).toEqual(["W-DIAGRAM-LARGE"]);
  });

  it("pairs a light image with its dark partner whatever the case and separator, as consecutive embeds do", async () => {
    const { figures, issues } = await render("![[01-Light.svg|Parts]]", { [`${D}/01-Light.svg`]: svg(), [`${D}/01.dark.svg`]: svg() });
    expect(figures[0]!.dark).toBe("01.dark.svg");
    expect(issues).toEqual([]);
  });
});
