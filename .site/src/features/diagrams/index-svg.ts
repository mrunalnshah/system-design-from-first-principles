/**
 * The diagram index (ADR-0005, ADR-0012): every SVG in the vault's part folders and `articles/`, read once per
 * build: its size from the `viewBox`, the words of its `<text>` elements (for alt text, so the gitignored drawing
 * source is never needed), its byte size and a content hash for its public address.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

/** One SVG. Paths are vault-relative with `/` separators. */
export type DiagramFile = {
  path: string;
  /** Intrinsic size in CSS pixels, from the viewBox (else the width/height attributes), rounded; 0 if unknown. */
  width: number;
  height: number;
  /** The words of its `<text>` elements, in file order, without repeats. */
  words: string[];
  bytes: number;
  /** First 8 hex digits of the SHA-256 of the file: changes whenever the image does (routes.md). */
  hash: string;
  /** The file's text, served as-is at its public address. */
  svg: string;
};

/** Every SVG by path. */
export type DiagramIndex = { readonly files: ReadonlyMap<string, DiagramFile> };

const cache = new Map<string, Promise<DiagramIndex>>();

/** The index for the vault at `vaultRoot`, read once per build and shared by every caller. */
export function getDiagramIndex(vaultRoot: string): Promise<DiagramIndex> {
  let index = cache.get(vaultRoot);
  if (!index) {
    index = readIndex(vaultRoot);
    cache.set(vaultRoot, index);
  }
  return index;
}

/** Indexes SVG texts given directly (path → text), for tests and callers that already hold the files. */
export function indexOf(svgs: Record<string, string>): DiagramIndex {
  return { files: new Map(Object.entries(svgs).map(([path, svg]) => [path, describe(path, svg)])) };
}

async function readIndex(vaultRoot: string): Promise<DiagramIndex> {
  const top = await readdir(vaultRoot, { withFileTypes: true });
  const roots = top.filter((e) => e.isDirectory() && (/^part-\d+_/.test(e.name) || e.name === "articles")).map((e) => e.name);
  const paths = (await Promise.all(roots.map((r) => svgsUnder(vaultRoot, r)))).flat();
  const texts = await Promise.all(paths.map((p) => readFile(join(vaultRoot, p), "utf8")));
  return { files: new Map(paths.map((p, i) => [p, describe(p, texts[i]!)])) };
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
  const box = attr("viewBox")?.trim().split(/[\s,]+/).map(Number);
  const [width, height] = box?.length === 4 && box.every(Number.isFinite) ? [box[2]!, box[3]!] : [parseFloat(attr("width") ?? ""), parseFloat(attr("height") ?? "")];
  const words = [...new Set([...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/gi)].map((m) => decode(m[1]!.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim()).filter(Boolean))];
  return {
    path,
    width: Number.isFinite(width) && width > 0 ? Math.round(width) : 0,
    height: Number.isFinite(height) && height > 0 ? Math.round(height) : 0,
    words,
    bytes: Buffer.byteLength(svg),
    hash: createHash("sha256").update(svg).digest("hex").slice(0, 8),
    svg,
  };
}

/** XML entities in text: the five named ones and numeric ones. */
function decode(text: string): string {
  const named: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
  return text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) =>
    e[0] === "#" ? String.fromCodePoint(e[1]!.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : named[e.toLowerCase()]!,
  );
}
