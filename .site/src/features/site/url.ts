/**
 * The only way to build an internal address (ADR-0007, specs/contracts/routes.md).
 *
 * Every page lives under the site's base path (`/system-design-from-first-principles/` on GitHub
 * Pages, CNF-003). Building addresses here, never by hand, means moving to a custom domain later
 * changes one setting in astro.config.ts and nothing else (REQ-SITE-013).
 */

/** Every kind of internal address. Pages end in `/`; assets keep their file name. */
export type Route =
  | { kind: "home" }
  | { kind: "contents" }
  | { kind: "chapter"; slug: string }
  | { kind: "articles" }
  | { kind: "article"; slug: string }
  | { kind: "about" }
  | { kind: "asset"; path: string };

/** A URL builder bound to one base path and one site origin. */
export type UrlBuilder = { url(route: Route): string; absoluteUrl(route: Route): string };

/**
 * Makes a builder for `base` (e.g. `/system-design-from-first-principles/`, or `/` on a custom
 * domain) and `site` (the origin, e.g. `https://mrunalnshah.github.io`). Slugs must be lowercase
 * words joined by `-`; anything else is a programmer error and throws.
 */
export function makeUrlBuilder(base: string, site: string): UrlBuilder {
  const prefix = "/" + base.replace(/^\/+|\/+$/g, "") + (base.replace(/\//g, "") ? "/" : "");
  const origin = site.replace(/\/+$/, "");
  const url = (route: Route): string => prefix + pathOf(route);
  return { url, absoluteUrl: (route) => origin + url(route) };
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ASSET = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[\w.\-/]+$/;

/** The address after the base path, from the route table in specs/contracts/routes.md. */
function pathOf(route: Route): string {
  switch (route.kind) {
    case "home": return "";
    case "contents": return "book/";
    case "chapter": return `book/${slug(route.slug)}/`;
    case "articles": return "articles/";
    case "article": return `articles/${slug(route.slug)}/`;
    case "about": return "about/";
    case "asset":
      if (!ASSET.test(route.path)) throw new Error(`Invalid asset path "${route.path}": it must be relative to the base path, with no leading "/" and no "..".`);
      return route.path;
  }
}

function slug(s: string): string {
  if (!SLUG.test(s)) throw new Error(`Invalid slug "${s}": slugs are lowercase words joined by "-" (from the file name, REQ-BOOK-002).`);
  return s;
}

const built = makeUrlBuilder(import.meta.env.BASE_URL, import.meta.env.SITE ?? "");

/** The site-relative address of `route`, base path included. */
export const url = (route: Route): string => built.url(route);

/** The full address of `route` (site origin + base path), for canonical links and sharing. */
export const absoluteUrl = (route: Route): string => built.absoluteUrl(route);
