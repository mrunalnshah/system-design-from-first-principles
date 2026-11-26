import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { golden, context } from "../test-context.ts";
import { renderObsidian } from "../render.ts";

const CHAPTER = "part-1_foundations/chapter-1_computer-architecture.md";
const fixtures = join(import.meta.dirname, "../../../../tests/fixtures/markdown");

describe("math", () => {
  // @req REQ-READ-008.AC1
  it("typesets $\\frac{1}{10^3}$ at build time, so it shows with JavaScript off", async () => {
    const { html, issues } = await renderObsidian("Reading is $\\frac{1}{10^3}$.", context());
    expect(html).toContain('<span class="mfrac">');
    expect(html).toContain("<math"); // MathML, read by screen readers
    expect(html).not.toContain("<script");
    expect(html).not.toContain("$");
    expect(issues).toEqual([]);
  });

  // @req REQ-READ-008.AC2
  it("stops the build for $\\micro s$, naming the file and line and suggesting \\mu", async () => {
    const { issues } = await renderObsidian("Line one.\n\nMeasured in $\\micro s$ here.", context({ filePath: CHAPTER }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", code: "E-MATH", file: CHAPTER, line: 3, column: 14 });
    expect(issues[0]!.message).toContain("\\micro");
    expect(issues[0]!.fix).toMatch(/^Use a supported command; for micro, write \\mu\./);
  });

  // @req REQ-READ-008.AC4
  it("shows $\\mu s$ as μs", async () => {
    const { html } = await renderObsidian("$\\mu s$", context());
    expect(html).toContain("<mi>μ</mi><mi>s</mi>");
    expect(html.replace(/<span class="katex-mathml">.*?<\/span>/s, "").replace(/<[^>]+>/g, "")).toContain("μs");
  });

  // @req REQ-CNT-005.AC1
  it("typesets Chapter 1's $\\frac{1}{10^3}$ and $\\mu s$ (after the \\mu edit), not raw text", async () => {
    const source = readFileSync(join(fixtures, "chapter-1.md"), "utf8");
    expect(source).toContain("$\\mu s$"); // the fixture is the author's edited chapter (CNF-001)
    const { html, issues } = await renderObsidian(source, context({ filePath: CHAPTER, headingNumbers: { prefix: "1" } }));
    expect(html).toContain('<annotation encoding="application/x-tex">\\frac{1}{10^3}</annotation>');
    expect(html).toContain('<annotation encoding="application/x-tex">\\mu s</annotation>');
    expect(html).not.toMatch(/\$\\(frac|mu)/);
    expect(issues.filter((i) => i.code === "E-MATH")).toEqual([]);
  });

  it("keeps prices as text, puts display math in its own block, and matches the golden HTML", async () => {
    const { html, expected } = await golden("math/units", context());
    expect(html).toBe(expected);
    expect(html).toContain('"$5 and $10" stays text');
    expect(html).toMatch(/<div class="math-display"><span class="katex-display">/);
  });

  it("points at the right line inside display math", async () => {
    const { issues } = await renderObsidian("Intro.\n\n$$\na + b\n\\nope{c}\n$$", context());
    expect(issues.map((i) => [i.code, i.line, i.column])).toEqual([["E-MATH", 5, 1]]);
  });
});
