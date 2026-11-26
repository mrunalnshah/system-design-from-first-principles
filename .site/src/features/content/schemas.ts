/**
 * Frontmatter rules (REQ-CNT-007, REQ-CNT-011, specs/contracts/frontmatter.schema.json): zod schemas that
 * mirror the JSON Schema, and `readFrontmatter`, which turns a file's text into checked values plus
 * plain-language issues (E-FRONTMATTER-YAML, E-FRONTMATTER-FIELD) pointing at the line to fix.
 * Unknown keys are allowed and ignored (Obsidian adds its own, such as tags and aliases).
 */
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { z } from "astro/zod";
import type { BuildIssue } from "../site/index.ts";
import { SLUG } from "./naming.ts";

/**
 * `yyyy-mm-dd`, a real calendar day. `readFrontmatter` hands over the date exactly as written, because YAML
 * quietly rolls an impossible unquoted date like 2026-13-01 over into 2027.
 */
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const day = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(day.getTime()) && day.toISOString().startsWith(s);
  });

const common = {
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(300).optional(),
  draft: z.boolean().default(false),
  featured: z.boolean().default(false),
  moved_from: z
    .array(z.string().regex(SLUG))
    .refine((a) => new Set(a).size === a.length)
    .default([]),
};

export const chapterSchema = z
  .looseObject({ ...common, epigraph: z.string().trim().max(400).optional(), epigraph_source: z.string().trim().max(120).optional() })
  .refine((c) => c.epigraph_source === undefined || c.epigraph !== undefined, { path: ["epigraph_source"], message: "needs an epigraph", params: { between: true } });
export const articleSchema = z.looseObject({ ...common, date: calendarDate.optional() });
export const pageSchema = z.looseObject(common);
export const bookSchema = z.looseObject({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().optional(),
  author: z.string().trim().min(1),
  author_url: z.string().regex(/^https:\/\/\S+$/),
  hero_image: z.string().regex(/\.svg$/).optional(),
});

export type ChapterFrontmatter = z.infer<typeof chapterSchema>;
export type ArticleFrontmatter = z.infer<typeof articleSchema>;
export type PageFrontmatter = z.infer<typeof pageSchema>;
export type BookFrontmatter = z.infer<typeof bookSchema>;

const schemas = { chapter: chapterSchema, article: articleSchema, page: pageSchema, book: bookSchema } as const;
type Kind = keyof typeof schemas;
type Output<K extends Kind> = z.infer<(typeof schemas)[K]>;

/** What each field should be, for messages: `<field> must be <what>` and `Change <field> to <what>, e.g. <example>`. */
const EXPECTED: Record<string, { what: string; example: string }> = {
  title: { what: "a line of text (up to 160 characters)", example: 'title: "How Computers Work"' },
  description: { what: "one sentence (up to 300 characters)", example: 'description: "The four parts every system is built from."' },
  draft: { what: "true or false", example: "draft: true" },
  featured: { what: "true or false", example: "featured: true" },
  moved_from: { what: "a list of different old slugs (lowercase words joined by -)", example: "moved_from: [computer-architecture]" },
  epigraph: { what: "the quote itself (up to 400 characters)", example: 'epigraph: "Everything is a trade-off."' },
  epigraph_source: { what: "who said it (up to 120 characters)", example: 'epigraph_source: "Anonymous"' },
  date: { what: "a real date written yyyy-mm-dd", example: "date: 2026-11-01" },
  subtitle: { what: "one line of text", example: 'subtitle: "How large systems work"' },
  author: { what: "your name as readers should see it", example: 'author: "Your Name"' },
  author_url: { what: "an https:// address", example: "author_url: https://example.com/" },
  hero_image: { what: "the file name of a diagram image ending in .svg", example: "hero_image: 01_computer-architecture-light.svg" },
};

/** book.md's title is the book's, not a chapter's. */
const BOOK_TITLE = { what: "the book's title", example: 'title: "System Design from First Principles"' };

/**
 * Reads and checks the frontmatter of one file. `file` is vault-relative, for messages.
 * Returns the checked values (defaults filled in; a field that fails its rule is left out so the build can go on
 * and find more problems), the body with the frontmatter's lines left blank (line numbers match the file), and
 * any issues. `data` is undefined only when a required field (book.md) is missing or wrong.
 */
