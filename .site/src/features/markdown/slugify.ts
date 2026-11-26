/**
 * Heading anchors by GitHub's rule (specs/contracts/routes.md, CR-0001: our own code instead of github-slugger):
 * lowercase, punctuation removed, each space becomes `-`, and repeats in one document get `-1`, `-2`, ….
 * "Moore's Law" → `moores-law`. Shared by heading ids and `[[note#Heading]]` links, so they always agree.
 */

/** The anchor for one heading text, before de-duplication. Letters, marks, digits, `_`, `-` and spaces survive. */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}\p{Pc}\- ]/gu, "")
    .replace(/ /g, "-");
}

/** Ids the footnotes use (plugins/footnotes.ts); a heading never takes one, so `#fn-1` always reaches the note. */
const RESERVED = /^(?:(?:fn|sn|ref)-\d+|endnotes-title)$/;

/** A per-document slugger: the same text twice gives `x`, then `x-1`. Empty anchors become `section`. */
export function createSlugger(): (text: string) => string {
  const seen = new Map<string, number>();
  return (text) => {
    const original = slugify(text) || "section";
    let slug = original;
    while (seen.has(slug) || RESERVED.test(slug)) {
      const n = (seen.get(original) ?? 0) + 1;
      seen.set(original, n);
      slug = `${original}-${n}`;
    }
    seen.set(slug, 0);
    return slug;
  };
}
