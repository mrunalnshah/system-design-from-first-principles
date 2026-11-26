import { describe, expect, it } from "vitest";

/**
 * Diagrams through the Markdown renderer, as the vault loader will join them (REQ-DIAG-001, -004, -007): the
 * embeds MOD-obsidian-markdown finds, and the figure MOD-diagrams plans for each. Cross-module, so it lives here.
 */
import { indexOf, planFigure } from "../src/features/diagrams/index.ts";
import { createFileResolver, renderObsidian, type RenderContext } from "../src/features/markdown/index.ts";

/** Over the 250 KB that W-DIAGRAM-LARGE warns about. */
const LARGE_BYTES = 250 * 1024;

const CHAPTER = "part-1_foundations/chapter-1_computer-architecture.md";
const D = "part-1_foundations/diagram";
const svg = (texts: string[] = [], pad = 0) => `<svg viewBox="0 0 490 400">${texts.map((t) => `<text>${t}</text>`).join("")}${pad ? `<!--${"x".repeat(pad)}-->` : ""}</svg>`;

/** Renders `md` from Chapter 1 with the given SVGs, recording each figure's plan. */
async function render(md: string, svgs: Record<string, string>) {
  const index = indexOf(svgs);
  const plans: ReturnType<typeof planFigure>[] = [];
  const ctx: RenderContext = {
    filePath: CHAPTER,
    resolveFile: createFileResolver(Object.keys(svgs)),
    resolveNote: () => undefined,
    headingNumbers: { prefix: "1" },
    figure: (embed) => {
      const planned = planFigure(index, embed);
      plans.push(planned);
      return { html: "<figure></figure>", issues: planned.issues };
    },
  };
  const { issues } = await renderObsidian(md, ctx);
  return { plans: plans.map((p) => p.plan!), issues };
}

describe("diagrams in rendered entries", () => {
  // @req REQ-DIAG-001.AC1
  it("shows Chapter 1's ![[01-light.svg]] then ![[01-dark.svg]] as exactly one figure", async () => {
    const { plans } = await render("![[01-light.svg]]\n\n![[01-dark.svg]]", { [`${D}/01-light.svg`]: svg(), [`${D}/01-dark.svg`]: svg() });
    expect(plans).toHaveLength(1);
    expect([plans[0]!.light.path, plans[0]!.dark?.path]).toEqual([`${D}/01-light.svg`, `${D}/01-dark.svg`]);
  });

  // @req REQ-DIAG-001.AC3
  it("still follows the theme when only ![[01-light.svg]] is embedded but 01-dark.svg is next to it", async () => {
    const { plans, issues } = await render("![[01-light.svg|Parts]]", { [`${D}/01-light.svg`]: svg(), [`${D}/01-dark.svg`]: svg() });
    expect(plans[0]!.dark?.path).toBe(`${D}/01-dark.svg`);
    expect(issues).toEqual([]);
  });

  // @req REQ-DIAG-001.AC4
  it("shows an SVG with no light/dark partner in both themes, without a warning", async () => {
    const { plans, issues } = await render("![[flow.svg|Flow]]", { [`${D}/flow.svg`]: svg() });
    expect(plans[0]!.dark).toBeUndefined();
    expect(issues).toEqual([]);
  });

  // @req REQ-DIAG-001.AC6
  it("pairs the plugin's 02_moores-law.excalidraw.light.svg with its .dark.svg", async () => {
    const svgs = { [`${D}/02_moores-law.excalidraw.light.svg`]: svg(), [`${D}/02_moores-law.excalidraw.dark.svg`]: svg() };
    const { plans } = await render("![[02_moores-law.excalidraw.light.svg|Moore's law]]", svgs);
    expect(plans[0]!.dark?.path).toBe(`${D}/02_moores-law.excalidraw.dark.svg`);
  });

  // @req REQ-DIAG-004.AC1
  it("uses the alias of ![[01-light.svg|How a computer is built]] as alt text and caption", async () => {
    const { plans } = await render("![[01-light.svg|How a computer is built]]", { [`${D}/01-light.svg`]: svg(["CPU"]), [`${D}/01-dark.svg`]: svg() });
    expect([plans[0]!.alt, plans[0]!.caption]).toEqual(["How a computer is built", "How a computer is built"]);
  });

  // @req REQ-DIAG-004.AC2
  it("takes alt text from the SVG's words when there's no alias, and warns suggesting a caption", async () => {
    const { plans, issues } = await render("Intro.\n\n![[01-light.svg]]", { [`${D}/01-light.svg`]: svg(["Disk", "RAM", "CPU", "Cache"]), [`${D}/01-dark.svg`]: svg() });
    expect(plans[0]!.alt).toBe("Diagram: Disk, RAM, CPU, Cache");
    expect(plans[0]!.caption).toBeUndefined();
    expect(issues).toEqual([expect.objectContaining({ severity: "warning", code: "W-DIAGRAM-NO-CAPTION", file: CHAPTER, line: 3 })]);
    expect(issues[0]!.fix).toMatch(/^Add a caption: !\[\[file\.svg\|Caption\]\]\./);
  });

  // @req REQ-DIAG-007.AC1
  it("shows ![[01_computer-architecture.excalidraw|How a computer is put together]] as one themed figure with that caption", async () => {
    const svgs = { [`${D}/01_computer-architecture-light.svg`]: svg(), [`${D}/01_computer-architecture-dark.svg`]: svg() };
    const { plans, issues } = await render("![[01_computer-architecture.excalidraw|How a computer is put together]]", svgs);
    expect(plans).toHaveLength(1);
    expect([plans[0]!.light.path, plans[0]!.dark?.path, plans[0]!.caption]).toEqual([`${D}/01_computer-architecture-light.svg`, `${D}/01_computer-architecture-dark.svg`, "How a computer is put together"]);
    expect(issues).toEqual([]);
  });

  it("warns about a light image with no dark partner, and about an image over 250 KB", async () => {
    const unpaired = await render("![[01-light.svg|Parts]]", { [`${D}/01-light.svg`]: svg() });
    expect(unpaired.issues.map((i) => i.code)).toEqual(["W-DIAGRAM-UNPAIRED"]);
    expect(unpaired.issues[0]!.message).toContain("01-dark.svg");
    const large = await render("![[big.svg|Big]]", { [`${D}/big.svg`]: svg([], LARGE_BYTES) });
    expect(large.issues.map((i) => i.code)).toEqual(["W-DIAGRAM-LARGE"]);
  });
});
