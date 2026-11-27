import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanVault } from "./scan.ts";

const fixture = join(import.meta.dirname, "../../../tests/fixtures/vault");

const made: string[] = [];
/** An About page, for vaults whose test is about something else (with none, the scan warns: W-ABOUT-MISSING). */
const ABOUT = { "about.md": "About me.\n" };
/** A throwaway vault with the given files (path → text). */
function vault(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-vault-"));
  made.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
afterEach(() => made.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("vault scan", () => {
  // @req REQ-CNT-001.AC1
  it("lists Part 1 Foundations with Chapter 1, then Part 2 Networks with Chapter 2", () => {
    const scan = scanVault(fixture);
    expect(scan.parts.map((p) => [p.number, p.title, p.chapters.map((c) => c.number)])).toEqual([
      [1, "Foundations", [1]],
      [2, "Networks", [2]],
    ]);
    expect(scan.chapters.map((c) => c.sourcePath)).toEqual(["part-1_foundations/chapter-1_computer-architecture.md", "part-2_networks/chapter-2_tcp.md"]);
    expect(scan.chapters[1]!.part).toEqual({ number: 2, slug: "networks", title: "Networks" });
    expect(scan.issues).toEqual([]);
  });

  // @req REQ-CNT-001.AC2
  it("puts Chapter 2 before Chapter 10 (numeric, not text, order)", () => {
    const root = vault({ "part-1_a/chapter-10_x.md": "X", "part-1_a/chapter-2_y.md": "Y", "part-10_c/chapter-30_z.md": "Z", "part-2_b/chapter-20_w.md": "W" });
    const scan = scanVault(root);
    expect(scan.chapters.map((c) => c.number)).toEqual([2, 10, 20, 30]);
    expect(scan.parts.map((p) => p.number)).toEqual([1, 2, 10]);
  });

  // @req REQ-CNT-001.AC3
  it("stops with an error naming both files when two chapters share a number anywhere in the book", () => {
    const root = vault({ "part-1_a/chapter-3_x.md": "X", "part-2_b/chapter-3_y.md": "Y", ...ABOUT });
    const [issue, ...rest] = scanVault(root).issues;
    expect(rest).toEqual([]);
    expect(issue).toMatchObject({ severity: "error", code: "E-CHAPTER-DUPLICATE", file: "part-1_a/chapter-3_x.md" });
    expect(issue!.message).toContain("part-1_a/chapter-3_x.md and part-2_b/chapter-3_y.md");
    expect(issue!.fix).toBe("Renumber one of them: part-1_a/chapter-3_x.md, part-2_b/chapter-3_y.md.");
  });

  // @req REQ-CNT-002.AC1
  it("titles chapter-1_computer-architecture.md 'Computer Architecture' when it has no title", () => {
    expect(scanVault(fixture).chapters[0]!.title).toBe("Computer Architecture");
  });

  // @req REQ-CNT-002.AC2
  it("uses title: \"How Computers Work\" from the frontmatter", () => {
    const root = vault({ "part-1_foundations/chapter-1_computer-architecture.md": '---\ntitle: "How Computers Work"\n---\nText.\n' });
    expect(scanVault(root).chapters[0]!.title).toBe("How Computers Work");
  });

  // @req REQ-CNT-002.AC3
  it("titles the part folder part-1_foundations 'Foundations'", () => {
    expect(scanVault(fixture).parts[0]!.title).toBe("Foundations");
  });

  // @req REQ-CNT-003.AC1
  it("finds articles/why-caches.md as the article why-caches, and about.md as the About page", () => {
    const scan = scanVault(fixture);
    expect(scan.articles.map((a) => [a.slug, a.title, a.sourcePath])).toEqual([["why-caches", "Why Caches", "articles/why-caches.md"]]);
    expect(scan.pages.map((p) => [p.slug, p.title])).toEqual([["about", "About"]]);
  });

  // @req REQ-CNT-003.AC2
  it("publishes none of BLUEPRINT.md, .obsidian/app.json or a drawing in excalidraw/", () => {
    const root = vault({
      "BLUEPRINT.md": "# Plan",
      ".obsidian/app.json": "{}",
      "part-1_foundations/excalidraw/01_computer-architecture.excalidraw.md": "drawing",
      "part-1_foundations/chapter-1_computer-architecture.md": "Text.",
      "templates/chapter.md": "Template.",
      "book.md": "---\ntitle: X\n---\n",
      "articles/drafts/old.md": "Nested, not an article.",
      "part-1_foundations/chapter-2_x.excalidraw.md": "A drawing saved beside the chapters.",
      "articles/sketch.excalidraw.md": "A drawing saved among the articles.",
    });
    const scan = scanVault(root);
    const published = [...scan.chapters, ...scan.articles, ...scan.pages].map((e) => e.sourcePath);
    expect(published).toEqual(["part-1_foundations/chapter-1_computer-architecture.md"]);
  });

  it("keeps the frontmatter's lines blank in the body, so later line numbers match the file", () => {
    const root = vault({ "articles/a.md": "---\ndate: 2026-11-01\n---\nFirst line.\n" });
    const [a] = scanVault(root).articles;
    expect(a!.body.split("\n").indexOf("First line.")).toBe(3);
    expect(a!.frontmatter).toHaveProperty("date");
  });

  it("reports two chapters that would share an address, and a reserved slug", () => {
    const root = vault({ "part-1_a/chapter-1_caching.md": "X", "part-2_b/chapter-2_caching.md": "Y", "articles/404.md": "---\ndate: 2026-11-01\n---\nZ", ...ABOUT });
    const issues = scanVault(root).issues;
    expect(issues.map((i) => [i.code, i.file])).toEqual([
      ["E-SLUG-CLASH", "part-1_a/chapter-1_caching.md"],
      ["E-SLUG-CLASH", "articles/404.md"],
    ]);
    expect(issues[0]!.fix).toBe("Rename one file. Files: part-1_a/chapter-1_caching.md, part-2_b/chapter-2_caching.md.");
  });

  it("leaves out a part with no chapters, and an empty vault is just empty, apart from the missing About page", () => {
    expect(scanVault(vault({ "part-1_a/notes.md": "x" })).parts).toEqual([]);
    const empty = scanVault(vault({}));
    expect({ ...empty, issues: [] }).toEqual({ parts: [], chapters: [], articles: [], pages: [], issues: [] });
    expect(empty.issues.map((i) => i.code)).toEqual(["W-ABOUT-MISSING"]);
  });

  // @req REQ-SITE-003.AC2
  it("warns with W-ABOUT-MISSING when there's no about.md, and not for a draft one", () => {
    const [issue, ...rest] = scanVault(vault({ "part-1_a/chapter-1_x.md": "X" })).issues;
    expect(rest).toEqual([]);
    expect(issue).toMatchObject({ severity: "warning", code: "W-ABOUT-MISSING", file: "about.md" });
    expect(issue!.fix.startsWith("Create about.md to get an About page.")).toBe(true);
    const draft = scanVault(vault({ "about.md": "---\ndraft: true\n---\nLater.\n" }));
    expect([draft.pages, draft.issues]).toEqual([[], []]);
  });
});
