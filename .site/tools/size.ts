/**
 * TOOL-11 build-size check (plan/tools.md, NFR-002): `<tools> size [--dist DIR]`.
 * Reads the built site (`.site/dist/`) and, for every page, sums the gzip-compressed size of what that page makes the
 * browser download: the HTML itself; its stylesheets (linked and inline); the fonts those stylesheets would load; and
 * its JavaScript (module scripts, inline scripts, and every module they import, followed through the files), and
 * anything it preloads as a font, style or script. It fails
 * when a page's JavaScript is over 60 KB or its HTML, CSS and fonts together are over 250 KB, naming the page and the
 * number. It warns for each published diagram over 250 KiB (W-DIAGRAM-LARGE, the build's own threshold and message).
 *
 * Fonts are counted the way a browser picks them, so a page isn't charged for faces it never downloads:
 * for each `@font-face`, only its first source (the browser stops at the first format it supports, woff2 here),
 * only if its `unicode-range` covers some character of the page's text (or it has none), and only if the family is
 * named in a rule that can apply to the page: a rule whose selector's classes all appear on the page (KaTeX's faces
 * count only on pages with that kind of math). A bold or italic face also needs such a rule to ask for its weight or
 * style along with its family, or, for the page's base fonts (named by rules without classes), an element the browser
 * sets bold (strong, b, h1–h6, th) or italic (em, i, cite, dfn, var) on the page. Typeset math is left out of the
 * page's text (KaTeX sets it in its own faces). Element and unknown selectors count as applying, so it mostly errs
 * on the heavy side: Chapter 1 measures about 40 KB more than Chromium downloads (the code font, for no code).
 * It can under-count a face that only a class added by a script, or an inherited weight, would ask for.
 * KB means 1000 bytes for the NFR-002 budgets (the stricter reading); the diagram warning uses the build's KiB.
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { allFiles, htmlFiles, pageName, rel } from "./dist.ts";

/** NFR-002's budgets, in compressed bytes. */
/** `svg` is raw bytes, the same 250 KiB as the build's W-DIAGRAM-LARGE (features/diagrams/pairs.ts LARGE_BYTES). */
export const BUDGET = { js: 60_000, htmlCssFonts: 250_000, svg: 250 * 1024 };

/** What one page downloads, compressed, in bytes. */
export type PageSize = { page: string; html: number; css: number; fonts: number; js: number; files: string[] };

export type SizeReport = { pages: PageSize[]; errors: string[]; warnings: string[] };

/** Measures every page in `dist`, whose addresses all start with `base` (e.g. "/system-design-from-first-principles/"). */
export function measureSite(dist: string, base: string): SizeReport {
  if (!existsSync(dist)) throw new Error(`No built site at ${dist}. Run \`npm --prefix .site run build\` first.`);
  const gz = gzipCache();
  const pages = htmlFiles(dist).map((file) => measurePage(dist, base, file, gz));
  const errors: string[] = [];
  for (const p of pages) {
    if (p.js > BUDGET.js)
      errors.push(`${p.page}: ${kb(p.js)} of JavaScript (compressed), over the ${kb(BUDGET.js)} budget (NFR-002).`);
    const rest = p.html + p.css + p.fonts;
    if (rest > BUDGET.htmlCssFonts)
      errors.push(
        `${p.page}: ${kb(rest)} of HTML, CSS and fonts (compressed), over the ${kb(BUDGET.htmlCssFonts)} budget (NFR-002).`,
      );
  }
  const warnings = allFiles(dist)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => ({ f, bytes: statSync(f).size }))
    .filter(({ bytes }) => bytes > BUDGET.svg)
    .map(
      ({ f, bytes }) =>
        `W-DIAGRAM-LARGE: ${rel(dist, f)} is ${Math.round(bytes / 1024)} KiB, over 250 KiB. Fix: simplify the drawing or split it in two.`,
    );
  return { pages, errors, warnings };
}

/** One line per page: "book/x/  JS 12.3 KB · HTML 4.1 KB · CSS 9.3 KB · fonts 98.0 KB". */
export function formatSizes(report: SizeReport): string[] {
  return report.pages.map(
    (p) => `${p.page.padEnd(32)} JS ${kb(p.js)} · HTML ${kb(p.html)} · CSS ${kb(p.css)} · fonts ${kb(p.fonts)}`,
  );
}

