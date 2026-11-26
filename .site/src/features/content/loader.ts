/**
 * The vault loader (ADR-0003, CNF-004): Astro's content loader for the vault one folder above `.site/`.
 * `buildVault` is its core: it reads the vault (readVault), renders every published entry and the book's pitch with
 * MOD-obsidian-markdown, each with its own context (links to published entries, embeds over the vault's files,
 * chapter numbering, the figure renderer), and collects every problem. It runs once per build and is shared by the
 * four collections (chapters, articles, pages, book); the figure renderer it's given records each diagram drawn, so
 * the diagram route publishes exactly those (CR-0007).
 *
 * Problems are added to the build report. In `astro build`, an error stops the build right after content sync, with
 * the report, so no page is built from content that has an error. In `astro dev` they're logged and the site stays up.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Loader } from "astro/loaders";
import { renderObsidian, createFileResolver, type FigureRenderer, type Section } from "../markdown/index.ts";
import { buildIssues, stopOnErrors, url, type BuildIssue } from "../site/index.ts";
import type { BookSettings } from "./book-settings.ts";
import { readingMinutes, summaryOf } from "./summary.ts";
import { readVault } from "./vault.ts";

/** What the loader needs: the vault, and how to draw figures (MOD-diagrams, handed in by content.config.ts). */
export type LoaderOptions = { vaultRoot: string; figures: () => Promise<FigureRenderer> };

/** Fields every rendered entry carries (data-model.md `EntryBase`). Serializable: it's stored by Astro. */
type EntryData = {
  slug: string;
  title: string;
  /** The description, else the first paragraph, at most 200 characters (REQ-CNT-008). */
  summary: string;
  readingMinutes: number;
  featured: boolean;
  movedFrom: string[];
  sourcePath: string;
  html: string;
  sections: Section[];
  hasFootnotes: boolean;
  hasDiagrams: boolean;
};
export type ChapterData = EntryData & {
  kind: "chapter";
  number: number;
  part: { number: number; romanNumeral: string; title: string; slug: string };
  epigraph?: { text: string; source?: string };
};
export type ArticleData = EntryData & { kind: "article"; date?: string };
export type PageData = EntryData & { kind: "page" };
export type BookData = BookSettings & { pitchHtml: string };

/** The whole published vault, rendered. `book` is undefined when book.md is missing or wrong (an error is reported). */
export type RenderedVault = { book?: BookData; chapters: ChapterData[]; articles: ArticleData[]; pages: PageData[]; issues: BuildIssue[] };

/** Reads and renders the vault at `vaultRoot`. Never throws for content problems: they're in `issues`. */
export async function buildVault(options: LoaderOptions): Promise<RenderedVault> {
  const { vaultRoot } = options;
  const vault = readVault(vaultRoot);
  const figure = await options.figures();
  const resolveFile = createFileResolver(vaultFiles(vaultRoot));
  const issues: BuildIssue[] = [...vault.issues];

  // `[[name]]` finds an entry by its file name (as Obsidian does) or its slug.
  const notes = new Map<string, { href: string; title: string }>();
  const note = (sourcePath: string, slug: string, href: string, title: string) => {
    for (const key of [sourcePath.split("/").pop()!.replace(/\.md$/, ""), slug]) if (!notes.has(key)) notes.set(key, { href, title });
  };
  for (const c of vault.chapters) note(c.sourcePath, c.slug, url({ kind: "chapter", slug: c.slug }), c.title);
  for (const a of vault.articles) note(a.sourcePath, a.slug, url({ kind: "article", slug: a.slug }), a.title);
  for (const p of vault.pages) note(p.sourcePath, p.slug, url({ kind: "about" }), p.title);

  const render = async (sourcePath: string, body: string, numbers: { prefix: string } | false) => {
    const text = sourcePath === "book.md" ? body : readFileSync(join(vaultRoot, sourcePath), "utf8");
    const result = await renderObsidian(text, { filePath: sourcePath, resolveFile, resolveNote: (t) => notes.get(t), headingNumbers: numbers, figure });
    issues.push(...result.issues);
    return result;
  };
  const base = async (e: { slug: string; title: string; sourcePath: string; body: string; frontmatter: { description?: string; featured: boolean; moved_from: string[] } }, numbers: { prefix: string } | false): Promise<EntryData> => {
    const r = await render(e.sourcePath, e.body, numbers);
    return {
      slug: e.slug,
      title: e.title,
      summary: summaryOf(e.body, e.frontmatter.description),
      readingMinutes: readingMinutes(e.body),
      featured: e.frontmatter.featured,
      movedFrom: e.frontmatter.moved_from,
      sourcePath: e.sourcePath,
      html: r.html,
      sections: r.sections,
      hasFootnotes: r.footnoteCount > 0,
      hasDiagrams: r.figureCount > 0,
    };
  };

  const chapters: ChapterData[] = [];
  for (const c of vault.chapters) {
    const data: ChapterData = { ...(await base(c, { prefix: String(c.number) })), kind: "chapter", number: c.number, part: { ...c.part, romanNumeral: romanNumeral(c.part.number) } };
    if (c.frontmatter.epigraph) data.epigraph = { text: c.frontmatter.epigraph, ...(c.frontmatter.epigraph_source ? { source: c.frontmatter.epigraph_source } : {}) };
    chapters.push(data);
  }
  const articles: ArticleData[] = [];
  for (const a of vault.articles) articles.push({ ...(await base(a, false)), kind: "article", ...(a.date ? { date: a.date } : {}) });
  const pages: PageData[] = [];
  for (const p of vault.pages) pages.push({ ...(await base(p, false)), kind: "page" });

  let book: BookData | undefined;
  if (vault.book) book = { ...vault.book, pitchHtml: (await render("book.md", vault.book.pitchMarkdown, false)).html };
  return { ...(book ? { book } : {}), chapters, articles, pages, issues };
}

