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
  .refine((c) => c.epigraph_source === undefined || c.epigraph !== undefined, { path: ["epigraph"], message: "needed by epigraph_source" });
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
    const yamlLine = (e as { linePos?: { line: number }[] }).linePos?.[0]?.line;
    const issue: BuildIssue = {
      severity: "error",
      code: "E-FRONTMATTER-YAML",
      file,
      message: "The frontmatter isn't valid YAML.",
      fix: "Check for a missing colon or quote on this line.",
    };
    if (yamlLine) issue.line = yamlLine + linesBeforeFrontmatter(source);
    // Go on with defaults, so a chapter with broken frontmatter still has its place (the error stops the publish).
    const fallback = schemas[kind].safeParse({});
    body = source.replace(/^﻿?(\s*\n)?---\n[\s\S]*?\n---/, (m) => m.replace(/[^\n]/g, ""));
    return { data: fallback.success ? (fallback.data as Output<K>) : undefined, body, issues: [issue] };
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
      const expected = EXPECTED[field] ?? { what: "a valid value", example: `${field}: …` };
      const missing = raw[field] === undefined;
      const issue: BuildIssue = {
        severity: "error",
        code: "E-FRONTMATTER-FIELD",
        file,
        message: missing ? `${field} is missing; it must be ${expected.what}.` : `${field} must be ${expected.what}.`,
        fix: `Change ${field} to ${expected.what}, e.g. ${expected.example}`,
      };
      const line = fieldLine(source, field);
      if (line) issue.line = line;
      issues.push(issue);
    }
    result = schemas[kind].safeParse(Object.fromEntries(Object.entries(raw).filter(([k]) => !bad.has(k))));
    issues.sort((a, b) => (a.line ?? Infinity) - (b.line ?? Infinity)); // in the order the author reads them
  }
  return { data: result.success ? (result.data as Output<K>) : undefined, body, issues };
}

/** Lines before the YAML text inside the `---` fences, so a YAML line number becomes a file line number. */
function linesBeforeFrontmatter(source: string): number {
  const open = /^﻿?(\s*\n)?---/.exec(source);
  return open ? open[0].split("\n").length - 1 : 0;
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
  const lines = source.split("\n");
  const start = lines.findIndex((l) => l.trim() === "---");
  for (let i = start + 1; start >= 0 && i < lines.length && lines[i]!.trim() !== "---"; i++) {
    if (lines[i]!.startsWith(`${field}:`)) return i + 1;
  }
  return undefined;
}
