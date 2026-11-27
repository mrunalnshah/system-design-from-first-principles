/**
 * Reading the built site (`dist/`), shared by the size and link checks (TOOL-11, TOOL-12): its files, and the page
 * name each HTML file is reported under.
 */
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** Every file under `dir`, at any depth. */
export function allFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? allFiles(p) : [p];
  });
}

/** Every built page. */
export function htmlFiles(dist: string): string[] {
  return allFiles(dist).filter((f) => f.endsWith(".html"));
}

/** A file's path inside `dist`, with forward slashes. */
export function rel(dist: string, file: string): string {
  return relative(dist, file).replace(/\\/g, "/");
}

/** A page's name in reports: "index.html" → "/"; "book/x/index.html" → "book/x/"; "404.html" stays. */
export function pageName(dist: string, file: string): string {
  const r = rel(dist, file);
  return r === "index.html" ? "/" : r.replace(/(^|\/)index\.html$/, "$1");
}
