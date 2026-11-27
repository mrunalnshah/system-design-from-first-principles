import { describe, expect, it } from "vitest";
import { redirectClashes, redirectsFor, type RedirectSource } from "./redirects.ts";
import { makeUrlBuilder } from "./url.ts";

const chapter = (
  slug: string,
  movedFrom: string[],
  sourcePath = `part-1_foundations/chapter-1_${slug}.md`,
): RedirectSource => ({ kind: "chapter", slug, movedFrom, sourcePath });
const article = (slug: string, movedFrom: string[]): RedirectSource => ({
  kind: "article",
  slug,
  movedFrom,
  sourcePath: `articles/${slug}.md`,
});
const { url } = makeUrlBuilder("/system-design-from-first-principles/", "https://mrunalnshah.github.io");

describe("redirect pages", () => {
  // @req REQ-BOOK-007.AC1
  it("sends book/computer-architecture/ to book/how-computers-work/ for chapter-1_how-computers-work.md moved from computer-architecture", () => {
    const [redirect, ...rest] = redirectsFor([chapter("how-computers-work", ["computer-architecture"])]);
    expect(rest).toEqual([]);
    expect([url(redirect!.from), url(redirect!.to)]).toEqual([
      "/system-design-from-first-principles/book/computer-architecture/",
      "/system-design-from-first-principles/book/how-computers-work/",
    ]);
  });

  // @req REQ-BOOK-007.AC4
  it("puts an article's redirect under articles/<old-slug>/", () => {
    const [redirect] = redirectsFor([article("why-caches", ["caches"])]);
    expect([url(redirect!.from), url(redirect!.to)]).toEqual([
      "/system-design-from-first-principles/articles/caches/",
      "/system-design-from-first-principles/articles/why-caches/",
    ]);
  });

  it("makes one page per old slug, and none for an old slug that clashes", () => {
    const entries = [
      chapter("tcp", ["transmission-control", "networks-1"]),
      chapter("queues", ["tcp", "networks-1"], "part-2_networks/chapter-3_queues.md"),
      article("networks-1", []),
    ];
    // tcp is live and networks-1 is tcp's already: only tcp's two old slugs; an article's slug doesn't clash with a chapter's.
    expect(redirectsFor(entries).map((r) => `${r.from.slug}→${r.to.slug}`)).toEqual([
      "transmission-control→tcp",
      "networks-1→tcp",
    ]);
  });
});

describe("redirect clashes", () => {
  // @req REQ-BOOK-007.AC2
  it("reports E-REDIRECT-CLASH naming both files when a moved_from slug is also a live chapter's slug", () => {
    const [issue, ...rest] = redirectClashes([
      chapter("caching", []),
      chapter("memory", ["caching"], "part-1_foundations/chapter-2_memory.md"),
    ]);
    expect(rest).toEqual([]);
    expect(issue).toMatchObject({
      severity: "error",
      code: "E-REDIRECT-CLASH",
      file: "part-1_foundations/chapter-2_memory.md",
    });
    expect(issue!.fix).toBe(
      "Remove it from moved_from in one of: part-1_foundations/chapter-2_memory.md, part-1_foundations/chapter-1_caching.md.",
    );
    expect(issue!.message).toContain("book/caching/");
  });

  it("also reports an old slug two entries share, and one that's the entry's own slug, but not across chapters and articles", () => {
    const issues = redirectClashes([
      chapter("a", ["old"]),
      chapter("b", ["old"], "part-1_x/chapter-2_b.md"),
      chapter("c", ["c"], "part-1_x/chapter-3_c.md"),
      article("d", ["old"]),
    ]);
    expect(issues.map((i) => [i.file, i.fix])).toEqual([
      [
        "part-1_x/chapter-2_b.md",
        "Remove it from moved_from in one of: part-1_x/chapter-2_b.md, part-1_foundations/chapter-1_a.md.",
      ],
      ["part-1_x/chapter-3_c.md", "Remove it from moved_from in part-1_x/chapter-3_c.md."],
    ]);
  });
});
