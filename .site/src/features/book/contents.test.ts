import { copyFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterAll, describe, expect, it } from "vitest";
import type { Book } from "../content/index.ts";
import { Contents, contentsOf, firstChapter, romanNumeral } from "./index.ts";
import { bookFrom, cleanUp, fixture, setDraft, vaultCopy } from "./test-vault.ts";

afterAll(cleanUp);

/** The contents page's body for `book`, rendered as the page renders it. */
async function render(book: Book): Promise<string> {
  return (await AstroContainer.create()).renderToString(Contents, { props: { book } });
}

describe("the book's contents", () => {
  // @req REQ-BOOK-004.AC1
  it("reads part-2_networks/chapter-5_tcp.md as Chapter 5 in Part II", async () => {
    const root = vaultCopy((r) =>
      renameSync(join(r, "part-2_networks/chapter-2_tcp.md"), join(r, "part-2_networks/chapter-5_tcp.md")),
    );
    const book = await bookFrom(root);
    const [, networks] = contentsOf(book);
    expect(networks).toMatchObject({ number: 2, romanNumeral: "II", title: "Networks" });
    expect(networks!.chapters.map((c) => [c.number, c.title])).toEqual([[5, "Tcp"]]);
    // As a reader sees it on the contents page: "II. Networks", then "5." and "Chapter 5: Tcp".
    const html = await render(book);
    expect(html).toMatch(/<span class="contents-numeral"[^>]*>II\.<\/span> Networks/);
    expect(html).toMatch(/>5\.\s*<\/span>/);
    expect(html).toMatch(/Chapter 5: <\/span>\s*Tcp/);
    // And the chapter page's own line ("Part II · Networks") uses the same numeral.
    expect(book.chapters.find((c) => c.slug === "tcp")!.part.romanNumeral).toBe("II");
  });

  it("lists parts with numerals, chapters with their reading time, and only top-level sections as sub-items", async () => {
    const [foundations] = contentsOf(await bookFrom(fixture));
    expect(foundations).toMatchObject({ romanNumeral: "I", title: "Foundations" });
    const [chapter] = foundations!.chapters;
    expect(chapter).toMatchObject({ number: 1, title: "Computer Architecture", slug: "computer-architecture" });
    expect(chapter!.readingMinutes).toBeGreaterThan(0);
    expect(chapter!.href).toMatch(/\/book\/computer-architecture\/$/);
    // "Disk", "RAM", … are the vault's `##` headings: not sub-items.
    expect(chapter!.sections.map((s) => s.text)).toEqual(["Components", "Limitations", "Moore's Law"]);
    expect(chapter!.sections[1]!.href).toMatch(/\/book\/computer-architecture\/#limitations$/);
  });

  // @req REQ-BOOK-001.AC2
  it("leaves out a part whose chapters are all drafts, on the contents page too", async () => {
    // Part II's Chapter 3 is already a draft; making Chapter 2 one leaves the part with none published.
    const root = vaultCopy((r) => setDraft(join(r, "part-2_networks/chapter-2_tcp.md"), true));
    const book = await bookFrom(root);
    expect(contentsOf(book).map((p) => p.title)).toEqual(["Foundations"]);
    const html = await render(book);
    expect(html).toContain("Foundations");
    expect(html).not.toContain("Networks");
    expect(html).not.toMatch(/II\./);
  });

  // @req REQ-ART-003.AC1
  it("lists none of three articles on the contents page", async () => {
    const root = vaultCopy((r) => {
      copyFileSync(join(r, "articles/why-caches.md"), join(r, "articles/second-article.md"));
      copyFileSync(join(r, "articles/why-caches.md"), join(r, "articles/third-article.md"));
    });
    const html = await render(await bookFrom(root));
    expect(html).not.toMatch(/why-caches|second-article|third-article|Why caches/i);
    expect(html.match(/class="contents-chapter"/g)).toHaveLength(2);
  });

  it("starts the book at its first published chapter, or nowhere when there is none", async () => {
    const book = await bookFrom(fixture);
    expect(firstChapter(book)?.slug).toBe("computer-architecture");
    expect(firstChapter({ ...book, parts: [], chapters: [] })).toBeUndefined();
  });
});

describe("Roman numerals", () => {
  it("writes part numbers the usual way", () => {
    expect([1, 2, 3, 4, 5, 9, 10, 14, 40, 90, 400, 1994, 3999].map(romanNumeral)).toEqual([
      "I",
      "II",
      "III",
      "IV",
      "V",
      "IX",
      "X",
      "XIV",
      "XL",
      "XC",
      "CD",
      "MCMXCIV",
      "MMMCMXCIX",
    ]);
  });

  it("refuses numbers it can't write", () => {
    for (const n of [0, -1, 4000, 1.5, Number.NaN]) expect(() => romanNumeral(n)).toThrow(RangeError);
  });
});
