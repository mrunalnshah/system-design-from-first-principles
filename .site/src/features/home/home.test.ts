import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { ArticleData, Book } from "../content/index.ts";
import { HomePage } from "./index.ts";

/** A one-chapter book as MOD-vault hands it over, without hero_image. */
const book = {
  settings: {
    title: "System Design from First Principles",
    author: "Mrunal Nirajkumar Shah",
    authorUrl: "https://example.com/",
    pitchMarkdown: "Pitch.",
    pitchHtml: "<p>Pitch.</p>",
  },
  parts: [],
  chapters: [
    {
      slug: "computer-architecture",
      number: 1,
      title: "Computer Architecture",
      part: { number: 1, romanNumeral: "I", title: "Foundations", slug: "foundations" },
      summary: "",
      readingMinutes: 4,
    },
  ],
  totalReadingMinutes: 4,
} as unknown as Book;

describe("the homepage hero", () => {
  // @req REQ-HOME-001.AC4
  it("shows without an image, as one column, when book.md has no hero_image", async () => {
    const html = await (await AstroContainer.create()).renderToString(HomePage, { props: { book, articles: [] } });
    expect(html).toMatch(/class="hero hero--no-image"/);
    expect(html).not.toContain("hero-art");
    expect(html).not.toContain("<figure");
    expect(html).toContain(">System Design from First Principles</h1>");
    expect(html).toMatch(/href="[^"]*\/book\/computer-architecture\/"[^>]*>\s*Read from the start/);
  });
});

/** Chapter n, featured when asked, for the rendered sections below. */
function chapterOf(n: number, featured: boolean) {
  return {
    slug: `chapter-${n}`,
    number: n,
    title: `Chapter title ${n}`,
    part: { number: 1, romanNumeral: "I", title: "Foundations", slug: "foundations" },
    summary: `Summary ${n}.`,
    readingMinutes: n,
    featured,
  };
}
const withChapters = (chapters: unknown[]) => ({ ...book, chapters }) as unknown as Book;
const render = async (b: Book, articles: unknown[] = []) =>
  (await AstroContainer.create()).renderToString(HomePage, { props: { book: b, articles: articles as ArticleData[] } });
const cardTitles = (html: string) => [...html.matchAll(/class="card-title"[^>]*>\s*<a[^>]*>(?:<span[^>]*>[^<]*<\/span>)?([^<]+)</g)].map((m) => m[1]);

describe("the featured chapters section", () => {
  // @req REQ-HOME-002.AC1
  it("shows Chapters 1 and 3, the featured ones, as two cards with number, part, title, summary and time", async () => {
    const html = await render(withChapters([1, 2, 3].map((n) => chapterOf(n, n !== 2))));
    expect(html).toMatch(/<h2[^>]*>Featured chapters<\/h2>/);
    expect(cardTitles(html)).toEqual(["Chapter title 1", "Chapter title 3"]);
    expect(html).toMatch(/href="[^"]*\/book\/chapter-1\/"/);
    expect(html).toContain("Part I · Foundations");
    expect(html).toContain("Summary 3.");
    expect(html).toContain("3 min read");
  });

  // @req REQ-HOME-002.AC2
  it('is titled "Start here" and shows the first three chapters when none is featured', async () => {
    const html = await render(withChapters([1, 2, 3, 4].map((n) => chapterOf(n, false))));
    expect(html).toMatch(/<h2[^>]*>Start here<\/h2>/);
    expect(html).not.toContain("Featured chapters");
    expect(cardTitles(html)).toEqual(["Chapter title 1", "Chapter title 2", "Chapter title 3"]);
  });

  // @req REQ-HOME-002.AC3
  it('shows 6 of 8 featured chapters, with an "All chapters" link to the contents page', async () => {
    const html = await render(withChapters([1, 2, 3, 4, 5, 6, 7, 8].map((n) => chapterOf(n, true))));
    expect(cardTitles(html)).toEqual([1, 2, 3, 4, 5, 6].map((n) => `Chapter title ${n}`));
    expect(html).toMatch(/href="[^"]*\/book\/"[^>]*>\s*All chapters →/);
  });
});

describe("the latest articles section", () => {
  const articleOf = (slug: string, date: string, featured = false) => ({
    slug,
    title: `Title ${slug}`,
    date,
    featured,
    summary: `About ${slug}.`,
    readingMinutes: 6,
  });

  // @req REQ-HOME-003.AC1
  it("lists the November article first, with its date, summary, reading time and an All articles link", async () => {
    const html = await render(withChapters([chapterOf(1, false)]), [articleOf("oct", "2026-10-01"), articleOf("nov", "2026-11-01")]);
    expect(html).toMatch(/<h2[^>]*>Latest articles<\/h2>/);
    expect(html.indexOf("Title nov")).toBeLessThan(html.indexOf("Title oct"));
    expect(html).toMatch(/<time datetime="2026-11-01"[^>]*>1 November 2026<\/time>/);
    expect(html).toContain("About nov.");
    expect(html).toContain("6 min read");
    expect(html).toMatch(/href="[^"]*\/articles\/nov\/"/);
    expect(html).toMatch(/href="[^"]*\/articles\/"[^>]*>\s*All articles →/);
  });

  // @req REQ-HOME-003.AC2
  it('puts an older featured article first, marked "Featured"', async () => {
    const html = await render(withChapters([chapterOf(1, false)]), [articleOf("new", "2026-11-01"), articleOf("old", "2026-01-01", true)]);
    expect(html.indexOf("Title old")).toBeLessThan(html.indexOf("Title new"));
    expect(html.match(/>Featured</g)).toHaveLength(1);
    expect(html).toMatch(/Title old<\/a>\s*<span class="tag"[^>]*>Featured</);
  });

  // @req REQ-HOME-003.AC3
  it("is left out, link and all, when there are no published articles", async () => {
    const html = await render(withChapters([chapterOf(1, false)]), []);
    expect(html).not.toContain("Latest articles");
    expect(html).not.toContain("All articles");
    expect(html).not.toMatch(/\/articles\//);
  });
});
