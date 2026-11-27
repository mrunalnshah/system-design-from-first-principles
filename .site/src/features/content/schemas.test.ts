import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readVault } from "./index.ts";
import { readFrontmatter } from "./schemas.ts";

const made: string[] = [];
const BOOK = '---\ntitle: "Fixture Book"\nauthor: "A. Writer"\nauthor_url: "https://example.com/"\n---\nPitch.\n';
/** A throwaway vault with a valid book.md and an about.md (so no W-ABOUT-MISSING) plus the given files (path → text). */
function vault(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-vault-"));
  made.push(root);
  for (const [path, text] of Object.entries({ "book.md": BOOK, "about.md": "About me.\n", ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
afterEach(() => made.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));

const CHAPTER = "part-1_foundations/chapter-1_computer-architecture.md";

describe("frontmatter rules", () => {
  // @req REQ-CNT-007.AC1
  it("stops on invalid YAML with the file, line 3 and what to check", () => {
    const root = vault({ [CHAPTER]: '---\ntitle: "How Computers Work"\ndescription the four parts\n---\nText.\n' });
    const { issues, chapters } = readVault(root);
    expect(issues).toEqual([
      { severity: "error", code: "E-FRONTMATTER-YAML", file: CHAPTER, line: 3, message: "The frontmatter isn't valid YAML.", fix: "Check for a missing colon or quote on this line." },
    ]);
    expect(chapters.map((c) => c.title)).toEqual(["Computer Architecture"]); // keeps its place; the error stops the publish
  });

  // @req REQ-CNT-004.AC2
  it("keeps a draft article out of every list, so no page is made for it", () => {
    const root = vault({ "articles/idea.md": "---\ndraft: true\ndate: 2026-11-02\n---\nNot yet.\n", "articles/live.md": "---\ndate: 2026-11-01\n---\nLive.\n" });
    const v = readVault(root);
    expect([...v.articles, ...v.chapters, ...v.pages].map((e) => e.sourcePath)).toEqual(["articles/live.md", "about.md"]);
    expect(v.issues).toEqual([]);
  });

  // @req REQ-CNT-003.AC3
  it("publishes an undated article after the dated ones, with no date and a warning naming the file", () => {
    const root = vault({
      "articles/undated.md": "No date.\n",
      "articles/older.md": "---\ndate: 2026-10-01\n---\nOlder.\n",
      "articles/newer.md": "---\ndate: '2026-11-01'\n---\nNewer.\n",
    });
    const v = readVault(root);
    expect(v.articles.map((a) => [a.slug, a.date])).toEqual([
      ["newer", "2026-11-01"],
      ["older", "2026-10-01"],
      ["undated", undefined],
    ]);
    expect(v.issues).toEqual([expect.objectContaining({ severity: "warning", code: "W-ARTICLE-UNDATED", file: "articles/undated.md" })]);
  });

  it("leaves draft chapters and a draft About page out, but still checks their chapter numbers", () => {
    const root = vault({ [CHAPTER]: "---\ndraft: true\n---\nX.\n", "part-1_foundations/chapter-2_memory.md": "Y.\n", "about.md": "---\ndraft: true\n---\nZ.\n" });
    const v = readVault(root);
    expect(v.chapters.map((c) => c.number)).toEqual([2]);
    expect(v.parts[0]!.chapters.map((c) => c.number)).toEqual([2]);
    expect(v.pages).toEqual([]);
    const clash = vault({ [CHAPTER]: "---\ndraft: true\n---\nX.\n", "part-2_networks/chapter-1_tcp.md": "Y.\n" });
    expect(readVault(clash).issues.map((i) => i.code)).toEqual(["E-CHAPTER-DUPLICATE"]);
  });

  it("names the field and its line for a wrong value, and goes on without it", () => {
    const text = "---\ntitle: X\nfeatured: yes please\ndate: 2026-13-01\nmoved_from: [Old Name]\n---\nBody.\n";
    const { data, issues } = readFrontmatter(text, "articles/a.md", "article");
    expect(issues.map((i) => [i.code, i.line, i.message])).toEqual([
      ["E-FRONTMATTER-FIELD", 3, "featured must be true or false."],
      ["E-FRONTMATTER-FIELD", 4, "date must be a real date written yyyy-mm-dd."],
      ["E-FRONTMATTER-FIELD", 5, "moved_from must be a list of different old slugs (lowercase words joined by -)."],
    ]);
    expect(issues[0]!.fix).toBe("Change featured to true or false, e.g. featured: true");
    expect(data).toMatchObject({ title: "X", featured: false, draft: false, moved_from: [] });
  });

  it("accepts dates written with or without quotes, ignores unknown keys, and needs epigraph for epigraph_source", () => {
    expect(readFrontmatter("---\ndate: 2026-11-01\ntags: [a]\n---\n", "a.md", "article").data).toMatchObject({ date: "2026-11-01", tags: ["a"] });
    expect(readFrontmatter('---\ndate: "2026-02-29"\n---\n', "a.md", "article").issues.map((i) => i.code)).toEqual(["E-FRONTMATTER-FIELD"]);
    const lone = readFrontmatter('---\nepigraph_source: "Anonymous"\n---\n', "c.md", "chapter");
    expect(lone.issues.map((i) => [i.line, i.message])).toEqual([[2, "epigraph_source needs an epigraph."]]);
    expect(lone.issues[0]!.fix).toMatch(/^Change epigraph_source to nothing \(remove it\), or add the quote/);
  });

  it("reports epigraph_source without an epigraph through the scan, instead of stopping with a crash", () => {
    const root = vault({ [CHAPTER]: '---\nepigraph_source: "Anonymous"\n---\nText.\n' });
    const v = readVault(root);
    expect(v.issues.map((i) => [i.code, i.file, i.line])).toEqual([["E-FRONTMATTER-FIELD", CHAPTER, 2]]);
    expect(v.chapters.map((c) => c.title)).toEqual(["Computer Architecture"]);
  });

  it("gives one message per problem: an article with a broken date isn't also called undated", () => {
    const root = vault({ "articles/a.md": "---\ndate: someday\n---\nA.\n", "articles/b.md": "---\ndate: [\n---\nB.\n" });
    expect(readVault(root).issues.map((i) => [i.code, i.file])).toEqual([
      ["E-FRONTMATTER-FIELD", "articles/a.md"],
      ["E-FRONTMATTER-YAML", "articles/b.md"],
    ]);
  });

  it("finds fields only inside the frontmatter, never in a --- rule further down the body", () => {
    const { issues } = readFrontmatter("Intro text.\n\n---\ntitle: T\n---\n", "book.md", "book");
    expect(issues.map((i) => [i.message, i.line])).toEqual([
      ["title is missing; it must be the book's title.", undefined],
      ["author is missing; it must be your name as readers should see it.", undefined],
      ["author_url is missing; it must be an https:// address.", undefined],
    ]);
  });

  it("says when frontmatter is a list or a lone value, or has a field twice; a comment-only block is fine", () => {
    expect(readFrontmatter("---\n- a\n- b\n---\n", "c.md", "chapter").issues.map((i) => [i.code, i.line, i.message])).toEqual([
      ["E-FRONTMATTER-YAML", 2, "The frontmatter isn't a set of fields (each line should be field: value)."],
    ]);
    expect(readFrontmatter("---\njust words\n---\n", "c.md", "chapter").issues.map((i) => i.line)).toEqual([2]);
    expect(readFrontmatter("---\ntitle: a\ntitle: b\n---\n", "c.md", "chapter").issues.map((i) => i.message)).toEqual(["The frontmatter has the same field twice."]);
    expect(readFrontmatter("---\n# just a note\n---\nText.\n", "c.md", "chapter").issues).toEqual([]);
  });

  it("counts lines from the real fence when the file starts with a BOM or blank lines, or uses CRLF", () => {
    const { issues } = readFrontmatter("\ufeff\r\n\r\n---\r\ntitle: a\r\nfoo bar\r\n---\r\n", "c.md", "chapter");
    expect(issues.map((i) => i.line)).toEqual([5]);
  });

  it("keeps the frontmatter's lines blank even when the YAML is invalid, so later line numbers still match", () => {
    const { body } = readFrontmatter("---\ntitle: a\nfoo bar\n---\nFirst.\n", "c.md", "chapter");
    expect(body.split("\n").indexOf("First.")).toBe(4);
  });
});
