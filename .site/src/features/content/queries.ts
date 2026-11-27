/**
 * The published book, articles and pages, as pages read them (interfaces.md MOD-vault), from the content store the
 * vault loader filled. `astro:content` is loaded on first use, so this module can be imported outside Astro (tests).
 */
import type { ArticleData, BookData, ChapterData, PageData } from "./loader.ts";

/** A part of the book with its published chapters, in order (data-model.md `Part`). */
export type Part = ChapterData["part"] & { chapters: ChapterData[] };
/** The published book in reading order (data-model.md `Book`). */
export type Book = { settings: BookData; parts: Part[]; chapters: ChapterData[]; totalReadingMinutes: number };

async function entries<T>(collection: "chapters" | "articles" | "pages" | "book"): Promise<T[]> {
  // Typed here rather than by Astro's generated collection types, which only exist after a sync.
  const { getCollection } = (await import("astro:content")) as unknown as { getCollection(name: string): Promise<{ data: T; rendered?: { html: string } }[]> };
  const found = await getCollection(collection);
  return found.map((e) => ({ ...e.data, html: e.rendered?.html ?? "" }) as T);
}

/** The published book in reading order. Drafts are never included. */
export async function getBook(): Promise<Book> {
  const [settings] = await entries<BookData>("book");
  // The loader stops the build on E-BOOK-MISSING before any page is built, so this is an invariant, not content.
  if (!settings) throw new Error("getBook: the book collection is empty although the loader requires book.md");
  return bookOf(settings, await entries<ChapterData>("chapters"));
}

/**
 * The book from its settings and published chapters (in any order): chapters sorted by part, then number, and
 * grouped into parts. Pure, so tests can build the book from `buildVault` without Astro's content store.
 */
export function bookOf(settings: BookData, published: ChapterData[]): Book {
  const chapters = [...published].sort((a, b) => a.part.number - b.part.number || a.number - b.number);
  const parts: Part[] = [];
  for (const c of chapters) {
    const last = parts.at(-1);
    if (last?.number === c.part.number) last.chapters.push(c);
    else parts.push({ ...c.part, chapters: [c] });
  }
  return { settings, parts, chapters, totalReadingMinutes: chapters.reduce((n, c) => n + c.readingMinutes, 0) };
}

/**
 * The order articles are listed in: featured first, then newest first, then undated ones, then by slug (so it never
 * depends on the file system). ISO dates sort as text; an undated article ("" here) goes after every dated one.
 */
export function byFeaturedThenNewest(a: ArticleData, b: ArticleData): number {
  return Number(b.featured) - Number(a.featured) || (b.date ?? "").localeCompare(a.date ?? "") || a.slug.localeCompare(b.slug);
}

/** Published articles: featured first, then newest first, then undated. */
export async function getArticles(): Promise<ArticleData[]> {
  return (await entries<ArticleData>("articles")).sort(byFeaturedThenNewest);
}

export async function getPage(slug: "about"): Promise<PageData | undefined> {
  return (await entries<PageData>("pages")).find((p) => p.slug === slug);
}
