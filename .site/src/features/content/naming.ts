/**
 * The vault's naming rules (REQ-CNT-001, REQ-CNT-002, specs/contracts/routes.md): which names are parts,
 * chapters and articles, the slug each gets, and the title derived from a slug.
 *
 * Names are read leniently, so a near-miss isn't silently dropped: `part-2_Networks` and
 * `chapter-3_Load Balancing.md` still count, with slugs `networks` and `load-balancing`. The number is
 * the only thing that must be exact: a positive whole number.
 */

/** A slug: lowercase letters and digits in words joined by single hyphens. */
export const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Slugs the website keeps for its own files (specs/contracts/routes.md). */
export const RESERVED_SLUGS: readonly string[] = ["diagrams", "_astro", "404"];

/** `part-<n>_<slug>` → its number and slug; undefined for any other folder name. */
export function parsePartFolder(name: string): { number: number; slug: string } | undefined {
  return numbered(/^part-(\d+)_(.+)$/.exec(name));
}

/** `chapter-<n>_<slug>.md` → its number and slug; undefined for any other file name. */
export function parseChapterFile(name: string): { number: number; slug: string } | undefined {
  return numbered(/^chapter-(\d+)_(.+)\.md$/.exec(name));
}

/** `<slug>.md` in `articles/` → its slug; undefined for a non-Markdown file or a name with no letters or digits. */
export function parseArticleFile(name: string): { slug: string } | undefined {
  const m = /^(.+)\.md$/.exec(name);
  const slug = m ? slugify(m[1]!) : "";
  return slug ? { slug } : undefined;
}

/** Turns any text into a slug: lowercase, accents dropped, every run of other characters becomes one `-`. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Short words that stay lowercase inside a title, as in English title case. */
const MINOR = new Set(["a", "an", "and", "as", "at", "but", "by", "for", "from", "in", "into", "of", "on", "or", "per", "the", "to", "via", "vs", "with"]);

/** `computer-architecture` → "Computer Architecture"; minor words stay lowercase unless first or last. */
export function titleFromSlug(slug: string): string {
  const words = slug.split("-").filter(Boolean);
  return words
    .map((w, i) => (i > 0 && i < words.length - 1 && MINOR.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function numbered(m: RegExpExecArray | null): { number: number; slug: string } | undefined {
  if (!m) return undefined;
  const number = Number(m[1]);
  const slug = slugify(m[2]!);
  return number >= 1 && Number.isSafeInteger(number) && slug ? { number, slug } : undefined;
}
