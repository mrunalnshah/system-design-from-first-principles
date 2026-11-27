/**
 * Redirects from old addresses (REQ-BOOK-007, contracts/routes.md "redirect"): a chapter or article whose slug
 * changed lists its old slugs in `moved_from`, and each old address gets a small page that sends the reader on to
 * the current one. GitHub Pages can't answer 301, so the page does it (RedirectPage.astro: meta refresh, a visible
 * link, a canonical link, `noindex`, and so it's left out of the sitemap).
 *
 * The clash rule lives here too: an old slug can't also be a live slug of the same kind, or another entry's old
 * slug (E-REDIRECT-CLASH, contracts/build-messages.md), or one address would mean two pages. Chapters and articles
 * have addresses of their own (`book/…`, `articles/…`), so a chapter's old slug never clashes with an article.
 */
import type { BuildIssue } from "./issues.ts";
import type { Route } from "./url.ts";

/** What a redirect needs from a chapter or article: its kind, current slug, old slugs and file (for messages). */
export type RedirectSource = {
  kind: "chapter" | "article";
  slug: string;
  movedFrom: readonly string[];
  sourcePath: string;
};
type EntryRoute = Extract<Route, { kind: "chapter" | "article" }>;
export type Redirect = { from: EntryRoute; to: EntryRoute };

/**
 * One redirect per old slug of each entry: `from` its old address `to` its current one. `entries` are the published
 * chapters and articles. An old slug that clashes is left out (the build stops with E-REDIRECT-CLASH from
 * `redirectClashes`), so the site never has two pages at one address.
 */
export function redirectsFor(entries: readonly RedirectSource[]): Redirect[] {
  const taken = new Set(entries.map((e) => key(e.kind, e.slug)));
  const redirects: Redirect[] = [];
  for (const e of entries)
    for (const old of e.movedFrom) {
      if (taken.has(key(e.kind, old))) continue;
      taken.add(key(e.kind, old));
      redirects.push({ from: { kind: e.kind, slug: old }, to: { kind: e.kind, slug: e.slug } });
    }
  return redirects;
}

/** E-REDIRECT-CLASH for each old slug that's also a live slug, or another entry's old slug, naming both files. */
export function redirectClashes(entries: readonly RedirectSource[]): BuildIssue[] {
  const live = new Map(entries.map((e) => [key(e.kind, e.slug), e]));
  const claimed = new Map<string, RedirectSource>();
  const issues: BuildIssue[] = [];
  for (const e of entries)
    for (const old of e.movedFrom) {
      const k = key(e.kind, old);
      const other = live.get(k) ?? claimed.get(k);
      if (!other) {
        claimed.set(k, e);
        continue;
      }
      const why = live.has(k)
        ? other === e
          ? `lists its own slug "${old}" in moved_from`
          : `lists "${old}" in moved_from, but that's the address of ${other.sourcePath}`
        : `lists "${old}" in moved_from, and so does ${other.sourcePath}`;

      issues.push({
        severity: "error",
        code: "E-REDIRECT-CLASH",
        file: e.sourcePath,
        message: `${e.sourcePath} ${why}, so the old address ${e.kind === "chapter" ? "book" : "articles"}/${old}/ would lead to two pages.`,
        fix:
          other === e
            ? `Remove it from moved_from in ${e.sourcePath}.`
            : `Remove it from moved_from in one of: ${e.sourcePath}, ${other.sourcePath}.`,
      });
    }
  return issues;
}

const key = (kind: string, slug: string) => `${kind}/${slug}`;
