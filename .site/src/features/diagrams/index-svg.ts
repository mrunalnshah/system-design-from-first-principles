/**
 * The diagram index (ADR-0005, ADR-0012): every SVG in the vault's part folders and `articles/`, read once per
 * build: its size from the `viewBox`, the words of its `<text>` elements (for alt text, so the gitignored drawing
 * source is never needed), its byte size, a content hash for its public address, and whether it carries active
 * content (scripts, event handlers, `javascript:` links), which the site refuses to publish.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** One SVG. Paths are vault-relative with `/` separators. */
export type DiagramFile = {
  path: string;
  /** Intrinsic size in CSS pixels, from the viewBox (else unitless or px width/height attributes), rounded; 0 if unknown. */
  width: number;
  height: number;
  /** The words of its `<text>` elements, in file order, without repeats. */
  words: string[];
  bytes: number;
  /** First 8 hex digits of the SHA-256 of the file: changes whenever the image does (routes.md). */
  hash: string;
  /** True when the SVG holds script, an `on…=` handler or a `javascript:` link: never published (security.md B4). */
  unsafe: boolean;
};

/** Every SVG by path, for the vault at `root` ("" for an index built from given texts). */
export type DiagramIndex = { readonly root: string; readonly files: ReadonlyMap<string, DiagramFile> };

const cache = new Map<string, Promise<DiagramIndex>>();

/**
 * The index for the vault at `vaultRoot`, read once per build and shared by every caller. Under `astro dev` it's read
 * afresh each time, so an edited or new diagram shows without a restart.
 */
export function getDiagramIndex(vaultRoot: string): Promise<DiagramIndex> {
  if (import.meta.env?.DEV && import.meta.env.MODE !== "test") return readIndex(vaultRoot);
  let index = cache.get(vaultRoot);
  if (!index) {
    index = readIndex(vaultRoot);
    index.catch(() => cache.delete(vaultRoot)); // a failed read is retried next time, not remembered
    cache.set(vaultRoot, index);
  }
  return index;
}

/** Indexes SVG texts given directly (path → text), for tests. */
export function indexOf(svgs: Record<string, string>): DiagramIndex {
  return { root: "", files: new Map(Object.entries(svgs).map(([path, svg]) => [path, describe(path, svg)])) };
}

async function readIndex(vaultRoot: string): Promise<DiagramIndex> {
  const top = await readdir(vaultRoot, { withFileTypes: true });
  const roots = top.filter((e) => e.isDirectory() && (/^part-\d+_/.test(e.name) || e.name === "articles")).map((e) => e.name);
  const paths = (await Promise.all(roots.map((r) => svgsUnder(vaultRoot, r)))).flat();
  const texts = await Promise.all(paths.map((p) => readFile(join(vaultRoot, p), "utf8")));
  return { root: vaultRoot, files: new Map(paths.map((p, i) => [p, describe(p, texts[i]!)])) };
}

/** SVG files under `dir` (vault-relative), skipping hidden folders. */
async function svgsUnder(vaultRoot: string, dir: string): Promise<string[]> {
  const entries = await readdir(join(vaultRoot, dir), { withFileTypes: true });
  const nested = await Promise.all(
    entries.filter((e) => !e.name.startsWith(".")).map((e) => (e.isDirectory() ? svgsUnder(vaultRoot, `${dir}/${e.name}`) : Promise.resolve(/\.svg$/i.test(e.name) ? [`${dir}/${e.name}`] : []))),
  );
  return nested.flat();
}

function describe(path: string, svg: string): DiagramFile {
  const open = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const attr = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(open)?.[1];
  const px = (v: string | undefined) => (v && /^\s*[\d.]+\s*(px)?\s*$/i.test(v) ? parseFloat(v) : NaN); // "100%" or "10em" say nothing
  const box = attr("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const fromBox = box?.length === 4 && box.every(Number.isFinite) && box[2]! > 0 && box[3]! > 0;
  const [width, height] = fromBox ? [box![2]!, box![3]!] : [px(attr("width")), px(attr("height"))];
  const words = [...new Set([...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((m) => textOf(m[1]!)).filter(Boolean))];
  return {
    path,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : 0,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : 0,
    words,
    bytes: Buffer.byteLength(svg),
    hash: createHash("sha256").update(svg).digest("hex").slice(0, 8),
    // Inside tags only, so a diagram's words ("javascript:", "onload =") never trip it.
    unsafe: /<script\b|<foreignObject\b|<[^>]*\son[a-z]+\s*=|<[^>]*\s(?:xlink:)?href\s*=\s*["']\s*javascript:/i.test(svg),
  };
}

/** The readable text of a `<text>` element: CDATA kept, markup dropped, entities decoded, spaces collapsed. */
function textOf(inner: string): string {
  const parts = inner.split(/(<!\[CDATA\[[\s\S]*?\]\]>)/);
  const text = parts.map((p) => (p.startsWith("<![CDATA[") ? p.slice(9, -3) : decode(p.replace(/<[^>]+>/g, "")))).join("");
  return text.replace(/\s+/g, " ").trim();
}

/** XML entities, plus `&nbsp;`; a numeric one outside Unicode becomes U+FFFD instead of failing. */
function decode(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, e: string) => {
    if (e[0] !== "#") return named[e.toLowerCase()] ?? whole;
    const code = e[1]!.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "�";
  });
}