export function readFrontmatter<K extends Kind>(text: string, file: string, kind: K): { data?: Output<K>; body: string; issues: BuildIssue[] } {
  const source = text.replace(/\r\n?/g, "\n");
  let raw: Record<string, unknown> = {};
  let body = source;
  try {
    const parsed = parseFrontmatter(source, { frontmatter: "empty-with-lines" });
    raw = parsed.frontmatter as Record<string, unknown>;
    body = parsed.content;
  } catch (e) {
    const error = e as { code?: string; linePos?: { line: number }[] };
    const yamlLine = error.linePos?.[0]?.line;
    return brokenYaml(source, file, kind, {
      line: yamlLine ? yamlLine + (frontmatterSpan(source)?.open ?? 0) : undefined,
      message: error.code === "DUPLICATE_KEY" ? "The frontmatter has the same field twice." : "The frontmatter isn't valid YAML.",
      fix: error.code === "DUPLICATE_KEY" ? "Check for a missing colon or quote on this line, or keep only one of the two fields." : "Check for a missing colon or quote on this line.",
    });
  }
  const span = frontmatterSpan(source);
  const content = span ? lines(source, span).findIndex((l) => l.trim() !== "" && !l.trim().startsWith("#")) : -1; // first non-comment line
  if (span && content >= 0 && (Array.isArray(raw) || !Object.keys(raw).length)) {
    // A list or a lone value where `field: value` lines belong.
    return brokenYaml(source, file, kind, {
      line: span.open + 2 + content,
      message: "The frontmatter isn't a set of fields (each line should be field: value).",
      fix: "Check for a missing colon or quote on this line.",
    });
  }

  // A date YAML read as a timestamp is checked as written (see calendarDate).
  for (const [key, value] of Object.entries(raw)) if (value instanceof Date) raw[key] = writtenValue(source, key) ?? value;

  const issues: BuildIssue[] = [];
  let result = schemas[kind].safeParse(raw);
  if (!result.success) {
    const bad = new Set<string>();
    for (const problem of result.error.issues) {
      const field = String(problem.path[0] ?? "");
      if (!field || bad.has(field)) continue;
      bad.add(field);
      const expected = (kind === "book" && field === "title" ? BOOK_TITLE : EXPECTED[field]) ?? { what: "a valid value", example: `${field}: …` };
      const missing = raw[field] === undefined;
      // A rule between fields (epigraph_source needs an epigraph), marked by its `params`.
      const custom = problem.code === "custom" && (problem as { params?: { between?: boolean } }).params?.between === true;
      const issue: BuildIssue = {
        severity: "error",
        code: "E-FRONTMATTER-FIELD",
        file,
        message: custom ? `${field} ${problem.message}.` : missing ? `${field} is missing; it must be ${expected.what}.` : `${field} must be ${expected.what}.`,
        fix: custom
          ? `Change ${field} to nothing (remove it), or add the quote it belongs to, e.g. ${EXPECTED.epigraph!.example}`
          : `Change ${field} to ${expected.what}, e.g. ${expected.example}`,
      };
      const line = fieldLine(source, field);
      if (line) issue.line = line;
      issues.push(issue);
    }
    result = schemas[kind].safeParse(Object.fromEntries(Object.entries(raw).filter(([k]) => !bad.has(k))));
    // Entries have no required fields, so they always get values (defaults at worst); only book.md can have none.
    if (!result.success && kind !== "book") result = schemas[kind].safeParse({});
    issues.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity)); // in the order the author reads them
  }
  return { data: result.success ? (result.data as Output<K>) : undefined, body, issues };
}

/** The 0-based lines of the opening and closing `---` (or `+++`) fences, by Astro's own rule; undefined without frontmatter. */
export function frontmatterSpan(source: string): { open: number; close: number } | undefined {
  const all = source.replace(/^\ufeff/, "").split("\n");
  let open = 0;
  while (open < all.length && all[open]!.trim() === "") open++;
  const fence = /^(---|\+\+\+)/.exec(all[open] ?? "")?.[1];
  if (!fence) return undefined;
  for (let close = open + 1; close < all.length; close++) if (all[close]!.startsWith(fence)) return { open, close };
  return undefined;
}

/** The frontmatter's own lines, between the fences. */
function lines(source: string, span: { open: number; close: number }): string[] {
  return source.replace(/^\ufeff/, "").split("\n").slice(span.open + 1, span.close);
}

/** The result for frontmatter that can't be read: one E-FRONTMATTER-YAML, defaults, and the frontmatter's lines blanked. */
function brokenYaml<K extends Kind>(source: string, file: string, kind: K, what: { line: number | undefined; message: string; fix: string }) {
  const issue: BuildIssue = { severity: "error", code: "E-FRONTMATTER-YAML", file, message: what.message, fix: what.fix };
  if (what.line) issue.line = what.line;
  // Go on with defaults, so a chapter with broken frontmatter still has its place (the error stops the publish).
  const fallback = schemas[kind].safeParse({});
  return { data: fallback.success ? (fallback.data as Output<K>) : undefined, body: blankFrontmatter(source), issues: [issue] };
}

/** The text with the frontmatter's lines (fences included) left empty, so line numbers still match the file. */
export function blankFrontmatter(source: string): string {
  const span = frontmatterSpan(source);
  if (!span) return source;
  const all = source.replace(/^\ufeff/, "").split("\n");
  return all.map((l, i) => (i <= span.close ? "" : l)).join("\n");
}

/** The text written after `field:` in the frontmatter, without quotes or a trailing comment. */
function writtenValue(source: string, field: string): string | undefined {
  const line = fieldLine(source, field);
  if (!line) return undefined;
  return source
    .split("\n")
    [line - 1]!.slice(field.length + 1)
    .replace(/\s+#.*$/, "")
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
}

/** The 1-based line where `field:` is written in the frontmatter, if it is. */
function fieldLine(source: string, field: string): number | undefined {
  const span = frontmatterSpan(source);
  if (!span) return undefined;
  const i = lines(source, span).findIndex((l) => new RegExp(`^\\s*${field}\\s*:`).test(l));
  return i < 0 ? undefined : span.open + 2 + i;
}
