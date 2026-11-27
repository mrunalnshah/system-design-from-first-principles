import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { bookOf, buildVault, type ArticleData, type Book, type BookData, type ChapterData } from "../content/index.ts";
import { selectFeaturedChapters, selectLatestArticles } from "./select.ts";

/** Chapter n of the book (part 1 for 1–4, part 2 after), featured when listed. */
function chapter(n: number, featured = false): ChapterData {
  const part = n <= 4 ? 1 : 2;
  return {
    kind: "chapter",
    slug: `chapter-${n}`,
    title: `Chapter ${n}`,
    number: n,
    part: { number: part, romanNumeral: part === 1 ? "I" : "II", title: "Part", slug: "part" },
    featured,
    summary: "",
    readingMinutes: 1,
  } as ChapterData;
}

function bookWith(chapters: ChapterData[]): Book {
  return bookOf({ title: "Book" } as BookData, chapters);
}

function article(slug: string, date: string | undefined, featured = false): ArticleData {
  return { kind: "article", slug, title: slug, date, featured, summary: "", readingMinutes: 1 } as ArticleData;
}

const slugs = (entries: { slug: string }[]) => entries.map((e) => e.slug);

describe("selectFeaturedChapters", () => {
  // @req REQ-HOME-002.AC1
  it("shows the featured chapters in book order: Chapters 1 and 3 give two cards, Chapter 1 first", () => {
    // Handed over out of order, to show the book's order wins.
    const featured = selectFeaturedChapters(bookWith([chapter(3, true), chapter(2), chapter(1, true)]));
    expect(featured.heading).toBe("Featured chapters");
    expect(slugs(featured.chapters)).toEqual(["chapter-1", "chapter-3"]);
  });

  // @req REQ-HOME-002.AC2
  it('shows the first three published chapters under "Start here" when no chapter is featured', () => {
    const featured = selectFeaturedChapters(bookWith([1, 2, 3, 4, 5].map((n) => chapter(n))));
    expect(featured.heading).toBe("Start here");
    expect(slugs(featured.chapters)).toEqual(["chapter-1", "chapter-2", "chapter-3"]);
  });

  // @req REQ-HOME-002.AC3
  it("shows the first 6 of 8 featured chapters, in book order", () => {
    const featured = selectFeaturedChapters(bookWith([8, 7, 6, 5, 4, 3, 2, 1].map((n) => chapter(n, true))));
    expect(featured.heading).toBe("Featured chapters");
    expect(slugs(featured.chapters)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `chapter-${n}`));
  });
});

describe("selectLatestArticles", () => {
  // @req REQ-HOME-003.AC1
  it("puts the November article before the October one", () => {
    const latest = selectLatestArticles([article("october", "2026-10-01"), article("november", "2026-11-01")]);
    expect(slugs(latest)).toEqual(["november", "october"]);
  });

  // @req REQ-HOME-003.AC2
  it("puts an older featured article first, then the rest newest first, at most 5", () => {
    const latest = selectLatestArticles([
      article("undated", undefined),
      ...[2, 3, 4, 5, 6].map((m) => article(`m${m}`, `2026-0${m}-01`)),
      article("old-but-featured", "2025-01-01", true),
    ]);
    expect(slugs(latest)).toEqual(["old-but-featured", "m6", "m5", "m4", "m3"]);
  });

  // @req REQ-HOME-003.AC3
  it("is empty when there are no published articles", () => {
    expect(selectLatestArticles([])).toEqual([]);
  });
});

describe("drafts on the homepage", () => {
  const made: string[] = [];
  afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

  // @req REQ-CNT-004.AC3
  it("leaves out a draft that is also featured, chapter or article", async () => {
    const root = mkdtempSync(join(tmpdir(), "sdfp-home-"));
    made.push(root);
    cpSync(join(import.meta.dirname, "../../../tests/fixtures/vault"), root, { recursive: true });
    // Chapter 3 is a draft in the fixture; feature it, and Chapter 1 so the featured list isn't the fallback.
    const queues = join(root, "part-2_networks/chapter-3_queues.md");
    writeFileSync(queues, readFileSync(queues, "utf8").replace("draft: true", "draft: true\nfeatured: true"));
    const architecture = join(root, "part-1_foundations/chapter-1_computer-architecture.md");
    const source = readFileSync(architecture, "utf8");
    expect(source.startsWith("---"), "fixture Chapter 1 has no frontmatter, so a new block is added").toBe(false);
    writeFileSync(architecture, `---\nfeatured: true\n---\n${source}`);
    writeFileSync(join(root, "articles/idea.md"), "---\ndraft: true\nfeatured: true\ndate: 2026-11-20\n---\nNot yet.\n");

    const vault = await buildVault({ vaultRoot: root, figures: async () => () => ({ html: "<figure></figure>", issues: [] }) });
    expect(vault.issues.filter((i) => i.severity === "error")).toEqual([]);
    const featured = selectFeaturedChapters(bookOf(vault.book!, vault.chapters));
    expect(featured.heading).toBe("Featured chapters");
    expect(slugs(featured.chapters)).toEqual(["computer-architecture"]);
    expect(slugs(selectLatestArticles(vault.articles))).toEqual(["why-caches"]);
  });
});
