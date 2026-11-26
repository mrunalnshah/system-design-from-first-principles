/**
 * The vault scan (REQ-CNT-001, REQ-CNT-002, REQ-CNT-003): finds the book's parts and chapters, the
 * articles and the About page, in book order and with titles, and ignores everything else, so the author
 * never configures anything. Only these count:
 * - parts: folders `part-<n>_<slug>` at the vault root;
 * - chapters: files `chapter-<n>_<slug>.md` directly inside a part;
 * - articles: `.md` files directly inside `articles/`;
 * - pages: `about.md` at the vault root.
 * Everything else (`.obsidian/`, `excalidraw/`, `templates/`, planning files, `book.md`, …) is never read.
 *
 * Problems come back as `issues` (E-CHAPTER-DUPLICATE, E-SLUG-CLASH), never as exceptions.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import type { BuildIssue } from "../site/index.ts";
import { parseArticleFile, parseChapterFile, parsePartFolder, RESERVED_SLUGS, titleFromSlug } from "./naming.ts";

/** What every entry carries from its file. */
type EntryFile = {
  slug: string;
  /** `title:` from the frontmatter, else derived from the slug (REQ-CNT-002). */
  title: string;
  /** Vault-relative, `/`-separated; used in messages. */
  sourcePath: string;
  frontmatter: Record<string, unknown>;
  /** The Markdown after the frontmatter, with the frontmatter's lines left blank so line numbers match the file. */
  body: string;
};

export type ScannedPart = { number: number; slug: string; title: string; sourcePath: string; chapters: ScannedChapter[] };
export type ScannedChapter = EntryFile & { kind: "chapter"; number: number; part: { number: number; slug: string; title: string } };
export type ScannedArticle = EntryFile & { kind: "article" };
export type ScannedPage = EntryFile & { kind: "page" };

export type VaultScan = {
  /** Parts in number order, each with its chapters; a part without chapters is left out. */
  parts: ScannedPart[];
  /** Every chapter in book order: by part number, then chapter number. */
  chapters: ScannedChapter[];
  /** Articles in file-name order (dates and sorting come with the frontmatter rules). */
  articles: ScannedArticle[];
  pages: ScannedPage[];
  issues: BuildIssue[];
};

/** Scans the vault at `root` (the folder holding `book.md`). Reads only the files listed above. */
export function scanVault(root: string): VaultScan {
  const issues: BuildIssue[] = [];
  const top = entries(root);

  const parts: ScannedPart[] = [];
  for (const dir of top.filter((e) => e.isDirectory())) {
    const p = parsePartFolder(dir.name);
    if (!p) continue;
    const part = { number: p.number, slug: p.slug, title: titleFromSlug(p.slug), sourcePath: dir.name, chapters: [] as ScannedChapter[] };
    for (const file of entries(join(root, dir.name)).filter((e) => e.isFile())) {
      const c = parseChapterFile(file.name);
      if (!c) continue;
      const entry = readEntry(root, `${dir.name}/${file.name}`, c.slug);
      part.chapters.push({ ...entry, kind: "chapter", number: c.number, part: { number: part.number, slug: part.slug, title: part.title } });
    }
    part.chapters.sort(byNumber);
    parts.push(part);
  }
  parts.sort((a, b) => a.number - b.number || a.slug.localeCompare(b.slug));
  const chapters = parts.flatMap((p) => p.chapters);

  const articles: ScannedArticle[] = [];
  if (top.some((e) => e.isDirectory() && e.name === "articles")) {
    for (const file of entries(join(root, "articles")).filter((e) => e.isFile())) {
      const a = parseArticleFile(file.name);
      if (a) articles.push({ ...readEntry(root, `articles/${file.name}`, a.slug), kind: "article" });
    }
  }
  articles.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));

  const pages: ScannedPage[] = top.some((e) => e.isFile() && e.name === "about.md") ? [{ ...readEntry(root, "about.md", "about"), kind: "page" }] : [];

  issues.push(...duplicateNumbers(chapters), ...slugClashes(chapters, "chapter"), ...slugClashes(articles, "article"));
  return { parts: parts.filter((p) => p.chapters.length), chapters, articles, pages, issues };
}

/** E-CHAPTER-DUPLICATE: chapter numbers are unique across the whole book (REQ-CNT-001.AC3). One issue per number. */
function duplicateNumbers(chapters: ScannedChapter[]): BuildIssue[] {
  return groups(chapters, (c) => String(c.number)).map((same) => {
    const files = same.map((c) => c.sourcePath);
    return {
      severity: "error",
      code: "E-CHAPTER-DUPLICATE",
      file: files[0]!,
      message: `${files.length} chapters have the number ${same[0]!.number}: ${list(files)}. Chapter numbers must be unique across the book.`,
      fix: `Renumber one of them: ${files.join(", ")}.`,
    };
  });
}

/** E-SLUG-CLASH: two chapters (or two articles) that would share an address, or a slug the site keeps for itself. */
function slugClashes(entries: (ScannedChapter | ScannedArticle)[], kind: "chapter" | "article"): BuildIssue[] {
  const shared: BuildIssue[] = groups(entries, (e) => e.slug).map((same) => {
    const files = same.map((e) => e.sourcePath);
    return {
      severity: "error",
      code: "E-SLUG-CLASH",
      file: files[0]!,
      message: `${list(files)} would both be the ${kind} "${same[0]!.slug}", at the same address.`,
      fix: `Rename one file. Files: ${files.join(", ")}.`,
    };
  });
  const reserved: BuildIssue[] = entries
    .filter((e) => RESERVED_SLUGS.includes(e.slug))
    .map((e) => ({
      severity: "error",
      code: "E-SLUG-CLASH",
      file: e.sourcePath,
      message: `"${e.slug}" is kept for the website's own files, so this ${kind} can't use it as its address.`,
      fix: `Rename one file. Give ${e.sourcePath} another name (not ${RESERVED_SLUGS.join(", ")}).`,
    }));
  return [...shared, ...reserved];
}

function readEntry(root: string, sourcePath: string, slug: string): EntryFile {
  const text = readFileSync(join(root, sourcePath), "utf8").replace(/\r\n?/g, "\n");
  let frontmatter: Record<string, unknown> = {};
  let body = text;
  try {
    const parsed = parseFrontmatter(text, { frontmatter: "empty-with-lines" });
    frontmatter = parsed.frontmatter as Record<string, unknown>;
    body = parsed.content;
  } catch {
    // Invalid YAML: reported by the frontmatter rules (E-FRONTMATTER-YAML); the entry keeps its derived title.
  }
  const title = typeof frontmatter.title === "string" && frontmatter.title.trim() ? frontmatter.title.trim() : titleFromSlug(slug);
  return { slug, title, sourcePath, frontmatter, body };
}

/** Directory entries, skipping hidden ones (`.obsidian`, `.git`, …). */
function entries(dir: string) {
  return readdirSync(dir, { withFileTypes: true }).filter((e) => !e.name.startsWith("."));
}

const byNumber = (a: ScannedChapter, b: ScannedChapter) => a.number - b.number || a.sourcePath.localeCompare(b.sourcePath);

/** Groups of two or more items sharing a key, in first-seen order. */
function groups<T>(items: T[], key: (item: T) => string): T[][] {
  const by = new Map<string, T[]>();
  for (const item of items) by.set(key(item), [...(by.get(key(item)) ?? []), item]);
  return [...by.values()].filter((g) => g.length > 1);
}

/** "a and b", "a, b and c". */
function list(items: string[]): string {
  return items.length < 2 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}
