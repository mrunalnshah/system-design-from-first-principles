import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { codeMap, estimateTokens, TRUNCATED } from "./map.ts";

const tempDirs: string[] = [];
afterAll(() => tempDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A folder shaped like MOD-book: functions (declared and arrow), a type, a re-exporting index, a component and a test. */
function bookFixture(): string {
  const dir = mkdtempSync(join(tmpdir(), "sdfp-map-"));
  tempDirs.push(dir);
  writeFileSync(
    join(dir, "contents.ts"),
    [
      "/** The contents page. */",
      'import type { Book } from "../content/index.ts";',
      "export type ContentsPart = { number: number; title: string };",
      "export function contentsOf(book: Book): ContentsPart[] {",
      "  const SECRET_BODY = book.parts.map((p) => p);",
      "  return SECRET_BODY;",
      "}",
      "export const firstChapter = (book: Book): string | undefined => {",
      "  return book.parts[0]?.SECRET_ARROW;",
      "};",
      "export function romanNumeral(n: number): string {",
      '  return "SECRET_ROMAN".repeat(n);',
      "}",
      "function helper(): void {}",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(dir, "neighbours.ts"),
    "export function neighbours(book: Book, chapterSlug: string): { previous?: string; next?: string } {\n  return { SECRET_NEXT: 1 };\n}\n",
  );
  writeFileSync(join(dir, "index.ts"), 'export { contentsOf, firstChapter, romanNumeral } from "./contents.ts";\n');
  writeFileSync(
    join(dir, "PrevNext.astro"),
    [
      "---",
      'import { url } from "../site/index.ts";',
      "interface Props {",
      "  previous?: string;",
      "  next?: string;",
      "}",
      "const SECRET_ASTRO = Astro.props;",
      "---",
      "<nav>{SECRET_ASTRO}</nav>",
      "",
    ].join("\n"),
  );
  writeFileSync(join(dir, "contents.test.ts"), "export function shouldNotShow(): void {}\n");
  return dir;
}

describe("map", () => {
  // @req TOOL-04.AC1
  it("prints contentsOf, neighbours, firstChapter and romanNumeral with their signatures and no bodies", () => {
    const { text, truncated } = codeMap(bookFixture());
    expect(truncated).toBe(false);
    expect(text).toContain("## contents.ts");
    expect(text).toContain("export function contentsOf(book: Book): ContentsPart[];");
    expect(text).toContain("export function neighbours(book: Book, chapterSlug: string): {");
    expect(text).toMatch(/export const firstChapter = \(book: Book\): string \| undefined => …;/);
    expect(text).toContain("export function romanNumeral(n: number): string;");
    expect(text).toContain("export type ContentsPart = {");
    expect(text).toContain('export { contentsOf, firstChapter, romanNumeral } from "./contents.ts";');
    expect(text).toContain("## PrevNext.astro");
    expect(text).toMatch(/interface Props \{\s+previous\?: string;\s+next\?: string;\s+\}/);
    // No bodies, private helpers, comments, imports or tests.
    expect(text).not.toContain("SECRET");
    expect(text).not.toContain("helper");
    expect(text).not.toContain("The contents page");
    expect(text).not.toContain("import");
    expect(text).not.toContain("shouldNotShow");
  });

  // @req TOOL-04.AC1
  it("maps the real .site/src/features/book the same way, without its test helpers", () => {
    const { text } = codeMap(join(import.meta.dirname, "../src/features/book"));
    expect(text).toContain("export function contentsOf(book: Book): ContentsPart[];");
    expect(text).toMatch(/export function neighbours\(book: Book, chapterSlug: string\): \{/);
    expect(text).toContain("export function firstChapter(book: Book): ChapterData | undefined;");
    expect(text).toContain("export function romanNumeral(n: number): string;");
    expect(text).not.toMatch(/return |=> \{|for \(/);
    expect(text).not.toContain("test-vault.ts");
  });

  it("maps a real feature folder", () => {
    const diagrams = fileURLToPath(new URL("../src/features/diagrams", import.meta.url));
    const { text } = codeMap(diagrams);
    expect(text).toContain("## index.ts");
    expect(text).toContain("createFigureRenderer");
    expect(text).toContain("## DiagramFigure.astro");
    expect(text).not.toContain(".test.ts");
  });

  // @req TOOL-04.AC2
  it("cuts output over --budget to about that many tokens, ending in … (truncated)", () => {
    const dir = bookFixture();
    for (let i = 0; i < 60; i++)
      writeFileSync(
        join(dir, `extra-${String(i).padStart(2, "0")}.ts`),
        `export function longFunctionName${i}(firstArgument: string, secondArgument: number): Promise<string[]> { return []; }\n`,
      );
    expect(codeMap(dir).tokens).toBeGreaterThan(500);
    const { text, tokens, truncated } = codeMap(dir, { budget: 500 });
    expect(truncated).toBe(true);
    expect(text.trimEnd().endsWith(TRUNCATED)).toBe(true);
    expect(tokens).toBe(estimateTokens(text));
    expect(tokens).toBeLessThanOrEqual(500);
    expect(tokens).toBeGreaterThan(450);
    // Cut at a line boundary: the line before the marker is a whole line of the full map.
    const lines = text.trimEnd().split("\n");
    expect(codeMap(dir).text.split("\n")).toContain(lines[lines.length - 2]);
  });

  it("leaves output within the budget alone", () => {
    const { text, truncated } = codeMap(bookFixture(), { budget: 5000 });
    expect(truncated).toBe(false);
    expect(text).not.toContain(TRUNCATED);
  });
});
