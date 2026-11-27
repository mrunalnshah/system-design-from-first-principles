/**
 * Previous and next chapters (MOD-book, REQ-BOOK-003, REQ-CNT-004.AC1): the published chapters on either side of
 * one, in reading order across parts (the last chapter of Part I is followed by the first of Part II). Drafts are
 * never in the book, so they're skipped by construction. Articles never are: they aren't chapters (REQ-ART-003).
 */
import type { Book, ChapterData } from "../content/index.ts";

/** The chapters before and after `chapterSlug`; either is missing at the ends of the book, both for an unknown slug. */
export function neighbours(book: Book, chapterSlug: string): { previous?: ChapterData; next?: ChapterData } {
  const at = book.chapters.findIndex((c) => c.slug === chapterSlug);
  if (at < 0) return {};
  const previous = book.chapters[at - 1];
  const next = book.chapters[at + 1];
  return { ...(previous ? { previous } : {}), ...(next ? { next } : {}) };
}
