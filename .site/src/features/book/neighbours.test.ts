import { join } from "node:path";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { afterAll, describe, expect, it } from "vitest";
import type { Book } from "../content/index.ts";
import { neighbours, PrevNext } from "./index.ts";
import { bookFrom, cleanUp, fixture, setDraft, vaultCopy } from "./test-vault.ts";

afterAll(cleanUp);

async function prevNext(book: Book, slug: string): Promise<string> {
  const container = await AstroContainer.create();
  return container.renderToString(PrevNext, { props: { book, slug } });
}

/** The visible text of each link in the rendered component, with its address and rel. */
const links = (html: string) =>
  [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(([, attrs, inner]) => ({
    href: /href="([^"]*)"/.exec(attrs!)![1]!,
    rel: /rel="([^"]*)"/.exec(attrs!)?.[1],
    text: inner!
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  }));

describe("previous and next", () => {
  // @req REQ-BOOK-003.AC1
  it("goes from the last chapter of Part I to the first of Part II", async () => {
    const book = await bookFrom(fixture);
    expect(book.parts.map((p) => p.chapters.map((c) => c.slug))).toEqual([["computer-architecture"], ["tcp"]]);
    expect(neighbours(book, "computer-architecture").next?.slug).toBe("tcp");
    const next = links(await prevNext(book, "computer-architecture")).find((l) => l.rel === "next")!;
    expect(next.text).toBe("Next → 2 · Tcp");
    expect(next.href).toMatch(/\/book\/tcp\/$/);
  });

  // @req REQ-BOOK-003.AC2
  it("puts Contents where Previous would be on the first chapter", async () => {
    const book = await bookFrom(fixture);
    expect(neighbours(book, "computer-architecture").previous).toBeUndefined();
    const html = await prevNext(book, "computer-architecture");
    expect(html).toContain('aria-label="Chapter navigation"');
    expect(links(html).some((l) => l.rel === "prev")).toBe(false);
    const first = links(html)[0]!;
    expect(first.text).toBe("← Start Contents");
    expect(first.href).toMatch(/\/book\/$/);
  });

  // @req REQ-BOOK-003.AC3
  it("replaces Next with Back to contents on the last chapter", async () => {
    const book = await bookFrom(fixture);
    expect(neighbours(book, "tcp")).toEqual({ previous: expect.objectContaining({ slug: "computer-architecture" }) });
    const html = await prevNext(book, "tcp");
    expect(links(html).some((l) => l.rel === "next")).toBe(false);
    const [previous, last] = links(html);
    expect(previous).toEqual({
      href: expect.stringMatching(/\/book\/computer-architecture\/$/),
      rel: "prev",
      text: "← Previous 1 · Computer Architecture",
    });
    expect(last!.text).toBe("The end, for now Back to contents →");
    expect(last!.href).toMatch(/\/book\/$/);
  });

  // @req REQ-CNT-004.AC1
  it("skips a draft: with Chapter 2 a draft, Chapter 1's Next is Chapter 3", async () => {
    const root = vaultCopy((r) => {
      setDraft(join(r, "part-2_networks/chapter-2_tcp.md"), true);
      setDraft(join(r, "part-2_networks/chapter-3_queues.md"), false);
    });
    const book = await bookFrom(root);
    expect(book.chapters.map((c) => c.number)).toEqual([1, 3]);
    expect(neighbours(book, "computer-architecture").next?.slug).toBe("queues");
    const next = links(await prevNext(book, "computer-architecture")).find((l) => l.rel === "next")!;
    expect(next.href).toMatch(/\/book\/queues\/$/);
    expect(next.text).toMatch(/^Next → 3 · /);
  });

  it("knows nothing either side of a chapter that isn't in the book", async () => {
    expect(neighbours(await bookFrom(fixture), "not-a-chapter")).toEqual({});
  });

  it("never lists an article (REQ-ART-003)", async () => {
    const book = await bookFrom(fixture);
    expect(book.chapters.map((c) => c.kind)).toEqual(["chapter", "chapter"]);
    expect(neighbours(book, "why-caches")).toEqual({});
  });
});