/** The four collections the loader fills (content.config.ts). */
export type Collection = "chapters" | "articles" | "pages" | "book";

/**
 * Astro content loader for one collection of the vault one folder above .site/. Registers chapters, articles, pages
 * or book; all four share one `buildVault` per build.
 */
export function vaultLoader(options: LoaderOptions & { collection: Collection }): Loader {
  return {
    name: `sdfp-vault-${options.collection}`,
    load: async ({ store, logger, watcher }) => {
      const fill = async () => {
        const vault = await shared(options, !!watcher);
        report(vault.issues);
        store.clear();
        for (const entry of entriesOf(vault, options.collection)) store.set({ id: entry.id, data: entry.data, rendered: { html: entry.html } });
        // A build stops on an error; `astro dev`, `astro check` and `astro sync` only list the problems (a type check
        // shouldn't fail because a chapter has a typo).
        const building = !watcher && !process.argv.slice(2).some((a) => a === "check" || a === "sync");
        if (building) await stopOnErrors();
        // The four collections share one vault, so one of them lists its problems.
        else if (options.collection === "book") for (const i of vault.issues) logger.warn(`${i.code} ${i.file}${i.line ? `:${i.line}` : ""}: ${i.message}`);
      };
      await fill();
      if (watcher) {
        // astro dev: a change anywhere in the vault (outside .site/) reloads it.
        watcher.add(options.vaultRoot);
        watcher.on("all", (_event: string, path: string) => {
          if (!/[\\/]\.site[\\/]/.test(path) && /\.(md|svg)$/i.test(path)) void fill();
        });
      }
    },
  };
}

/** The entries of one collection, with their stored data (html travels in `rendered`). */
function entriesOf(vault: RenderedVault, collection: Collection): { id: string; data: Record<string, unknown>; html: string }[] {
  const withoutHtml = <T extends { html: string }>({ html, ...rest }: T) => ({ data: rest as Record<string, unknown>, html });
  switch (collection) {
    case "chapters":
      return vault.chapters.map((c) => ({ id: c.slug, ...withoutHtml(c) }));
    case "articles":
      return vault.articles.map((a) => ({ id: a.slug, ...withoutHtml(a) }));
    case "pages":
      return vault.pages.map((p) => ({ id: p.slug, ...withoutHtml(p) }));
    case "book":
      return vault.book ? [{ id: "book", data: vault.book as unknown as Record<string, unknown>, html: vault.book.pitchHtml }] : [];
  }
}

const SHARED = Symbol.for("sdfp.vault");
/** One render of the vault per build, shared by the four collections; under `astro dev` each load reads afresh. */
function shared(options: LoaderOptions, dev: boolean): Promise<RenderedVault> {
  const holder = globalThis as typeof globalThis & { [SHARED]?: Map<string, Promise<RenderedVault>> };
  const cache = (holder[SHARED] ??= new Map());
  if (dev) cache.delete(options.vaultRoot);
  let vault = cache.get(options.vaultRoot);
  if (!vault) {
    vault = buildVault(options);
    cache.set(options.vaultRoot, vault);
  }
  return vault;
}

/** Adds the vault's issues to the build report (the collector keeps one of each, so four collections add them once). */
function report(issues: readonly BuildIssue[]): void {
  for (const issue of issues) buildIssues.add(issue);
}

/** Every file in the vault (vault-relative, `/`), for Obsidian's embed lookup; hidden folders (.site, .obsidian, .git) are skipped. */
function vaultFiles(root: string, dir = ""): string[] {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith(".") || e.name === "node_modules") return [];
    const path = dir ? `${dir}/${e.name}` : e.name;
    return e.isDirectory() ? vaultFiles(root, path) : [path];
  });
}

/** 1 → "I", 4 → "IV": parts are shown as "Part I" (glossary). */
export function romanNumeral(n: number): string {
  const steps: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  let out = "";
  for (const [value, mark] of steps) {
    while (n >= value) {
      out += mark;
      n -= value;
    }
  }
  return out;
}
