/**
 * Which built pages the sitemap lists (REQ-SITE-005, REQ-BOOK-007.AC3): every page except those that ask not to be
 * indexed. A page with no address of its own (the 404, a redirect from an old address) gets
 * `<meta name="robots" content="noindex">` from head.ts, so this one rule keeps all of them out, whichever kind of
 * page comes next. Used by astro.config.ts, which imports this file directly (it can't load the .astro components
 * site/index.ts exports while it's still reading its config).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** head.ts's tag: it always writes `name` before `content`. */
const NOINDEX = /<meta\s+name="robots"\s+content="[^"]*\bnoindex\b/i;

/**
 * A sitemap filter for the built site: `built` holds its output folder and base path, read when the filter runs
 * (Astro settles them, `--outDir` included, only once the config is done). `page` is a page's full address, e.g.
 * `https://mrunalnshah.github.io/system-design-from-first-principles/book/x/`.
 */
export function indexablePages(built: { outDir: string; base: string }): (page: string) => boolean {
  return (page) => {
    const path = new URL(page).pathname;
    const base = "/" + built.base.replace(/^\/+|\/+$/g, "") + "/";
    const inSite = path.startsWith(base) ? path.slice(base.length) : path.replace(/^\//, "");
    const file = join(built.outDir, inSite, "index.html");
    // A page the build didn't write as <path>/index.html (none today) is listed as before.
    if (!existsSync(file)) return true;
    // Only the head: an article that quotes the tag in its text must still be listed.
    const html = readFileSync(file, "utf8");
    return !NOINDEX.test(html.slice(0, Math.max(0, html.indexOf("</head>"))));
  };
}
