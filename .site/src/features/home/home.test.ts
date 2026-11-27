import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { describe, expect, it } from "vitest";
import type { Book } from "../content/index.ts";
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
  chapters: [{ slug: "computer-architecture", number: 1, title: "Computer Architecture", readingMinutes: 4 }],
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
