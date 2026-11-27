import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFixtureSite } from "../../../tests/build-site.ts";
import { cleanUp, tempFolder } from "../../../tools/test-site.ts";
import { BUDGET, measureSite } from "../../../tools/size.ts";
import type { ArticleData } from "../content/index.ts";
import ArticlesArchive from "./ArticlesArchive.astro";
import { groupByYear, UNDATED } from "./group.ts";

/** An article as MOD-vault hands it over; only what the archive reads. */
function articleOf(slug: string, date?: string): ArticleData {
  return {
    kind: "article",
    slug,
    title: `Title ${slug}`,
    summary: `Summary of ${slug}.`,
    readingMinutes: 3,
    featured: false,
    ...(date ? { date } : {}),
  } as ArticleData;
}
const render = async (
  articles: ArticleData[],
  start = "/system-design-from-first-principles/book/computer-architecture/",
) => (await AstroContainer.create()).renderToString(ArticlesArchive, { props: { articles, start } });
const yearHeadings = (html: string) => [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map((m) => m[1]);

describe("the archive's year groups", () => {
  // @req REQ-ART-002.AC1
  it("puts a 2026 group before 2025, newest first inside each, and undated articles last", async () => {
    const articles = [
      articleOf("old", "2025-03-01"),
      articleOf("undated"),
      articleOf("new", "2026-11-01"),
      articleOf("mid", "2026-02-10"),
      { ...articleOf("star", "2025-12-31"), featured: true },
    ];
    const groups = groupByYear(articles);
    expect(groups.map((g) => g.label)).toEqual(["2026", "2025", UNDATED]);
    expect(groups.map((g) => g.articles.map((a) => a.slug))).toEqual([["new", "mid"], ["star", "old"], ["undated"]]);
    // The page shows them in that order, each year an h2 over its rows.
    const html = await render(articles);
    expect(yearHeadings(html)).toEqual(["2026", "2025", "Undated"]);
    expect([...html.matchAll(/class="row-title"[^>]*>\s*<a[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual([
      "Title new",
      "Title mid",
      "Title star",
      "Title old",
      "Title undated",
    ]);
  });

  it("orders articles on the same day by slug, so the file system never decides", () => {
    expect(
      groupByYear([articleOf("b", "2026-01-01"), articleOf("a", "2026-01-01")])[0]!.articles.map((a) => a.slug),
    ).toEqual(["a", "b"]);
  });
});

describe("the empty archive", () => {
  // @req REQ-ART-002.AC2
  it('says "No articles yet. Start with the book." with a link to Chapter 1', async () => {
    // Without a start, the link goes to the contents page (a book with no published chapter yet; the container's base is /).
    expect(await (await AstroContainer.create()).renderToString(ArticlesArchive, { props: { articles: [] } })).toMatch(
      /<a href="[^"]*\/book\/"[^>]*>Start with the book<\/a>/,
    );
    const html = await render([]);
    expect(groupByYear([])).toEqual([]);
    expect(html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ")).toContain("No articles yet. Start with the book.");
    expect(html).toMatch(
      /<a href="\/system-design-from-first-principles\/book\/computer-architecture\/"[^>]*>Start with the book<\/a>/,
    );
    expect(html).not.toContain("<h2");
  });
});

describe("an archive of 200 articles", () => {
  const BASE = "/system-design-from-first-principles/";
  let dist: string;
  beforeAll(() => {
    // The fixture vault plus 200 dated articles (about 18 a year since 2016), each with a full-length description.
    const vault = tempFolder("sdfp-archive-vault-");
    cpSync(join(import.meta.dirname, "../../../tests/fixtures/vault"), vault, { recursive: true });
    for (let i = 1; i <= 200; i++) {
      const date = `${2026 - Math.floor((i - 1) / 18)}-${String(((i - 1) % 12) + 1).padStart(2, "0")}-${String(((i * 7) % 28) + 1).padStart(2, "0")}`;
      const description = `Essay ${i} on how a system behaves under load, why the slow part is rarely where you first look, and what to measure first.`;
      writeFileSync(
        join(vault, "articles", `essay-${i}.md`),
        `---\ntitle: "Essay number ${i} on systems"\ndate: ${date}\ndescription: "${description}"\n---\n${"A paragraph of the essay. ".repeat(80)}\n`,
      );
    }
    dist = tempFolder("sdfp-archive-site-");
    buildFixtureSite(dist, undefined, vault);
  }, 240_000);
  afterAll(cleanUp);

  // @req REQ-ART-002.AC3
  it("lists all of them on one page, within the NFR-002 budget", () => {
    const html = readFileSync(join(dist, "articles", "index.html"), "utf8");
    // 200 plus the fixture's own article, all on articles/: no second page.
    expect(html.match(/class="row-title"/g)).toHaveLength(201);
    expect(html).not.toMatch(/articles\/(page\/)?2\//);
    expect([existsSync(join(dist, "articles", "2")), existsSync(join(dist, "articles", "page"))]).toEqual([
      false,
      false,
    ]);
    const page = measureSite(dist, BASE).pages.find((p) => p.page === "articles/")!;
    expect(
      page.html + page.css + page.fonts,
      `articles/: ${page.html} B HTML, ${page.css} B CSS, ${page.fonts} B fonts`,
    ).toBeLessThanOrEqual(BUDGET.htmlCssFonts);
    expect(page.js).toBeLessThanOrEqual(BUDGET.js);
  });
});