/** "12.3 KB", or "0 KB" for nothing at all. */
export function kb(bytes: number): string {
  return bytes === 0 ? "0 KB" : `${(bytes / 1000).toFixed(1)} KB`;
}

function measurePage(dist: string, base: string, file: string, gz: (path: string) => number): PageSize {
  const html = readFileSync(file, "utf8");
  const resolveUrl = urlResolver(dist, base, file);
  const files = new Set<string>();

  // JavaScript: module scripts and preloads, then every module they import; inline scripts count as written.
  let js = 0;
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = attr(m[1]!, "src");
    if (src) collectModule(resolveUrl(src), files, resolveUrl);
    else if (!/type\s*=\s*["']?application\/(ld\+)?json/i.test(m[1]!) && m[2]!.trim()) js += gzipSync(m[2]!).length;
  }
  const links = [...html.matchAll(/<link\b([^>]*)>/gi)].map((m) => m[1]!);
  const preload = (as: string) =>
    links.filter(
      (l) => /rel\s*=\s*["']?preload/i.test(l) && new RegExp(String.raw`\bas\s*=\s*["']?${as}\b`, "i").test(l),
    );
  for (const l of links)
    if (/rel\s*=\s*["']?modulepreload/i.test(l)) collectModule(resolveUrl(attr(l, "href")), files, resolveUrl);
  for (const l of preload("script")) collectModule(resolveUrl(attr(l, "href")), files, resolveUrl);
  const scripts = [...files].filter((f) => /\.m?js$/.test(f));
  js += scripts.reduce((sum, f) => sum + gz(f), 0);

  // CSS: linked stylesheets and inline <style>.
  const sheetLinks = [...links.filter((l) => /rel\s*=\s*["']?stylesheet/i.test(l)), ...preload("style")];
  const sheets = [...new Set(sheetLinks.map((l) => resolveUrl(attr(l, "href"))))].filter(
    (f): f is string => !!f && existsSync(f),
  );
  const inline = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!);
  let css = inline.reduce((sum, s) => sum + gzipSync(s).length, 0);
  css += sheets.reduce((sum, f) => sum + gz(f), 0);
  sheets.forEach((f) => files.add(f));

  // Fonts the page would load.
  const page = { classes: classesOf(html), chars: charsOf(html), tags: tagsOf(html) };
  let fonts = 0;
  // A preloaded font is always downloaded.
  for (const l of preload("font")) {
    const path = resolveUrl(attr(l, "href"));
    if (path && existsSync(path) && !files.has(path)) {
      files.add(path);
      fonts += gz(path);
    }
  }
  for (const { text, from } of [
    ...sheets.map((f) => ({ text: readFileSync(f, "utf8"), from: f })),
    ...inline.map((text) => ({ text, from: file })),
  ]) {
    for (const font of fontsUsed(text, page)) {
      const path = font.startsWith("/") ? resolveUrl(font) : resolve(dirname(from), font.split(/[?#]/)[0]!);
      if (path && existsSync(path) && !files.has(path)) {
        files.add(path);
        fonts += gz(path);
      }
    }
  }
  return {
    page: pageName(dist, file),
    html: gzipSync(html).length,
    css,
    fonts,
    js,
    files: [...files].map((f) => rel(dist, f)),
  };
}

/** Adds a module and, recursively, every module it imports (static or dynamic) to `files`. */
function collectModule(
  path: string | undefined,
  files: Set<string>,
  resolveUrl: (url: string) => string | undefined,
): void {
  if (!path || files.has(path) || !existsSync(path)) return;
  files.add(path);
  const code = readFileSync(path, "utf8");
  for (const m of code.matchAll(/(?:\bimport\s*\(\s*|\bimport\s*|\bfrom\s*)["']([^"']+\.m?js)["']/g)) {
    const spec = m[1]!;
    if (/^(\.{1,2}\/|\/)/.test(spec))
      collectModule(spec.startsWith("/") ? resolveUrl(spec) : resolve(dirname(path), spec), files, resolveUrl);
  }
}

/** The page-relative or root-relative address → a file in `dist`; undefined for another site's address. */
function urlResolver(dist: string, base: string, page: string): (url: string | undefined) => string | undefined {
  return (url) => {
    if (!url || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) return undefined;
    const clean = decodeURIComponent(url.split(/[?#]/)[0]!);
    if (clean.startsWith(base)) return join(dist, clean.slice(base.length));
    if (clean.startsWith("/")) return join(dist, clean.slice(1));
    return resolve(dirname(page), clean);
  };
}

/** Font files a stylesheet would make this page download (see the header for the rules). */
export function fontsUsed(
  css: string,
  page: { classes: Set<string>; chars: Set<number>; tags?: Set<string> },
): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  type Face = { family: string; url: string; weight: string; style: string; ranges?: [number, number][] };
  const faces: Face[] = [];
  /**
   * Per family named by a rule that applies: the weights and styles that same rule sets with it, and whether a rule
   * without classes names it (a base font, which the browser's own bold and italic elements use).
   */
  const families = new Map<string, { weights: Set<string>; styles: Set<string>; base: boolean }>();
  const lower = (v: string) => v.replace(/["']/g, "").trim().toLowerCase();
  for (const { selector, body } of rulesOf(text)) {
    const decl = (name: string) => new RegExp(String.raw`(?:^|;)\s*${name}\s*:\s*([^;]+)`, "i").exec(body)?.[1];
    if (selector === "@font-face") {
      const family = decl("font-family");
      const url = decl("src") && /url\(\s*["']?([^"')]+)["']?\s*\)/i.exec(decl("src")!)?.[1];
      const range = decl("unicode-range");
      if (family && url)
        faces.push({
          family: lower(family),
          url,
          weight: lower(decl("font-weight") ?? "normal"),
          style: lower(decl("font-style") ?? "normal"),
          ...(range ? { ranges: parseRanges(range) } : {}),
        });
    } else if (applies(selector, page.classes)) {
      const weight = decl("font-weight");
      const style = decl("font-style");
      const shorthand = decl("font");
      for (const d of body.matchAll(/(?:^|;)\s*(font-family|font|--[\w-]+)\s*:\s*([^;]+)/gi)) {
        // Each comma-separated name; a `font` shorthand's first one carries the size before it ("600 1rem/1 Inter").
        for (const name of d[2]!.split(",")) {
          const entry = families.get(lower(name)) ?? {
            weights: new Set<string>(),
            styles: new Set<string>(),
            base: false,
          };
          if (!/\.[_a-zA-Z-]/.test(selector)) entry.base = true;
          if (weight) entry.weights.add(lower(weight));
          if (style) entry.styles.add(lower(style));
          if (shorthand && /\b(bold|[6-9]00)\b/i.test(shorthand)) entry.weights.add("bold");
          if (shorthand && /\bitalic\b/i.test(shorthand)) entry.styles.add("italic");
          families.set(lower(name), entry);
        }
      }
    }
  }
  const bold = (w: string) => /^(bold|bolder|[6-9]00)$/.test(w);
  const uses = (face: Face) => {
    const named = [...families].filter(([f]) => f === face.family || f.endsWith(` ${face.family}`)).map(([, e]) => e);
    if (!named.length) return false;
    // A variable face ("100 900") or a regular one serves any weight; a bold or italic face needs a rule that names
    // its family and asks for that weight or style.
    const base = named.some((e) => e.base);
    const has = (...tags: string[]) => tags.some((t) => page.tags?.has(t));
    const weightOk =
      !bold(face.weight) ||
      face.weight.includes(" ") ||
      named.some((e) => [...e.weights].some(bold)) ||
      (base && has("strong", "b", "h1", "h2", "h3", "h4", "h5", "h6", "th"));
    const styleOk =
      face.style !== "italic" ||
      named.some((e) => e.styles.has("italic")) ||
      (base && has("em", "i", "cite", "dfn", "var"));
    return weightOk && styleOk;
  };
  const covers = (face: Face) =>
    !face.ranges || face.ranges.some(([lo, hi]) => [...page.chars].some((c) => c >= lo && c <= hi));
  return faces.filter((f) => uses(f) && covers(f)).map((f) => f.url);
}

/** Flattened style rules: `@media`/`@supports`/`@layer` contents are rules too; `@font-face` is kept by name. */
function rulesOf(css: string): { selector: string; body: string }[] {
  const out: { selector: string; body: string }[] = [];
  let i = 0;
  const walk = (end: number) => {
    let start = i;
    while (i < end) {
      const ch = css[i];
      if (ch === "{") {
        const selector = css.slice(start, i).trim();
        const close = matching(css, i);
        if (/^@(media|supports|layer|container|document)\b/i.test(selector)) {
          i++;
          walk(close);
        } else if (!/^@(keyframes|-webkit-keyframes|property|page)\b/i.test(selector)) {
          out.push({
            selector: /^@font-face/i.test(selector) ? "@font-face" : selector,
            body: css.slice(i + 1, close),
          });
        }
        i = close + 1;
        start = i;
      } else if (ch === ";" && css.slice(start, i).trim().startsWith("@")) {
        i++;
        start = i;
      } else i++;
    }
  };
  walk(css.length);
  return out;
}

function matching(css: string, open: number): number {
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return i;
  }
  return css.length;
}

/** Whether some selector in the list could match on the page: all of its class names appear there. */
function applies(selectorList: string, classes: Set<string>): boolean {
  return selectorList
    .split(",")
    .some((s) =>
      [...s.replace(/:not\([^)]*\)/g, "").matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].every((m) => classes.has(m[1]!)),
    );
}

/** `unicode-range: U+0000-00FF, U+0131, U+4??` → [lo, hi] pairs. */
export function parseRanges(value: string): [number, number][] {
  return value.split(",").flatMap((part): [number, number][] => {
    const m = /U\+([0-9a-f?]+)(?:-([0-9a-f]+))?/i.exec(part.trim());
    if (!m) return [];
    if (m[1]!.includes("?"))
      return [[parseInt(m[1]!.replace(/\?/g, "0"), 16), parseInt(m[1]!.replace(/\?/g, "f"), 16)]];
    const lo = parseInt(m[1]!, 16);
    return [[lo, m[2] ? parseInt(m[2], 16) : lo]];
  });
}

/** The element names used on the page, in lower case. */
function tagsOf(html: string): Set<string> {
  return new Set([...html.matchAll(/<([a-z][\w-]*)/gi)].map((m) => m[1]!.toLowerCase()));
}

function classesOf(html: string): Set<string> {
  const out = new Set<string>();
  for (const m of html.matchAll(/\bclass\s*=\s*["']([^"']*)["']/gi))
    for (const c of m[1]!.split(/\s+/)) if (c) out.add(c);
  return out;
}

/**
 * The code points of the page's visible text, set in the page's own fonts: tags, scripts and styles removed, entities
 * decoded, and typeset math left out (KaTeX sets it in its own fonts, which have no unicode-range).
 */
function charsOf(html: string): Set<number> {
  const out = new Set<number>();
  let math = 0;
  const stack: boolean[] = [];
  const cleaned = html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const m of cleaned.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>|([^<]+)/gi)) {
    if (m[4] !== undefined) {
      if (math) continue;
      const text = m[4]
        .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
        .replace(/&[a-z]+;/gi, " ");
      for (const ch of text) out.add(ch.codePointAt(0)!);
      continue;
    }
    const [, close, tag, attrs] = m;
    if (VOID.has(tag!.toLowerCase()) || attrs!.endsWith("/")) continue;
    if (close) {
      if (stack.pop()) math--;
    } else {
      const isMath = tag!.toLowerCase() === "math" || /\bclass\s*=\s*["'][^"']*\bkatex\b/i.test(attrs!);
      stack.push(isMath);
      if (isMath) math++;
    }
  }
  return out;
}

const VOID = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

function attr(tag: string, name: string): string | undefined {
  if (!tag) return undefined;
  return new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
    .exec(tag)
    ?.slice(1)
    .find((v) => v !== undefined);
}

function gzipCache(): (path: string) => number {
  const seen = new Map<string, number>();
  return (path) => {
    let n = seen.get(path);
    if (n === undefined) seen.set(path, (n = gzipSync(readFileSync(path)).length));
    return n;
  };
}
