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
 * Drafts (`draft: true`) are left out of every list (REQ-CNT-004); chapter numbers are still checked across
 * drafts too, so publishing one later can't clash. Articles are sorted newest first, then undated ones.
 *
 * Problems come back as `issues` (E-CHAPTER-DUPLICATE, E-SLUG-CLASH, the frontmatter rules' E-FRONTMATTER-YAML
 * and E-FRONTMATTER-FIELD, W-ARTICLE-UNDATED), never as exceptions.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { redirectClashes, type BuildIssue } from "../site/index.ts";
import { parseArticleFile, parseChapterFile, parsePartFolder, RESERVED_SLUGS, titleFromSlug } from "./naming.ts";
import { readFrontmatter, type ArticleFrontmatter, type ChapterFrontmatter, type PageFrontmatter } from "./schemas.ts";

/** What every entry carries from its file. */
type EntryFile<F> = {
  slug: string;
  /** `title:` from the frontmatter, else derived from the slug (REQ-CNT-002). */
  title: string;
  /** Vault-relative, `/`-separated; used in messages. */
  sourcePath: string;
  /** The checked frontmatter, with defaults filled in (specs/contracts/frontmatter.schema.json). */
  frontmatter: F;
  /** The Markdown after the frontmatter, with the frontmatter's lines left blank so line numbers match the file. */
  body: string;
};

export type ScannedPart = { number: number; slug: string; title: string; sourcePath: string; chapters: ScannedChapter[] };
export type ScannedChapter = EntryFile<ChapterFrontmatter> & { kind: "chapter"; number: number; part: { number: number; slug: string; title: string } };
/** `date` is `yyyy-mm-dd`, or undefined for an undated article. */
export type ScannedArticle = EntryFile<ArticleFrontmatter> & { kind: "article"; date?: string };
export type ScannedPage = EntryFile<PageFrontmatter> & { kind: "page" };

export type VaultScan = {
  /** Parts in number order, each with its published chapters; a part without any is left out. */
  parts: ScannedPart[];
  /** Every published chapter in book order: by part number, then chapter number. */
  chapters: ScannedChapter[];
  /** Published articles, newest first, then undated ones by file name. */
  articles: ScannedArticle[];
  pages: ScannedPage[];
  issues: BuildIssue[];
};

/** Scans the vault at `root` (the folder holding `book.md`). Reads only the files listed above. */
export function scanVault(root: string): VaultScan {
  const issues: BuildIssue[] = [];
  const top = entries(root);
  const troubled = new Set<string>(); // files with a frontmatter issue already: no second message about the same thing
  const read = <K extends keyof FrontmatterOf>(sourcePath: string, slug: string, kind: K) => {
    const entry = readEntry(root, sourcePath, slug, kind);
    issues.push(...entry.issues);
    if (entry.issues.length) troubled.add(sourcePath);
    return entry.entry;
  };
  const allChapters: ScannedChapter[] = [];

  const parts: ScannedPart[] = [];
  for (const dir of top.filter((e) => e.isDirectory())) {
    const p = parsePartFolder(dir.name);
    if (!p) continue;
    const part = { number: p.number, slug: p.slug, title: titleFromSlug(p.slug), sourcePath: dir.name, chapters: [] as ScannedChapter[] };
    for (const file of entries(join(root, dir.name)).filter((e) => e.isFile())) {
      const c = parseChapterFile(file.name);
      if (!c) continue;
      const entry = read(`${dir.name}/${file.name}`, c.slug, "chapter");
      const chapter: ScannedChapter = { ...entry, kind: "chapter", number: c.number, part: { number: part.number, slug: part.slug, title: part.title } };
      allChapters.push(chapter);
      if (!entry.frontmatter.draft) part.chapters.push(chapter);
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
      if (!a) continue;
      const entry = read(`articles/${file.name}`, a.slug, "article");
      if (entry.frontmatter.draft) continue;
      const article: ScannedArticle = { ...entry, kind: "article" };
      if (entry.frontmatter.date) article.date = entry.frontmatter.date;
      articles.push(article);
    }
  }
  // Newest first; undated last (REQ-CNT-003.AC3). Dates are yyyy-mm-dd, so text order is date order.
  articles.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.sourcePath.localeCompare(b.sourcePath));
  for (const a of articles.filter((x) => !x.date && !troubled.has(x.sourcePath))) issues.push(undated(a));

  const pages: ScannedPage[] = [];
  if (top.some((e) => e.isFile() && e.name === "about.md")) {
    const about = read("about.md", "about", "page");
    if (!about.frontmatter.draft) pages.push({ ...about, kind: "page" });
  } else issues.push(aboutMissing());

  allChapters.sort((a, b) => a.part.number - b.part.number || a.part.slug.localeCompare(b.part.slug) || byNumber(a, b));
  issues.push(...duplicateNumbers(allChapters), ...slugClashes(chapters, "chapter"), ...slugClashes(articles, "article"));
  // Old addresses of published entries (REQ-BOOK-007): MOD-site owns the rule, the scan reports it before any page is built.
  const moved = [...chapters, ...articles].map((e) => ({ kind: e.kind, slug: e.slug, movedFrom: e.frontmatter.moved_from, sourcePath: e.sourcePath }));
  issues.push(...redirectClashes(moved));
  return { parts: parts.filter((p) => p.chapters.length), chapters, articles, pages, issues };
}

/** W-ARTICLE-UNDATED: the article still publishes, listed after the dated ones and showing no date. */
function undated(a: ScannedArticle): BuildIssue {
  return {
    severity: "warning",
    code: "W-ARTICLE-UNDATED",
    file: a.sourcePath,
    message: "This article has no date, so it's listed after the dated ones and shows no date.",
    fix: "Add date: yyyy-mm-dd to sort it. For example: date: 2026-11-01",
  };
}

/**
 * W-ABOUT-MISSING (REQ-SITE-003.AC2): with no about.md there's no About page, and the header's name links to the
 * portfolio instead. Only for a missing file: a draft about.md is the author's choice, and its fix isn't "create".
 */
function aboutMissing(): BuildIssue {
  return {
    severity: "warning",
    code: "W-ABOUT-MISSING",
    file: "about.md",
    message: "There's no about.md at the vault's top level, so the site has no About page; the header's name links to your portfolio instead.",
    fix: "Create about.md to get an About page. A title and a few paragraphs about you and the book are enough.",
  };
}

/** E-CHAPTER-DUPLICATE: chapter numbers are unique across the whole book, drafts included (REQ-CNT-001.AC3). One issue per number. */
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

type FrontmatterOf = { chapter: ChapterFrontmatter; article: ArticleFrontmatter; page: PageFrontmatter };

function readEntry<K extends keyof FrontmatterOf>(root: string, sourcePath: string, slug: string, kind: K): { entry: EntryFile<FrontmatterOf[K]>; issues: BuildIssue[] } {
  const { data, body, issues } = readFrontmatter(readFileSync(join(root, sourcePath), "utf8"), sourcePath, kind);
  // Entry schemas have no required fields, so `data` is always there; the guard names the invariant.
  if (!data) throw new Error(`Frontmatter of ${sourcePath} has no values although ${kind} fields are all optional`);
  const frontmatter = data as FrontmatterOf[K];
  return { entry: { slug, title: frontmatter.title ?? titleFromSlug(slug), sourcePath, frontmatter, body }, issues };
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
