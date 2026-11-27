/**
 * What the homepage lists (MOD-home, REQ-HOME-002, REQ-HOME-003, design/screens/home.md). Pure, so it's tested
 * without Astro. It hides the limits (6 cards, 5 rows), the "Start here" fallback and the featured-first ordering.
 * Drafts never reach it: MOD-vault leaves them out of the book and the articles (REQ-CNT-004).
 */
import { byFeaturedThenNewest, type ArticleData, type Book, type ChapterData } from "../content/index.ts";

/** At most this many featured chapters show (REQ-HOME-002). */
export const FEATURED_MAX = 6;
/** With nothing featured, this many chapters from the start of the book show instead (REQ-HOME-002.AC2). */
export const START_HERE_COUNT = 3;
/** At most this many articles show (REQ-HOME-003). */
export const LATEST_MAX = 5;

export type FeaturedChapters = {
  /** "Featured chapters", or "Start here" when no chapter is featured. */
  heading: "Featured chapters" | "Start here";
  /** In book order; empty only when the book has no published chapter. */
  chapters: ChapterData[];
};

/**
 * The published chapters marked `featured: true`, in book order, at most 6. With none featured, the first 3
 * published chapters under "Start here".
 */
export function selectFeaturedChapters(book: Book): FeaturedChapters {
  // book.chapters is already in book order (MOD-vault's bookOf).
  const featured = book.chapters.filter((c) => c.featured);
  return featured.length
    ? { heading: "Featured chapters", chapters: featured.slice(0, FEATURED_MAX) }
    : { heading: "Start here", chapters: book.chapters.slice(0, START_HERE_COUNT) };
}

/**
 * At most 5 published articles: featured ones first, then newest first, then undated ones (by slug, so the
 * order never depends on the file system). Empty when there are none, so the section is left out.
 */
export function selectLatestArticles(articles: readonly ArticleData[]): ArticleData[] {
  // MOD-vault's list order, applied here too so the homepage never depends on the order it's handed.
  return [...articles].sort(byFeaturedThenNewest).slice(0, LATEST_MAX);
}
