import { describe, expect, it } from "vitest";
import { CSP, headTags, pageTitle } from "./head.ts";

const BOOK = "System Design from First Principles";

describe("head tags", () => {
  // @req REQ-SITE-005.AC1
  it("titles Chapter 1 'Computer Architecture · System Design from First Principles'", () => {
    expect(pageTitle("Computer Architecture", BOOK)).toBe("Computer Architecture · System Design from First Principles");
    expect(pageTitle(BOOK, BOOK)).toBe(BOOK);
  });

  it("gives a page its description, canonical address, Open Graph tags and the CSP", () => {
    const tags = headTags({ title: "Computer Architecture", description: "How computers work.", route: { kind: "chapter", slug: "computer-architecture" }, book: BOOK, type: "article" });
    const meta = (k: string) => tags.find((t) => t.tag !== "title" && Object.values(t.attrs).includes(k)) as { attrs: Record<string, string> } | undefined;
    expect(tags[0]).toEqual({ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP } });
    // The base path is the build's (url.test.ts checks it); here only the shape matters.
    expect(meta("canonical")?.attrs.href).toMatch(/^https:\/\/mrunalnshah\.github\.io\/(.+\/)?book\/computer-architecture\/$/);
    expect(meta("og:type")?.attrs.content).toBe("article");
    expect(meta("og:url")?.attrs.content).toBe(meta("canonical")?.attrs.href);
    expect(meta("description")?.attrs.content).toBe("How computers work.");
  });

  it("keeps pages without an address of their own out of search results", () => {
    const tags = headTags({ title: "Page not found", description: "x", book: BOOK });
    expect(tags).toContainEqual({ tag: "meta", attrs: { name: "robots", content: "noindex" } });
    expect(tags.some((t) => t.tag === "link")).toBe(false);
  });

  it("allows only the site's own scripts, and inline styles for KaTeX and figures (security.md B4)", () => {
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(CSP).toContain("style-src 'self' 'unsafe-inline'");
  });
});
