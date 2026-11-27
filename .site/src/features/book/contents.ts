/**
 * The book's order (MOD-book, REQ-BOOK-001, REQ-BOOK-004): its contents, its first chapter, and part numerals.
 * Pure functions over the published book (drafts never reach it: MOD-vault leaves them out).
 * Chapters keep the number from their file name, which runs on across parts (Part II may start at Chapter 5);
 * parts get Roman numerals. The contents list each chapter's top-level sections (the vault's `#` headings) as
 * sub-items, and leave out any part with no published chapter.
 */
import type { Book, ChapterData } from "../content/index.ts";
import { url } from "../site/index.ts";

/** A chapter's top-level section, linked straight to it. */
export type ContentsSection = { text: string; anchor: string; href: string };
/** A chapter in the contents (design/components.md ContentsChapter). */
export type ContentsChapter = {
  number: number;
  title: string;
  slug: string;
  href: string;
  readingMinutes: number;
  sections: ContentsSection[];
};
/** A part in the contents (design/components.md ContentsPart): "I. Foundations" and its chapters. */
export type ContentsPart = {
  number: number;
  romanNumeral: string;
  title: string;
  slug: string;
  chapters: ContentsChapter[];
};

/** Parts → chapters → top-level sections, in reading order; a part with no published chapter isn't listed. */
export function contentsOf(book: Book): ContentsPart[] {
  return (
    book.parts
      // The book never has an empty part (MOD-vault groups only published chapters); this guards a book built by hand.
      .filter((part) => part.chapters.length > 0)
      .map((part) => ({
        number: part.number,
        // MOD-vault's numeral, which the chapter page shows too: one rule for every page.
        romanNumeral: part.romanNumeral,
        title: part.title,
        slug: part.slug,
        chapters: part.chapters.map((c) => {
          const href = url({ kind: "chapter", slug: c.slug });
          return {
            number: c.number,
            title: c.title,
            slug: c.slug,
            href,
            readingMinutes: c.readingMinutes,
            sections: c.sections
              .filter((s) => s.depth === 2)
              .map((s) => ({ text: s.text, anchor: s.anchor, href: `${href}#${s.anchor}` })),
          };
        }),
      }))
  );
}

/** The first published chapter, where "Read from the start" goes; undefined when nothing is published yet. */
export function firstChapter(book: Book): ChapterData | undefined {
  return book.chapters[0];
}

/**
 * Where a "start reading" link goes (the archive's empty state, About, the 404): Chapter 1's address, or the
 * contents page while no chapter is published, so the link always leads somewhere.
 */
export function startAddress(book: Book): string {
  const first = firstChapter(book);
  return first ? url({ kind: "chapter", slug: first.slug }) : url({ kind: "contents" });
}

const NUMERALS: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

/** 1 → "I", 4 → "IV", 1994 → "MCMXCIV"; `n` must be a whole number from 1 to 3999. */
export function romanNumeral(n: number): string {
  if (!Number.isInteger(n) || n < 1 || n > 3999)
    throw new RangeError(`romanNumeral: ${n} isn't a whole number from 1 to 3999`);
  let rest = n;
  let out = "";
  for (const [value, letters] of NUMERALS) {
    while (rest >= value) {
      out += letters;
      rest -= value;
    }
  }
  return out;
}
