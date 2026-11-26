import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { context } from "../test-context.ts";
import { renderObsidian } from "../render.ts";
import { createSlugger, slugify } from "../slugify.ts";

const chapter1 = readFileSync(join(import.meta.dirname, "../../../../tests/fixtures/markdown/chapter-1.md"), "utf8");
const numbered = context({ filePath: "part-1_foundations/chapter-1_computer-architecture.md", headingNumbers: { prefix: "1" } });

describe("headings", () => {
  // @req REQ-READ-004.AC1
  it("numbers Chapter 1: 1.1 Components, 1.1.1 Disk, 1.1.2 RAM, 1.2 Limitations", async () => {
    const { sections } = await renderObsidian(chapter1, numbered);
    const read = sections.map((s) => `${s.number} ${s.text}`);
    expect(read.slice(0, 3)).toEqual(["1.1 Components", "1.1.1 Disk", "1.1.2 RAM (Random Access Memory)"]);
    expect(read).toContain("1.2 Limitations");
    expect(read.indexOf("1.2 Limitations")).toBeGreaterThan(read.indexOf("1.1.2 RAM (Random Access Memory)"));
  });

  // @req REQ-READ-004.AC2
  it("renders the vault's # headings as h2 and ## as h3, with no h1 (the page title is the only one)", async () => {
    const { html } = await renderObsidian(chapter1, numbered);
    expect(html).not.toMatch(/<h1[\s>]/);
    expect(html).toContain('<h2 id="components"><span class="section-number">1.1</span> Components</h2>');
    expect(html).toContain('<h3 id="disk"><span class="section-number">1.1.1</span> Disk</h3>');
  });

  // @req REQ-BOOK-002.AC2
  it("gives the heading \"Moore's Law\" the anchor #moores-law", async () => {
    const { html, sections } = await renderObsidian("# Moore's Law\n\n# Moore’s Law", context());
    expect(html).toContain('<h2 id="moores-law">');
    expect(sections.map((s) => s.anchor)).toEqual(["moores-law", "moores-law-1"]);
  });

  it("leaves articles unnumbered, demotes deeper headings, and skips a ## that has no # before it", async () => {
    const plain = await renderObsidian("# A\n## B\n### C\n###### F", context());
    expect(plain.html).toBe('<h2 id="a">A</h2>\n<h3 id="b">B</h3>\n<h4 id="c">C</h4>\n<h6 id="f">F</h6>');
    expect(plain.sections).toEqual([{ depth: 2, text: "A", anchor: "a" }, { depth: 3, text: "B", anchor: "b" }]);
    const early = await renderObsidian("## Before\n# Then\n## After", numbered);
    expect(early.sections.map((s) => s.number)).toEqual([undefined, "1.1", "1.1.1"]);
  });

  it("counts only top-level headings as sections; one inside a callout or list is demoted and anchored, not numbered", async () => {
    const { html, sections } = await renderObsidian("# One\n\n> [!note]\n> # Inside\n\n- # In a list\n\n# Two", numbered);
    expect(sections.map((s) => `${s.number} ${s.text}`)).toEqual(["1.1 One", "1.2 Two"]);
    expect(html).toContain('<h2 id="inside">Inside</h2>');
  });

  it("slugs by GitHub's rule", () => {
    expect(slugify("RAM (Random Access Memory)")).toBe("ram-random-access-memory");
    expect(slugify("CPU & Cache: 101")).toBe("cpu--cache-101");
    expect(slugify("Über_größe")).toBe("über_größe");
    const slug = createSlugger();
    expect([slug("x"), slug("x"), slug("x-1"), slug("!!!")]).toEqual(["x", "x-1", "x-1-1", "section"]);
  });
});
