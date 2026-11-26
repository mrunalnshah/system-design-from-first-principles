import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readVault } from "./index.ts";
import { readFrontmatter } from "./schemas.ts";

const made: string[] = [];
const BOOK = '---\ntitle: "Fixture Book"\nauthor: "A. Writer"\nauthor_url: "https://example.com/"\n---\nPitch.\n';
/** A throwaway vault with a valid book.md plus the given files (path → text). */
function vault(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-vault-"));
  made.push(root);
  for (const [path, text] of Object.entries({ "book.md": BOOK, ...files })) {
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
    expect([...v.articles, ...v.chapters, ...v.pages].map((e) => e.sourcePath)).toEqual(["articles/live.md"]);
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
    expect(lone.issues.map((i) => i.message)).toEqual(["epigraph is missing; it must be the quote itself (up to 400 characters)."]);
  });

  it("keeps the frontmatter's lines blank even when the YAML is invalid, so later line numbers still match", () => {
    const { body } = readFrontmatter("---\ntitle: a\nfoo bar\n---\nFirst.\n", "c.md", "chapter");
    expect(body.split("\n").indexOf("First.")).toBe(4);
  });
});
