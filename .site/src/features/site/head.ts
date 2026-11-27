/**
 * Every page's `<head>` metadata (REQ-SITE-005, security.md B4): the title ("<Page> · <Book>"), the description,
 * the canonical address, Open Graph tags for link previews, and the Content-Security-Policy meta tag. Pages with no
 * address of their own (404, redirects) get `noindex` instead of a canonical address.
 */
import { absoluteUrl, type Route } from "./url.ts";

/** What a page says about itself. `book` is the book's title from book.md. */
export type PageHead = { title: string; description: string; route?: Route; ogImage?: string; book: string; type?: "website" | "article" };

/** One tag for the head: a `<title>`, `<meta>` or `<link>` with its attributes. */
export type HeadTag = { tag: "title"; text: string } | { tag: "meta" | "link"; attrs: Record<string, string> };

/**
 * The page's policy (security.md B4): only this site's own scripts, styles, images and fonts; inline styles are
 * allowed for KaTeX's and the figures' style attributes (ADR-0008), inline scripts never.
 */
export const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

/** The full title: "<Page> · <Book>", or just the book's title on a page named after it. */
export function pageTitle(title: string, book: string): string {
  return title === book ? book : `${title} · ${book}`;
}

/** The head tags for a page, in the order they're written. */
export function headTags(page: PageHead): HeadTag[] {
  const title = pageTitle(page.title, page.book);
  const canonical = page.route ? absoluteUrl(page.route) : undefined;
  const tags: HeadTag[] = [
    { tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP } },
    { tag: "title", text: title },
    // No icon yet: an empty one, so browsers don't ask the host's root for /favicon.ico, which on GitHub Pages
    // belongs to another site (a 404 in every page's console). The CSP allows data: images.
    { tag: "link", attrs: { rel: "icon", href: "data:," } },
    { tag: "meta", attrs: { name: "description", content: page.description } },
    canonical ? { tag: "link", attrs: { rel: "canonical", href: canonical } } : { tag: "meta", attrs: { name: "robots", content: "noindex" } },
    { tag: "meta", attrs: { property: "og:site_name", content: page.book } },
    { tag: "meta", attrs: { property: "og:title", content: title } },
    { tag: "meta", attrs: { property: "og:description", content: page.description } },
    { tag: "meta", attrs: { property: "og:type", content: page.type ?? "website" } },
  ];
  if (canonical) tags.push({ tag: "meta", attrs: { property: "og:url", content: canonical } });
  if (page.ogImage) tags.push({ tag: "meta", attrs: { property: "og:image", content: absoluteUrl({ kind: "asset", path: page.ogImage }) } });
  return tags;
}
